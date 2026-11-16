-- =============================================================================
-- Phase 1, Step 3: Activity log and shared groundwork
--
-- 1. activity_log: an append-only history of every create / update / archive /
--    restore / delete, written by the DATABASE itself so nothing can skip it.
-- 2. Standard-field rules shared by every main table (created_by can't be
--    faked, created_at can't be changed, updated_at always accurate).
-- 3. add_standard_triggers(): one call wires both of the above onto a table.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. The activity log
-- ---------------------------------------------------------------------------
create type public.actor_type as enum ('user', 'system', 'automation');

create table public.activity_log (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_type  public.actor_type not null,
  -- Who did it (a person). Empty for system/automation actions.
  actor_id    uuid references public.profiles (id) on delete set null,
  -- What happened: create, update, archive, restore, delete
  -- (later phases add automated actions such as email_sent).
  action      text not null check (char_length(action) between 1 and 50),
  table_name  text not null,
  record_id   uuid,
  -- What changed. For updates: { field: { "old": ..., "new": ... } }.
  -- For create/delete: a snapshot of the record.
  changes     jsonb,
  -- Optional extra detail, e.g. { "source": "ghl_import" } or which automation ran.
  context     jsonb
);

comment on table public.activity_log is
  'Append-only history of every change and automated action. Never edited or deleted.';

create index activity_log_record_idx on public.activity_log (table_name, record_id, occurred_at desc);
create index activity_log_recent_idx on public.activity_log (occurred_at desc);
create index activity_log_actor_idx  on public.activity_log (actor_id, occurred_at desc);


-- The log can never be edited or deleted — not by users, not by admins,
-- not by the full-access server key. The only exception: when a person's
-- account is removed, their name is blanked from entries (actor_id -> empty)
-- while the entries themselves remain.
create or replace function public.protect_activity_log()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.actor_id is not null
     and new.actor_id is null
     and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
    return new;
  end if;
  raise exception 'The activity log cannot be changed or deleted' using errcode = '42501';
end;
$$;

create trigger activity_log_no_update_or_delete
  before update or delete on public.activity_log
  for each row execute function public.protect_activity_log();

create trigger activity_log_no_truncate
  before truncate on public.activity_log
  for each statement execute function public.protect_activity_log();


-- ---------------------------------------------------------------------------
-- Who is acting right now?
-- A logged-in person -> 'user'. Background jobs can identify themselves by
-- setting app.actor_type = 'automation' for their transaction. Otherwise 'system'.
-- ---------------------------------------------------------------------------
create or replace function public.current_actor_type()
returns public.actor_type
language plpgsql
stable
set search_path = ''
as $$
declare
  declared text := nullif(current_setting('app.actor_type', true), '');
begin
  if (select auth.uid()) is not null then
    return 'user';
  elsif declared = 'automation' then
    return 'automation';
  else
    return 'system';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- The trigger that writes to the log after every change.
-- ---------------------------------------------------------------------------
create or replace function public.log_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action  text;
  v_changes jsonb;
  v_record  uuid;
  v_context jsonb := nullif(current_setting('app.activity_context', true), '')::jsonb;
  v_actor   uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    v_action  := 'create';
    v_record  := (to_jsonb(new) ->> 'id')::uuid;
    v_changes := to_jsonb(new);

  elsif tg_op = 'DELETE' then
    v_action  := 'delete';
    v_record  := (to_jsonb(old) ->> 'id')::uuid;
    v_changes := to_jsonb(old);

  else -- UPDATE: record only the fields that actually changed
    v_record := (to_jsonb(new) ->> 'id')::uuid;

    select jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value))
      into v_changes
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value
       and n.key <> 'updated_at';

    if v_changes is null then
      return null; -- nothing really changed; don't log noise
    end if;

    if v_changes ? 'archived_at' and (to_jsonb(old) ->> 'archived_at') is null then
      v_action := 'archive';
    elsif v_changes ? 'archived_at' and (to_jsonb(new) ->> 'archived_at') is null then
      v_action := 'restore';
    else
      v_action := 'update';
    end if;
  end if;

  insert into public.activity_log (actor_type, actor_id, action, table_name, record_id, changes, context)
  values (
    public.current_actor_type(),
    -- Only link to a person who has a profile (a profile being deleted can't be referenced).
    case when v_actor is not null
          and exists (select 1 from public.profiles p where p.id = v_actor)
         then v_actor end,
    v_action,
    tg_table_name,
    v_record,
    v_changes,
    v_context
  );

  return null;
end;
$$;


-- ---------------------------------------------------------------------------
-- 2. Standard fields: enforced on every main table.
-- ---------------------------------------------------------------------------
create or replace function public.set_standard_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    -- A logged-in person is always recorded as the creator; they can't claim
    -- someone else created it. (Trusted server jobs, e.g. imports, may set it.)
    if v_actor is not null then
      new.created_by := v_actor;
    end if;
    -- Default owner: whoever created it.
    if new.owner_id is null then
      new.owner_id := new.created_by;
    end if;
  else
    -- These never change after creation.
    new.id         := old.id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- 3. One call to wire the standard rules + activity log onto a table.
--    Used by every later migration that creates a main table.
-- ---------------------------------------------------------------------------
create or replace function public.add_standard_triggers(target regclass)
returns void
language plpgsql
set search_path = ''
as $$
declare
  tbl text := (select c.relname from pg_catalog.pg_class c where c.oid = target);
begin
  execute format(
    'create trigger %I before insert or update on %s
       for each row execute function public.set_standard_fields()',
    tbl || '_standard_fields', target);

  execute format(
    'create trigger %I after insert or update or delete on %s
       for each row execute function public.log_row_change()',
    tbl || '_activity_log', target);
end;
$$;


-- ---------------------------------------------------------------------------
-- Apply to profiles (replacing its simpler updated_at trigger).
-- ---------------------------------------------------------------------------
drop trigger profiles_set_updated_at on public.profiles;
select public.add_standard_triggers('public.profiles');


-- ---------------------------------------------------------------------------
-- Row-level security for the activity log
-- ---------------------------------------------------------------------------
alter table public.activity_log enable row level security;

-- Everyone logged in can read the history (decided by the owner, 2026-11-16).
create policy "Team members can view the activity log"
  on public.activity_log for select
  to authenticated
  using (true);

-- No insert/update/delete policies: only the database's own trigger writes here.

revoke all on public.activity_log from anon, authenticated;
grant select on public.activity_log to authenticated;


-- ---------------------------------------------------------------------------
-- Function permissions: internal helpers are not callable through the API.
-- ---------------------------------------------------------------------------
revoke execute on function public.protect_activity_log()         from public, anon, authenticated;
revoke execute on function public.log_row_change()               from public, anon, authenticated;
revoke execute on function public.set_standard_fields()          from public, anon, authenticated;
revoke execute on function public.add_standard_triggers(regclass) from public, anon, authenticated;
revoke execute on function public.current_actor_type()           from public, anon, authenticated;
