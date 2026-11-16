-- "Membership Program" pipeline, recreated from GHL (stages and open/won/lost
-- confirmed by the owner 2026-11-16). Added only if it doesn't exist yet,
-- so running this again — or on an environment that already has it — is safe.

do $$
declare
  v_pipeline uuid;
begin
  if exists (select 1 from public.pipelines where lower(name) = 'membership program' and archived_at is null) then
    return;
  end if;

  insert into public.pipelines (name, position)
  values ('Membership Program', coalesce((select max(position) from public.pipelines), 0) + 1)
  returning id into v_pipeline;

  insert into public.pipeline_stages (pipeline_id, name, kind, position) values
    (v_pipeline, 'New Submission',               'open', 1),
    (v_pipeline, 'Member Unique Code Pending',   'open', 2),
    (v_pipeline, 'Active Members',               'won',  3),
    (v_pipeline, 'Renewal Reminder',             'open', 4),
    (v_pipeline, 'Member Renewed 1st year',      'won',  5),
    (v_pipeline, 'Renewal Payment Failed',       'open', 6),
    (v_pipeline, 'Lapsed',                       'lost', 7);
end;
$$;
