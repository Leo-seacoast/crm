-- =============================================================================
-- Phase 3, Step 3.1: Tasks (follow-up reminders) + business settings
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Business settings: one row for the whole CRM.
-- The time zone decides what "today" means and when the daily summary goes out
-- (and, in Phase 5, the quiet hours for contacts with no time zone of their own).
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id                    boolean primary key default true check (id),  -- only one row can exist
  business_name         text check (char_length(business_name) <= 200),
  time_zone             text not null default 'America/New_York' check (char_length(time_zone) <= 64),
  daily_summary_enabled boolean not null default true,
  daily_summary_hour    integer not null default 7 check (daily_summary_hour between 0 and 23),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null,
  owner_id              uuid references auth.users (id) on delete set null,
  archived_at           timestamptz
);

comment on table public.app_settings is 'Business-wide settings (single row).';

insert into public.app_settings (id) values (true);

select public.add_standard_triggers('public.app_settings');

create or replace function public.check_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform now() at time zone new.time_zone;  -- refuses anything that isn't a real time zone
  return new;
end;
$$;

create trigger app_settings_check
  before insert or update on public.app_settings
  for each row execute function public.check_settings();

revoke execute on function public.check_settings() from public, anon, authenticated;

alter table public.app_settings enable row level security;
create policy "Team members can read settings"
  on public.app_settings for select to authenticated using (true);
create policy "Admins can change settings"
  on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.app_settings from anon, authenticated;
grant select, update on public.app_settings to authenticated;


-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create type public.task_status as enum ('open', 'done');

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(trim(title)) between 1 and 200),
  details      text check (char_length(details) <= 2000),
  due_date     date not null,
  due_time     time,                         -- optional; in the business time zone
  status       public.task_status not null default 'open',
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  -- Optionally linked to ONE contact, company or deal.
  contact_id   uuid references public.contacts (id) on delete cascade,
  company_id   uuid references public.companies (id) on delete cascade,
  deal_id      uuid references public.deals (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id) on delete set null,
  owner_id     uuid references auth.users (id) on delete set null,  -- who the task is for
  archived_at  timestamptz,
  constraint tasks_at_most_one_link check (num_nonnulls(contact_id, company_id, deal_id) <= 1)
);

comment on table public.tasks is 'Follow-up reminders with a due date, optionally linked to a contact, company or deal.';

create index tasks_open_due_idx on public.tasks (due_date) where status = 'open' and archived_at is null;
create index tasks_owner_idx    on public.tasks (owner_id, due_date) where archived_at is null;
create index tasks_contact_idx  on public.tasks (contact_id) where contact_id is not null;
create index tasks_company_idx  on public.tasks (company_id) where company_id is not null;
create index tasks_deal_idx     on public.tasks (deal_id) where deal_id is not null;

select public.add_standard_triggers('public.tasks');

-- Completion details are set by the database, so they can't be faked.
create or replace function public.enforce_task_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  by_person boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    if new.status = 'done' then
      new.completed_at := now();
      new.completed_by := (select auth.uid());
    else
      new.completed_at := null;
      new.completed_by := null;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'done' then
      new.completed_at := now();
      new.completed_by := (select auth.uid());
    else
      new.completed_at := null;
      new.completed_by := null;
    end if;
  elsif by_person then
    new.completed_at := old.completed_at;
    new.completed_by := old.completed_by;
  end if;

  -- A task stays attached to the record it was created for.
  if new.contact_id is distinct from old.contact_id
     or new.company_id is distinct from old.company_id
     or new.deal_id is distinct from old.deal_id then
    raise exception 'A task can''t be moved to a different record' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger tasks_enforce_rules
  before insert or update on public.tasks
  for each row execute function public.enforce_task_rules();

revoke execute on function public.enforce_task_rules() from public, anon, authenticated;

alter table public.tasks enable row level security;

create policy "Team members can view tasks"
  on public.tasks for select to authenticated using (true);
create policy "Team members can add tasks"
  on public.tasks for insert to authenticated with check (true);
create policy "Team members can edit active tasks; admins can edit archived ones"
  on public.tasks for update to authenticated
  using (archived_at is null or public.is_admin())
  with check (true);

revoke all on public.tasks from anon, authenticated;
grant select, insert, update on public.tasks to authenticated;
