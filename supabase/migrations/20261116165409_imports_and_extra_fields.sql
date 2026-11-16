-- =============================================================================
-- Phase 2, Step 2.1: GHL import (contacts + their companies)
--
-- 1. "Extra fields" on contacts, companies and deals: keeps GHL custom fields
--    (e.g. member codes, renewal dates, credits) so nothing is lost.
-- 2. An "imports" table: one row per import, with counts, so imports can be
--    reviewed and undone.
-- 3. Admin-only database functions that do the actual writing. They keep the
--    original GHL dates, record the admin + import in the activity log, never
--    mark anyone as opted in, and report bad rows instead of failing the batch.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Extra fields
-- ---------------------------------------------------------------------------
alter table public.contacts  add column extra_fields jsonb not null default '{}'::jsonb;
alter table public.companies add column extra_fields jsonb not null default '{}'::jsonb;
alter table public.deals     add column extra_fields jsonb not null default '{}'::jsonb;

alter table public.contacts  add constraint contacts_extra_fields_ok
  check (jsonb_typeof(extra_fields) = 'object' and octet_length(extra_fields::text) <= 20000);
alter table public.companies add constraint companies_extra_fields_ok
  check (jsonb_typeof(extra_fields) = 'object' and octet_length(extra_fields::text) <= 20000);
alter table public.deals     add constraint deals_extra_fields_ok
  check (jsonb_typeof(extra_fields) = 'object' and octet_length(extra_fields::text) <= 20000);


-- ---------------------------------------------------------------------------
-- 2. Imports
-- ---------------------------------------------------------------------------
create type public.import_kind   as enum ('contacts', 'companies', 'deals', 'notes');
create type public.import_status as enum ('in_progress', 'completed', 'undone');

