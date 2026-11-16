-- =============================================================================
-- Phase 1, Step 4: Contacts and companies
--
-- One contacts table (a contact can have several types), one companies table.
-- Email and SMS consent stored on each contact with when and how.
-- Security rules (RLS) written and switched on in this same migration.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Small improvement to the activity log trigger from Step 3:
-- ignore "generated" columns (e.g. the search helper column below), which are
-- calculated automatically and would only add noise to the history.
-- ---------------------------------------------------------------------------
create or replace function public.log_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action    text;
  v_changes   jsonb;
  v_record    uuid;
  v_context   jsonb := nullif(current_setting('app.activity_context', true), '')::jsonb;
  v_actor     uuid := (select auth.uid());
  v_generated text[];
begin
  select coalesce(array_agg(a.attname::text), '{}')
    into v_generated
    from pg_catalog.pg_attribute a
   where a.attrelid = tg_relid
     and a.attgenerated <> ''
     and not a.attisdropped;

  if tg_op = 'INSERT' then
    v_action  := 'create';
    v_record  := (to_jsonb(new) ->> 'id')::uuid;
    v_changes := to_jsonb(new) - v_generated;

  elsif tg_op = 'DELETE' then
    v_action  := 'delete';
    v_record  := (to_jsonb(old) ->> 'id')::uuid;
    v_changes := to_jsonb(old) - v_generated;

  else
    v_record := (to_jsonb(new) ->> 'id')::uuid;

    select jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value))
      into v_changes
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value
       and n.key <> 'updated_at'
       and not (n.key = any (v_generated));

    if v_changes is null then
      return null;
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

revoke execute on function public.log_row_change() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.contact_type as enum ('lead', 'client', 'owner', 'guest', 'vendor', 'partner');
create type public.consent_status as enum ('unknown', 'opted_in', 'opted_out');


-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(trim(name)) between 1 and 200),
  website       text check (char_length(website) <= 500),
  email         text check (char_length(email) <= 320 and position('@' in email) > 1),
  phone         text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  address_line1 text check (char_length(address_line1) <= 200),
  address_line2 text check (char_length(address_line2) <= 200),
  city          text check (char_length(city) <= 100),
  region        text check (char_length(region) <= 100),
  postal_code   text check (char_length(postal_code) <= 20),
  country       text check (char_length(country) <= 100),
  tags          text[] not null default '{}' check (cardinality(tags) <= 50),
  search_text   text generated always as (lower(coalesce(name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(website, ''))) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null,
  owner_id      uuid references auth.users (id) on delete set null,
  archived_at   timestamptz
);

comment on table public.companies is 'Companies/organisations. Contacts link to one company.';

create index companies_name_idx on public.companies (lower(name));
create index companies_tags_idx on public.companies using gin (tags);

select public.add_standard_triggers('public.companies');


-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------
create table public.contacts (
  id            uuid primary key default gen_random_uuid(),
  first_name    text check (char_length(first_name) <= 100),
  last_name     text check (char_length(last_name) <= 100),
  email         text check (char_length(email) <= 320 and position('@' in email) > 1),
  phone         text check (phone ~ '^\+[1-9][0-9]{6,14}$'),   -- always stored as +15551234567
  types         public.contact_type[] not null default '{}',
  company_id    uuid references public.companies (id) on delete set null,
  address_line1 text check (char_length(address_line1) <= 200),
  address_line2 text check (char_length(address_line2) <= 200),
  city          text check (char_length(city) <= 100),
  region        text check (char_length(region) <= 100),
  postal_code   text check (char_length(postal_code) <= 20),
  country       text check (char_length(country) <= 100),
  time_zone     text check (char_length(time_zone) <= 64),
  source        text check (char_length(source) <= 100),
  tags          text[] not null default '{}' check (cardinality(tags) <= 50),

  -- Consent: status, plus WHEN and HOW it was given/withdrawn.
  email_consent        public.consent_status not null default 'unknown',
  email_consent_at     timestamptz,
  email_consent_source text check (char_length(email_consent_source) <= 200),
  sms_consent          public.consent_status not null default 'unknown',
  sms_consent_at       timestamptz,
  sms_consent_source   text check (char_length(sms_consent_source) <= 200),

  search_text   text generated always as (
    lower(coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' ||
          coalesce(email, '') || ' ' || coalesce(phone, ''))
  ) stored,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null,
  owner_id      uuid references auth.users (id) on delete set null,
  archived_at   timestamptz,

  -- A contact needs at least a name, email or phone.
  constraint contacts_identifiable check (
    num_nonnulls(nullif(trim(first_name), ''), nullif(trim(last_name), ''), email, phone) > 0
  ),
  -- Consent other than "unknown" must say how it was given.
  constraint contacts_email_consent_has_source check (
    email_consent = 'unknown' or nullif(trim(email_consent_source), '') is not null
  ),
  constraint contacts_sms_consent_has_source check (
    sms_consent = 'unknown' or nullif(trim(sms_consent_source), '') is not null
  )
);

