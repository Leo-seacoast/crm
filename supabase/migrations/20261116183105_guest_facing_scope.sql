-- =============================================================================
-- Scope change (approved by the owner 2026-11-16): the CRM is guest-facing only —
-- MTR leads and the membership program.
--
-- 1. Contact types become: lead, guest, member.
--    "client" becomes "guest"; "owner", "vendor" and "partner" are removed.
-- 2. The example pipelines "Sales" and "Owner onboarding" are archived
--    (with any deals in them). Archived = restorable, never deleted.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Contact types
-- ---------------------------------------------------------------------------
alter type public.contact_type rename to contact_type_old;
create type public.contact_type as enum ('lead', 'guest', 'member');

-- Converts old type lists to the new ones (client -> guest; others dropped).
create function public.tmp_map_contact_types(old public.contact_type_old[])
returns public.contact_type[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct m::public.contact_type order by m::public.contact_type), '{}')
  from (
    select case x::text when 'client' then 'guest' else x::text end as m
    from unnest(old) x
  ) s
  where m in ('lead', 'guest', 'member');
$$;

alter table public.contacts alter column types drop default;
alter table public.contacts
  alter column types type public.contact_type[] using public.tmp_map_contact_types(types);
alter table public.contacts alter column types set default '{}';

drop function public.tmp_map_contact_types(public.contact_type_old[]);
drop type public.contact_type_old;


-- ---------------------------------------------------------------------------
-- 2. Archive the example pipelines (and their deals first — a pipeline with
--    active deals can't be archived).
-- ---------------------------------------------------------------------------
select set_config(
  'app.activity_context',
  jsonb_build_object('source', 'migration', 'reason', 'Guest-facing scope: example pipelines archived')::text,
  true
);

update public.deals d set archived_at = now()
 where d.archived_at is null
   and d.pipeline_id in (
     select p.id from public.pipelines p
      where p.archived_at is null and lower(p.name) in ('sales', 'owner onboarding')
   );

update public.pipelines set archived_at = now()
 where archived_at is null and lower(name) in ('sales', 'owner onboarding');