create table public.imports (
  id            uuid primary key default gen_random_uuid(),
  kind          public.import_kind not null,
  source        text not null default 'ghl' check (char_length(source) <= 50),
  file_name     text not null check (char_length(file_name) between 1 and 255),
  status        public.import_status not null default 'in_progress',
  total_rows    integer not null default 0 check (total_rows >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_count   integer not null default 0 check (error_count >= 0),
  companies_created integer not null default 0 check (companies_created >= 0),
  settings      jsonb not null default '{}'::jsonb,  -- column mapping and options used
  completed_at  timestamptz,
  undone_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null,
  owner_id      uuid references auth.users (id) on delete set null,
  archived_at   timestamptz
);

comment on table public.imports is 'One row per data import (e.g. from GHL), so imports can be reviewed and undone.';
select public.add_standard_triggers('public.imports');

-- Which import created a record (used by "Undo import").
alter table public.contacts  add column import_id uuid references public.imports (id) on delete set null;
alter table public.companies add column import_id uuid references public.imports (id) on delete set null;
alter table public.deals     add column import_id uuid references public.imports (id) on delete set null;
alter table public.notes     add column import_id uuid references public.imports (id) on delete set null;

create index contacts_import_idx  on public.contacts (import_id)  where import_id is not null;
create index companies_import_idx on public.companies (import_id) where import_id is not null;
create index deals_import_idx     on public.deals (import_id)     where import_id is not null;
create index notes_import_idx     on public.notes (import_id)     where import_id is not null;

alter table public.imports enable row level security;

create policy "Admins can view imports"
  on public.imports for select to authenticated using (public.is_admin());
-- No insert/update policies: imports are only written by the functions below.

revoke all on public.imports from anon, authenticated;
grant select on public.imports to authenticated;


-- ---------------------------------------------------------------------------
-- Imports keep the original creation date from GHL.
-- (set_standard_fields already lets trusted server processes do this; an import
-- run by an admin through the functions below is treated the same way.)
-- ---------------------------------------------------------------------------
create or replace function public.set_standard_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actor  uuid := (select auth.uid());
  v_import boolean := coalesce(current_setting('app.import_mode', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if (v_actor is not null and not v_import) or new.created_at is null then
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
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can import data' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.require_admin() from public, anon, authenticated;

-- Marks the rest of this transaction as part of an import (for dates + the activity log).
create or replace function public.begin_import_context(p_import_id uuid, p_what text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.import_mode', 'on', true);
  perform set_config(
    'app.activity_context',
    jsonb_build_object('source', 'ghl_import', 'import_id', p_import_id, 'step', p_what)::text,
    true
  );
end;
$$;

revoke execute on function public.begin_import_context(uuid, text) from public, anon, authenticated;

create or replace function public.require_open_import(p_import_id uuid, p_kind public.import_kind)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.imports i
    where i.id = p_import_id and i.kind = p_kind and i.status = 'in_progress'
  ) then
    raise exception 'This import is not open (it may be finished or undone)' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.require_open_import(uuid, public.import_kind) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3a. Start an import
-- ---------------------------------------------------------------------------
create or replace function public.start_import(
  p_kind public.import_kind,
  p_file_name text,
  p_total_rows integer,
  p_settings jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_admin();
  insert into public.imports (kind, file_name, total_rows, settings)
  values (p_kind, left(coalesce(nullif(trim(p_file_name), ''), 'import.csv'), 255), greatest(p_total_rows, 0), coalesce(p_settings, '{}'))
  returning id into v_id;
  return v_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- 3b. Look up existing contacts by email / phone (for the duplicate check).
--     Uses the caller's own permissions (row-level security applies).
-- ---------------------------------------------------------------------------
create or replace function public.find_existing_contacts(p_emails text[], p_phones text[])
returns table (id uuid, email text, phone text, first_name text, last_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.email, c.phone, c.first_name, c.last_name
  from public.contacts c
  where c.archived_at is null
    and (lower(c.email) = any (p_emails) or c.phone = any (p_phones))
  limit 20000;
$$;


-- ---------------------------------------------------------------------------
-- 3c. Make sure companies exist for the business names in the file.
--     Re-uses an existing active company with the same name (any capitalisation).
-- ---------------------------------------------------------------------------
create or replace function public.import_companies(p_import_id uuid, p_names text[])
returns table (name text, id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name    text;
  v_id      uuid;
  v_created integer := 0;
begin
  perform public.require_admin();
  perform public.require_open_import(p_import_id, 'contacts');
  perform public.begin_import_context(p_import_id, 'companies');

  for v_name in
    select distinct on (lower(trim(n))) trim(n)
    from unnest(p_names) n
    where char_length(trim(n)) between 1 and 200
  loop
    select c.id into v_id
      from public.companies c
     where lower(c.name) = lower(v_name) and c.archived_at is null
     order by c.created_at
     limit 1;

    if v_id is null then
      insert into public.companies (name, import_id) values (v_name, p_import_id) returning companies.id into v_id;
      v_created := v_created + 1;
    end if;

    name := v_name;
    id := v_id;
    return next;
    v_id := null;
  end loop;

  update public.imports set companies_created = companies_created + v_created where imports.id = p_import_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- 3d. Import one batch of contacts (the app sends ~500 at a time).
--     Each row says "create" or "update" (decided in the preview).
--     Updates only FILL IN BLANKS, add tags and add extra fields — they never
--     overwrite what's already in the CRM.
--     Consent: an import can record an opt-OUT (GHL "DND"), never an opt-in.
-- ---------------------------------------------------------------------------
create or replace function public.import_contacts_batch(p_import_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          jsonb;
  v_created  integer := 0;
  v_updated  integer := 0;
  v_skipped  integer := 0;
  v_errors   jsonb := '[]'::jsonb;
  v_types    public.contact_type[];
  v_tags     text[];
  v_email_c  public.consent_status;
  v_sms_c    public.consent_status;
begin
  perform public.require_admin();
  perform public.require_open_import(p_import_id, 'contacts');
  perform public.begin_import_context(p_import_id, 'contacts');

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'Send between 1 and 1000 rows at a time' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    begin
      v_types := coalesce(array(select jsonb_array_elements_text(coalesce(r -> 'types', '[]')))::public.contact_type[], '{}');
      v_tags  := coalesce(array(select left(t, 50) from jsonb_array_elements_text(coalesce(r -> 'tags', '[]')) t limit 50), '{}');
      v_email_c := coalesce(nullif(r ->> 'email_consent', ''), 'unknown')::public.consent_status;
      v_sms_c   := coalesce(nullif(r ->> 'sms_consent', ''), 'unknown')::public.consent_status;

      if v_email_c = 'opted_in' or v_sms_c = 'opted_in' then
        raise exception 'An import cannot mark anyone as opted in' using errcode = '42501';
      end if;

      if r ->> 'action' = 'create' then
        insert into public.contacts (
          first_name, last_name, email, phone, types, company_id,
          address_line1, address_line2, city, region, postal_code, country,
          time_zone, source, tags, extra_fields,
          email_consent, email_consent_at, email_consent_source,
          sms_consent, sms_consent_at, sms_consent_source,
          created_at, import_id
        ) values (
          nullif(r ->> 'first_name', ''), nullif(r ->> 'last_name', ''),
          nullif(lower(r ->> 'email'), ''), nullif(r ->> 'phone', ''),
          v_types, nullif(r ->> 'company_id', '')::uuid,
          nullif(r ->> 'address_line1', ''), nullif(r ->> 'address_line2', ''),
          nullif(r ->> 'city', ''), nullif(r ->> 'region', ''),
          nullif(r ->> 'postal_code', ''), nullif(r ->> 'country', ''),
          nullif(r ->> 'time_zone', ''), coalesce(nullif(r ->> 'source', ''), 'GHL import'),
          v_tags, coalesce(r -> 'extra_fields', '{}'::jsonb),
          v_email_c, case when v_email_c = 'opted_out' then now() end,
          case when v_email_c = 'opted_out' then 'GHL import (DND)' end,
          v_sms_c, case when v_sms_c = 'opted_out' then now() end,
          case when v_sms_c = 'opted_out' then 'GHL import (DND)' end,
          coalesce(nullif(r ->> 'created_at', '')::timestamptz, now()),
          p_import_id
        );
        v_created := v_created + 1;

      elsif r ->> 'action' = 'update' then
        update public.contacts c set
          first_name    = coalesce(nullif(c.first_name, ''), nullif(r ->> 'first_name', '')),
          last_name     = coalesce(nullif(c.last_name, ''), nullif(r ->> 'last_name', '')),
          email         = coalesce(c.email, nullif(lower(r ->> 'email'), '')),
          phone         = coalesce(c.phone, nullif(r ->> 'phone', '')),
          types         = array(select distinct t from unnest(c.types || v_types) t),
          company_id    = coalesce(c.company_id, nullif(r ->> 'company_id', '')::uuid),
          address_line1 = coalesce(c.address_line1, nullif(r ->> 'address_line1', '')),
          address_line2 = coalesce(c.address_line2, nullif(r ->> 'address_line2', '')),
          city          = coalesce(c.city, nullif(r ->> 'city', '')),
          region        = coalesce(c.region, nullif(r ->> 'region', '')),
          postal_code   = coalesce(c.postal_code, nullif(r ->> 'postal_code', '')),
          country       = coalesce(c.country, nullif(r ->> 'country', '')),
          time_zone     = coalesce(c.time_zone, nullif(r ->> 'time_zone', '')),
          tags          = array(select distinct t from unnest(c.tags || v_tags) t limit 50),
          -- existing values win; GHL only fills in fields we don't have yet
          extra_fields  = coalesce(r -> 'extra_fields', '{}'::jsonb) || c.extra_fields,
          email_consent = case when v_email_c = 'opted_out' and c.email_consent <> 'opted_out' then 'opted_out' else c.email_consent end,
          email_consent_at = case when v_email_c = 'opted_out' and c.email_consent <> 'opted_out' then now() else c.email_consent_at end,
          email_consent_source = case when v_email_c = 'opted_out' and c.email_consent <> 'opted_out' then 'GHL import (DND)' else c.email_consent_source end,
          sms_consent   = case when v_sms_c = 'opted_out' and c.sms_consent <> 'opted_out' then 'opted_out' else c.sms_consent end,
          sms_consent_at = case when v_sms_c = 'opted_out' and c.sms_consent <> 'opted_out' then now() else c.sms_consent_at end,
          sms_consent_source = case when v_sms_c = 'opted_out' and c.sms_consent <> 'opted_out' then 'GHL import (DND)' else c.sms_consent_source end
        where c.id = (r ->> 'target_id')::uuid and c.archived_at is null;

        if found then v_updated := v_updated + 1; else v_skipped := v_skipped + 1; end if;

      else
        v_skipped := v_skipped + 1;
      end if;

    exception
      when unique_violation then
        v_errors := v_errors || jsonb_build_object('row', r -> 'row', 'message', 'Another contact already has this email or phone');
      when others then
        v_errors := v_errors || jsonb_build_object('row', r -> 'row', 'message', left(sqlerrm, 200));
    end;
  end loop;

  update public.imports i set
    created_count = i.created_count + v_created,
    updated_count = i.updated_count + v_updated,
    skipped_count = i.skipped_count + v_skipped,
    error_count   = i.error_count + jsonb_array_length(v_errors)
  where i.id = p_import_id;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped, 'errors', v_errors);
end;
$$;


-- ---------------------------------------------------------------------------
-- 3e. Finish, and record rows skipped before sending (e.g. invalid or duplicate in the file)
-- ---------------------------------------------------------------------------
create or replace function public.finish_import(p_import_id uuid, p_skipped_in_preview integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.imports set
    status = 'completed',
    completed_at = now(),
    skipped_count = skipped_count + greatest(coalesce(p_skipped_in_preview, 0), 0)
  where id = p_import_id and status = 'in_progress';
  if not found then
    raise exception 'This import is not open' using errcode = '22023';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- 3f. Undo an import: ARCHIVES everything it created (nothing is deleted).
--     Existing records that the import filled in are not changed back; their
--     history shows exactly what was added.
-- ---------------------------------------------------------------------------
create or replace function public.undo_import(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contacts  integer;
  v_companies integer;
  v_deals     integer;
  v_notes     integer;
begin
  perform public.require_admin();
  if not exists (select 1 from public.imports where id = p_import_id and status in ('in_progress', 'completed')) then
    raise exception 'This import was already undone or does not exist' using errcode = '22023';
  end if;

  perform set_config(
    'app.activity_context',
    jsonb_build_object('source', 'ghl_import_undo', 'import_id', p_import_id)::text,
    true
  );

  update public.notes    set archived_at = now() where import_id = p_import_id and archived_at is null;
  get diagnostics v_notes = row_count;
  update public.deals    set archived_at = now() where import_id = p_import_id and archived_at is null;
  get diagnostics v_deals = row_count;
  update public.contacts set archived_at = now() where import_id = p_import_id and archived_at is null;
  get diagnostics v_contacts = row_count;
  -- Companies: only those the import created and that no active contact/deal still uses.
  update public.companies co set archived_at = now()
   where co.import_id = p_import_id and co.archived_at is null
     and not exists (select 1 from public.contacts c where c.company_id = co.id and c.archived_at is null)
     and not exists (select 1 from public.deals d where d.company_id = co.id and d.archived_at is null);
  get diagnostics v_companies = row_count;

  update public.imports set status = 'undone', undone_at = now() where id = p_import_id;

  return jsonb_build_object('contacts', v_contacts, 'companies', v_companies, 'deals', v_deals, 'notes', v_notes);
end;
$$;


-- ---------------------------------------------------------------------------
-- Permissions: the import functions can be called by logged-in users, and each
-- one checks for admin itself.
-- ---------------------------------------------------------------------------
revoke execute on function public.start_import(public.import_kind, text, integer, jsonb) from public, anon;
revoke execute on function public.find_existing_contacts(text[], text[]) from public, anon;
revoke execute on function public.import_companies(uuid, text[]) from public, anon;
revoke execute on function public.import_contacts_batch(uuid, jsonb) from public, anon;
revoke execute on function public.finish_import(uuid, integer) from public, anon;
revoke execute on function public.undo_import(uuid) from public, anon;

grant execute on function public.start_import(public.import_kind, text, integer, jsonb) to authenticated;
grant execute on function public.find_existing_contacts(text[], text[]) to authenticated;
grant execute on function public.import_companies(uuid, text[]) to authenticated;
grant execute on function public.import_contacts_batch(uuid, jsonb) to authenticated;
grant execute on function public.finish_import(uuid, integer) to authenticated;
grant execute on function public.undo_import(uuid) to authenticated;
