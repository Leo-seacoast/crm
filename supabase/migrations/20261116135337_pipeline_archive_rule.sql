-- A pipeline can't be archived while it still has active deals
-- (otherwise those deals would vanish from every board).

create or replace function public.enforce_pipeline_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived_at is not null and old.archived_at is null
     and exists (select 1 from public.deals d where d.pipeline_id = new.id and d.archived_at is null) then
    raise exception 'Move or archive the deals in this pipeline before archiving it' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger pipelines_enforce_rules
  before update on public.pipelines
  for each row execute function public.enforce_pipeline_rules();

revoke execute on function public.enforce_pipeline_rules() from public, anon, authenticated;