comment on table public.contacts is
  'All people: leads, clients, owners, guests, vendors, partners (a contact can have several types).';

-- No two ACTIVE contacts can share an email or phone (archived ones don't count).
create unique index contacts_email_unique on public.contacts (lower(email))
  where archived_at is null and email is not null;
create unique index contacts_phone_unique on public.contacts (phone)
  where archived_at is null and phone is not null;

create index contacts_company_idx on public.contacts (company_id);
create index contacts_types_idx   on public.contacts using gin (types);
create index contacts_tags_idx    on public.contacts using gin (tags);
create index contacts_name_idx    on public.contacts (lower(last_name), lower(first_name));

select public.add_standard_triggers('public.contacts');


-- ---------------------------------------------------------------------------
-- Contact rules enforced by the database
-- ---------------------------------------------------------------------------
create or replace function public.enforce_contact_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- A person using the app (as opposed to a trusted server job such as an import
  -- or, later, the contact's own form submission / unsubscribe link).
  by_person boolean := current_user in ('authenticated', 'anon');
begin
  -- Time zone must be a real one (e.g. America/New_York).
  if new.time_zone is not null
     and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'Unknown time zone: %', new.time_zone using errcode = '22023';
  end if;

  -- Tidy: no duplicate types.
  new.types := array(select distinct t from unnest(new.types) t order by t);

  if tg_op = 'INSERT' then
    -- EMAIL consent
    if new.email_consent = 'unknown' then
      new.email_consent_at := null;
      new.email_consent_source := null;
    elsif by_person or new.email_consent_at is null then
      new.email_consent_at := now();
    end if;
    -- SMS consent
    if new.sms_consent = 'unknown' then
      new.sms_consent_at := null;
      new.sms_consent_source := null;
    elsif by_person or new.sms_consent_at is null then
      new.sms_consent_at := now();
    end if;
    return new;
  end if;

  -- ---- UPDATE ----

  -- EMAIL consent
  if new.email_consent is distinct from old.email_consent then
    if by_person and old.email_consent = 'opted_out' then
      raise exception 'This contact unsubscribed from email. Only the contact can opt back in.'
        using errcode = '42501';
    end if;
    if by_person and new.email_consent = 'unknown' then
      raise exception 'Email consent can''t be reset to "not asked" once recorded.'
        using errcode = '42501';
    end if;
    if by_person or new.email_consent_at is not distinct from old.email_consent_at then
      new.email_consent_at := now();
    end if;
  elsif by_person then
    -- Status unchanged: the record of when/how can't be edited.
    new.email_consent_at := old.email_consent_at;
    new.email_consent_source := old.email_consent_source;
  end if;

  -- SMS consent
  if new.sms_consent is distinct from old.sms_consent then
    if by_person and old.sms_consent = 'opted_out' then
      raise exception 'This contact opted out of SMS. Only the contact can opt back in.'
        using errcode = '42501';
    end if;
    if by_person and new.sms_consent = 'unknown' then
      raise exception 'SMS consent can''t be reset to "not asked" once recorded.'
        using errcode = '42501';
    end if;
    if by_person or new.sms_consent_at is not distinct from old.sms_consent_at then
      new.sms_consent_at := now();
    end if;
  elsif by_person then
    new.sms_consent_at := old.sms_consent_at;
    new.sms_consent_source := old.sms_consent_source;
  end if;

  return new;
end;
$$;

create trigger contacts_enforce_rules
  before insert or update on public.contacts
  for each row execute function public.enforce_contact_rules();

revoke execute on function public.enforce_contact_rules() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Row-level security
--   Everyone logged in: view, add, edit and archive.
--   Archived records: only admins can edit or restore them.
--   Nobody can permanently delete through the app.
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.contacts  enable row level security;

create policy "Team members can view companies"
  on public.companies for select to authenticated using (true);
create policy "Team members can add companies"
  on public.companies for insert to authenticated with check (true);
create policy "Team members can edit active companies; admins can edit archived ones"
  on public.companies for update to authenticated
  using (archived_at is null or public.is_admin())
  with check (true);

create policy "Team members can view contacts"
  on public.contacts for select to authenticated using (true);
create policy "Team members can add contacts"
  on public.contacts for insert to authenticated with check (true);
create policy "Team members can edit active contacts; admins can edit archived ones"
  on public.contacts for update to authenticated
  using (archived_at is null or public.is_admin())
  with check (true);

-- No delete policies = no permanent deletes.

revoke all on public.companies from anon, authenticated;
revoke all on public.contacts  from anon, authenticated;
grant select, insert, update on public.companies to authenticated;
grant select, insert, update on public.contacts  to authenticated;
