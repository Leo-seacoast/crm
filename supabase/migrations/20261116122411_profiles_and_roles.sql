-- =============================================================================
-- Phase 1, Step 2: People and roles
--
-- Creates one "profile" per login account, holding the person's name and role
-- (admin or member). Security rules (RLS) are switched on and written here,
-- in the same migration that creates the table.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Shared helper: keep "updated_at" accurate on every table that has it.
-- (Reused by every later table.)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'member');


-- ---------------------------------------------------------------------------
-- Profiles: one row per login account
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text check (full_name is null or char_length(full_name) <= 200),
  role        public.app_role not null default 'member',  -- new people are always members
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null,
  owner_id    uuid references auth.users (id) on delete set null,
  archived_at timestamptz
);

comment on table public.profiles is 'One row per login account: name and role (admin/member).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Automatically create a profile whenever a login account is added,
-- and keep the email in sync if it changes.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, owner_id)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    new.id
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();


-- ---------------------------------------------------------------------------
-- is_admin(): "is the person making this request an active admin?"
-- Used by security rules on every table from now on.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and archived_at is null
  );
$$;


-- ---------------------------------------------------------------------------
-- set_user_role(): the ONLY way to change someone's role.
-- Admins only, and nobody can change their own role (prevents an admin
-- accidentally locking themselves out, and members promoting themselves).
-- ---------------------------------------------------------------------------
create or replace function public.set_user_role(target_user_id uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;

  if target_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;

  update public.profiles set role = new_role where id = target_user_id;

  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- Safety net: even if permissions were ever misconfigured, a logged-in user
-- can never change a role by editing the table directly.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_direct_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user in ('authenticated', 'anon') then
    raise exception 'Roles can only be changed by an admin' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_direct_role_change
  before update on public.profiles
  for each row execute function public.prevent_direct_role_change();


-- ---------------------------------------------------------------------------
-- Row-level security (RLS)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Logged-in team members can see the team list.
create policy "Team members can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- People can edit their own profile (and, via the grants below, only their name).
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert/delete policies: profiles are created automatically and never
-- deleted by users.


-- ---------------------------------------------------------------------------
-- Table and function permissions
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;

-- Internal trigger functions should never be callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.prevent_direct_role_change() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Accounts that already exist (e.g. created before this migration) get a profile too.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, email, full_name, owner_id)
select u.id, u.email, nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), u.id
from auth.users u
on conflict (id) do nothing;
