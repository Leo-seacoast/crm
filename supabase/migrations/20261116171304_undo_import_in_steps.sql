-- Undo an import in steps of up to 1,000 records, so very large imports
-- (e.g. 16,000 contacts) can be undone within the database's ~8-second limit
-- per request. The app calls this repeatedly until it reports "done".
-- If it's interrupted, calling it again simply carries on.

drop function public.undo_import(uuid);

create or replace function public.undo_import_step(p_import_id uuid, p_limit integer default 1000)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit     integer := least(greatest(coalesce(p_limit, 1000), 1), 2000);
  v_archived  integer := 0;
  v_n         integer;
  v_remaining integer;
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

  -- Notes, then deals, then contacts — at most v_limit records per step.
  update public.notes set archived_at = now()
   where id in (select id from public.notes where import_id = p_import_id and archived_at is null limit v_limit);
  get diagnostics v_n = row_count;
  v_archived := v_archived + v_n;

  if v_archived < v_limit then
    update public.deals set archived_at = now()
     where id in (select id from public.deals where import_id = p_import_id and archived_at is null limit v_limit - v_archived);
    get diagnostics v_n = row_count;
    v_archived := v_archived + v_n;
  end if;

  if v_archived < v_limit then
    update public.contacts set archived_at = now()
     where id in (select id from public.contacts where import_id = p_import_id and archived_at is null limit v_limit - v_archived);
    get diagnostics v_n = row_count;
    v_archived := v_archived + v_n;
  end if;

  select
    (select count(*) from public.notes    where import_id = p_import_id and archived_at is null) +
    (select count(*) from public.deals    where import_id = p_import_id and archived_at is null) +
    (select count(*) from public.contacts where import_id = p_import_id and archived_at is null)
  into v_remaining;

  if v_remaining = 0 then
    -- Last step: companies the import created that nothing active still uses.
    update public.companies co set archived_at = now()
     where co.import_id = p_import_id and co.archived_at is null
       and not exists (select 1 from public.contacts c where c.company_id = co.id and c.archived_at is null)
       and not exists (select 1 from public.deals d where d.company_id = co.id and d.archived_at is null);
    get diagnostics v_n = row_count;
    v_archived := v_archived + v_n;
    update public.imports set status = 'undone', undone_at = now() where id = p_import_id;
  end if;

  return jsonb_build_object('archived', v_archived, 'remaining', v_remaining, 'done', v_remaining = 0);
end;
$$;

revoke execute on function public.undo_import_step(uuid, integer) from public, anon;
grant execute on function public.undo_import_step(uuid, integer) to authenticated;
