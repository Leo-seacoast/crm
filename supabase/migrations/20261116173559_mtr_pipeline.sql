-- "MTR Pipeline", recreated from GHL (2026-11-16). Open/won/lost as proposed to
-- the owner; editable in Settings -> Pipelines. Added only if it doesn't exist yet.

do $$
declare
  v_pipeline uuid;
begin
  if exists (select 1 from public.pipelines where lower(name) = 'mtr pipeline' and archived_at is null) then
    return;
  end if;

  insert into public.pipelines (name, position)
  values ('MTR Pipeline', coalesce((select max(position) from public.pipelines), 0) + 1)
  returning id into v_pipeline;

  insert into public.pipeline_stages (pipeline_id, name, kind, position) values
    (v_pipeline, 'New Lead Added',              'open', 1),
    (v_pipeline, 'Lead DND',                    'lost', 2),
    (v_pipeline, 'Needs Manual Review',         'open', 3),
    (v_pipeline, 'Permission Granted',          'open', 4),
    (v_pipeline, 'Options Sent',                'open', 5),
    (v_pipeline, 'Contract & Application Sent', 'open', 6),
    (v_pipeline, 'Application Approved',        'open', 7),
    (v_pipeline, 'Booked!',                     'won',  8),
    (v_pipeline, 'Long Term Nurture',           'open', 9),
    (v_pipeline, 'Insufficient Info',           'lost', 10);
end;
$$;
