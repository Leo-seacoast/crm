-- =============================================================================
-- Phase 1, Step 6: Notes
--
-- Notes on contacts, companies and deals. Each note belongs to exactly one record.
-- Only the author can change a note's wording; anyone can pin/unpin; the author
-- or an admin can archive; only admins can restore. No permanent deletes.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Preparation for the GHL import (Phase 2): a trusted server process (not a
-- person) may supply the original creation date. People in the app still always
-- get the database's own timestamp, so dates can't be faked through the app.
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
    if v_actor is not null or new.created_at is null then
      new.created_at := now();
    end if;
    new.updated_at := now();
    if v_actor is not null then
      new.created_by := v_actor;
    end if;
    if new.owner_id is null then
      new.owner_id := new.created_by;
    end if;
  else
    new.id         := old.id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.set_standard_fields() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  body        text not null check (char_length(trim(body)) between 1 and 10000),
  pinned      boolean not null default false,
  contact_id  uuid references public.contacts (id) on delete cascade,
  company_id  uuid references public.companies (id) on delete cascade,
  deal_id     uuid references public.deals (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null,
  owner_id    uuid references auth.users (id) on delete set null,
  archived_at timestamptz,

  -- Each note belongs to exactly one record.
  constraint notes_one_parent check (num_nonnulls(contact_id, company_id, deal_id) = 1)
);

comment on table public.notes is 'Free-text notes on a contact, company or deal.';

create index notes_contact_idx on public.notes (contact_id, created_at desc) where contact_id is not null;
create index notes_company_idx on public.notes (company_id, created_at desc) where company_id is not null;
create index notes_deal_idx    on public.notes (deal_id, created_at desc) where deal_id is not null;

select public.add_standard_triggers('public.notes');


create or replace function public.enforce_note_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  by_person boolean := current_user in ('authenticated', 'anon');
  v_actor   uuid := (select auth.uid());
begin
  -- A note can't be moved to a different record.
  if new.contact_id is distinct from old.contact_id
     or new.company_id is distinct from old.company_id
     or new.deal_id is distinct from old.deal_id then
    raise exception 'A note can''t be moved to a different record' using errcode = '42501';
  end if;

  if by_person then
    -- Only the author can change the wording.
    if new.body is distinct from old.body and old.created_by is distinct from v_actor then
      raise exception 'Only the author can edit this note' using errcode = '42501';
    end if;
    -- Only the author or an admin can archive it.
    if new.archived_at is not null and old.archived_at is null
       and old.created_by is distinct from v_actor and not public.is_admin() then
      raise exception 'Only the author or an admin can archive this note' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger notes_enforce_rules
  before update on public.notes
  for each row execute function public.enforce_note_rules();

revoke execute on function public.enforce_note_rules() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.notes enable row level security;

create policy "Team members can view notes"
  on public.notes for select to authenticated using (true);
create policy "Team members can add notes"
  on public.notes for insert to authenticated with check (true);
create policy "Team members can update active notes; admins can update archived ones"
  on public.notes for update to authenticated
  using (archived_at is null or public.is_admin())
  with check (true);

revoke all on public.notes from anon, authenticated;
grant select, insert, update on public.notes to authenticated;
