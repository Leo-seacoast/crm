-- =============================================================================
-- Phase 1, Step 5: Pipelines, stages and deals
--
-- pipelines -> pipeline_stages -> deals. Multiple pipelines supported.
-- A deal links to a contact and/or a company (at least one).
-- Only admins manage pipelines and stages; everyone logged in works with deals.
-- =============================================================================


create type public.stage_kind as enum ('open', 'won', 'lost');


-- ---------------------------------------------------------------------------
-- Pipelines
-- ---------------------------------------------------------------------------
create table public.pipelines (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 100),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null,
  owner_id    uuid references auth.users (id) on delete set null,
  archived_at timestamptz
);

comment on table public.pipelines is 'Deal pipelines, e.g. Sales, Owner onboarding.';
select public.add_standard_triggers('public.pipelines');


-- ---------------------------------------------------------------------------
-- Stages
-- ---------------------------------------------------------------------------
create table public.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines (id) on delete restrict,
  name        text not null check (char_length(trim(name)) between 1 and 100),
  kind        public.stage_kind not null default 'open',  -- open, won or lost
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null,
  owner_id    uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  -- Lets deals prove their stage belongs to their pipeline (see deals below).
  unique (id, pipeline_id)
);

comment on table public.pipeline_stages is 'Ordered stages within a pipeline, each open, won or lost.';
create index pipeline_stages_pipeline_idx on public.pipeline_stages (pipeline_id, position);
select public.add_standard_triggers('public.pipeline_stages');

-- A stage can't move to another pipeline, and can't be archived while it holds active deals.
create or replace function public.enforce_stage_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pipeline_id <> old.pipeline_id then
    raise exception 'A stage can''t be moved to a different pipeline' using errcode = '42501';
  end if;
  if new.archived_at is not null and old.archived_at is null
     and exists (select 1 from public.deals d where d.stage_id = new.id and d.archived_at is null) then
    raise exception 'Move or archive the deals in this stage before archiving it' using errcode = '42501';
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- Deals
-- ---------------------------------------------------------------------------
create table public.deals (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (char_length(trim(title)) between 1 and 200),
  pipeline_id         uuid not null references public.pipelines (id) on delete restrict,
  stage_id            uuid not null,
  contact_id          uuid references public.contacts (id) on delete set null,
  company_id          uuid references public.companies (id) on delete set null,
  value               numeric(14, 2) check (value >= 0),
  currency            char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  expected_close_date date,
  closed_at           timestamptz,   -- set automatically when moved to a won/lost stage
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users (id) on delete set null,
  owner_id            uuid references auth.users (id) on delete set null,
  archived_at         timestamptz,

  -- The stage must belong to the deal's pipeline.
  foreign key (stage_id, pipeline_id) references public.pipeline_stages (id, pipeline_id),
  -- Every deal is linked to a contact, a company, or both.
  constraint deals_linked check (contact_id is not null or company_id is not null)
);

comment on table public.deals is 'Deals/opportunities moving through a pipeline.';

create index deals_stage_idx    on public.deals (stage_id) where archived_at is null;
create index deals_pipeline_idx on public.deals (pipeline_id);
create index deals_contact_idx  on public.deals (contact_id);
create index deals_company_idx  on public.deals (company_id);

select public.add_standard_triggers('public.deals');

-- Close date follows the stage; people can't drop a deal into an archived stage.
create or replace function public.enforce_deal_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind     public.stage_kind;
  v_archived timestamptz;
begin
  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    select s.kind, s.archived_at into v_kind, v_archived
      from public.pipeline_stages s where s.id = new.stage_id;

    if v_archived is not null then
      raise exception 'That stage has been archived' using errcode = '42501';
    end if;

    if v_kind = 'open' then
      new.closed_at := null;
    elsif tg_op = 'INSERT' or new.closed_at is not distinct from old.closed_at then
      new.closed_at := now();
    end if;
  elsif current_user in ('authenticated', 'anon') then
    -- Stage unchanged: the close date can't be edited by hand.
    new.closed_at := old.closed_at;
  end if;
  return new;
end;
$$;

create trigger deals_enforce_rules
  before insert or update on public.deals
  for each row execute function public.enforce_deal_rules();

create trigger pipeline_stages_enforce_rules
  before update on public.pipeline_stages
  for each row execute function public.enforce_stage_rules();

revoke execute on function public.enforce_deal_rules()  from public, anon, authenticated;
revoke execute on function public.enforce_stage_rules() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.pipelines       enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals           enable row level security;

-- Pipelines and stages: everyone can see them; only admins can change them.
create policy "Team members can view pipelines"
  on public.pipelines for select to authenticated using (true);
create policy "Admins can add pipelines"
  on public.pipelines for insert to authenticated with check (public.is_admin());
create policy "Admins can edit pipelines"
  on public.pipelines for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Team members can view stages"
  on public.pipeline_stages for select to authenticated using (true);
create policy "Admins can add stages"
  on public.pipeline_stages for insert to authenticated with check (public.is_admin());
create policy "Admins can edit stages"
  on public.pipeline_stages for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Deals: same rules as contacts.
create policy "Team members can view deals"
  on public.deals for select to authenticated using (true);
create policy "Team members can add deals"
  on public.deals for insert to authenticated with check (true);
create policy "Team members can edit active deals; admins can edit archived ones"
  on public.deals for update to authenticated
  using (archived_at is null or public.is_admin())
  with check (true);

revoke all on public.pipelines, public.pipeline_stages, public.deals from anon, authenticated;
grant select, insert, update on public.pipelines, public.pipeline_stages, public.deals to authenticated;


-- ---------------------------------------------------------------------------
-- Starting pipelines (approved by the owner 2026-11-16; editable in Settings)
-- ---------------------------------------------------------------------------
with sales as (
  insert into public.pipelines (name, position) values ('Sales', 1) returning id
)
insert into public.pipeline_stages (pipeline_id, name, kind, position)
select sales.id, s.name, s.kind::public.stage_kind, s.position
from sales, (values
  ('New lead', 'open', 1),
  ('Contacted', 'open', 2),
  ('Proposal sent', 'open', 3),
  ('Negotiation', 'open', 4),
  ('Won', 'won', 5),
  ('Lost', 'lost', 6)
) as s(name, kind, position);

with onboarding as (
  insert into public.pipelines (name, position) values ('Owner onboarding', 2) returning id
)
insert into public.pipeline_stages (pipeline_id, name, kind, position)
select onboarding.id, s.name, s.kind::public.stage_kind, s.position
from onboarding, (values
  ('Inquiry', 'open', 1),
  ('Property visit', 'open', 2),
  ('Agreement sent', 'open', 3),
  ('Onboarding', 'open', 4),
  ('Live', 'won', 5),
  ('Not proceeding', 'lost', 6)
) as s(name, kind, position);
