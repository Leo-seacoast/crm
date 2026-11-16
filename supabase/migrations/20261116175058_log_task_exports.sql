-- Tasks can now be exported to CSV, so exports of tasks must be recorded too.

create or replace function public.log_export(p_table text, p_row_count integer, p_filters jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can export data' using errcode = '42501';
  end if;
  if p_table not in ('contacts', 'companies', 'deals', 'notes', 'tasks', 'activity_log') then
    raise exception 'Unknown export' using errcode = '22023';
  end if;
  if p_row_count is null or p_row_count < 0 then
    raise exception 'Invalid row count' using errcode = '22023';
  end if;

  insert into public.activity_log (actor_type, actor_id, action, table_name, record_id, changes, context)
  values (
    'user',
    (select auth.uid()),
    'export',
    p_table,
    null,
    null,
    jsonb_build_object('rows', p_row_count, 'filters', coalesce(p_filters, '{}'::jsonb))
  );
end;
$$;

revoke execute on function public.log_export(text, integer, jsonb) from public, anon;
grant execute on function public.log_export(text, integer, jsonb) to authenticated;
