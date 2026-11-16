-- =============================================================================
-- GHL IDs: remember each record's permanent GoHighLevel ID.
-- - Re-importing the same GHL file matches people even when they have no
--   email or phone (otherwise they'd be duplicated).
-- - GHL's opportunities export links deals to contacts by this ID (next step).
-- =============================================================================

alter table public.contacts  add column ghl_id text check (char_length(ghl_id) between 1 and 100);
alter table public.companies add column ghl_id text check (char_length(ghl_id) between 1 and 100);
alter table public.deals     add column ghl_id text check (char_length(ghl_id) between 1 and 100);

-- One active record per GHL ID.
create unique index contacts_ghl_id_unique  on public.contacts (ghl_id)  where ghl_id is not null and archived_at is null;
create unique index companies_ghl_id_unique on public.companies (ghl_id) where ghl_id is not null and archived_at is null;
create unique index deals_ghl_id_unique     on public.deals (ghl_id)     where ghl_id is not null and archived_at is null;


-- Duplicate check now also matches on GHL ID.
drop function public.find_existing_contacts(text[], text[]);

create or replace function public.find_existing_contacts(p_emails text[], p_phones text[], p_ghl_ids text[])
returns table (id uuid, email text, phone text, ghl_id text, first_name text, last_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.email, c.phone, c.ghl_id, c.first_name, c.last_name
  from public.contacts c
  where c.archived_at is null
    and (lower(c.email) = any (p_emails) or c.phone = any (p_phones) or c.ghl_id = any (p_ghl_ids))
  limit 20000;
$$;

revoke execute on function public.find_existing_contacts(text[], text[], text[]) from public, anon;
grant execute on function public.find_existing_contacts(text[], text[], text[]) to authenticated;


-- Import batch: same as before, plus the GHL ID.
create or replace function public.import_contacts_batch(p_import_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          jsonb;
  v_created  integer := 0;
  v_updated  integer := 0;
  v_skipped  integer := 0;
  v_errors   jsonb := '[]'::jsonb;
  v_types    public.contact_type[];
  v_tags     text[];
  v_email_c  public.consent_status;
  v_sms_c    public.consent_status;
begin
  perform public.require_admin();
  perform public.require_open_import(p_import_id, 'contacts');
  perform public.begin_import_context(p_import_id, 'contacts');

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'Send between 1 and 1000 rows at a time' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    begin
      v_types := coalesce(array(select jsonb_array_elements_text(coalesce(r -> 'types', '[]')))::public.contact_type[], '{}');
      v_tags  := coalesce(array(select left(t, 50) from jsonb_array_elements_text(coalesce(r -> 'tags', '[]')) t limit 50), '{}');
      v_email_c := coalesce(nullif(r ->> 'email_consent', ''), 'unknown')::public.consent_status;
      v_sms_c   := coalesce(nullif(r ->> 'sms_consent', ''), 'unknown')::public.consent_status;

      if v_email_c = 'opted_in' or v_sms_c = 'opted_in' then
        raise exception 'An import cannot mark anyone as opted in' using errcode = '42501';
      end if;

      if r ->> 'action' = 'create' then
        insert into public.contacts (
          first_name, last_name, email, phone, ghl_id, types, company_id,
          address_line1, address_line2, city, region, postal_code, country,
          time_zone, source, tags, extra_fields,
          email_consent, email_consent_at, email_consent_source,
          sms_consent, sms_consent_at, sms_consent_source,
          created_at, import_id
        ) values (
          nullif(r ->> 'first_name', ''), nullif(r ->> 'last_name', ''),
          nullif(lower(r ->> 'email'), ''), nullif(r ->> 'phone', ''), nullif(r ->> 'ghl_id', ''),
          v_types, nullif(r ->> 'company_id', '')::uuid,
          nullif(r ->> 'address_line1', ''), nullif(r ->> 'address_line2', ''),
          nullif(r ->> 'city', ''), nullif(r ->> 'region', ''),
          nullif(r ->> 'postal_code', ''), nullif(r ->> 'country', ''),
          nullif(r ->> 'time_zone', ''), coalesce(nullif(r ->> 'source', ''), 'GHL import'),
          v_tags, coalesce(r -> 'extra_fields', '{}'::jsonb),
          v_email_c, case when v_email_c = 'opted_out' then now() end,
          case when v_email_c = 'opted_out' then 'GHL import (DND)' end,
          v_sms_c, case when v_sms_c = 'opted_out' then now() end,
          case when v_sms_c = 'opted_out' then 'GHL import (DND)' end,
          coalesce(nullif(r ->> 'created_at', '')::timestamptz, now()),
          p_import_id
        );
        v_created := v_created + 1;

      elsif r ->> 'action' = 'update' then
        update public.contacts c set
          first_name    = coalesce(nullif(c.first_name, ''), nullif(r ->> 'first_name', '')),
          last_name     = coalesce(nullif(c.last_name, ''), nullif(r ->> 'last_name', '')),
          email         = coalesce(c.email, nullif(lower(r ->> 'email'), '')),
          phone         = coalesce(c.phone, nullif(r ->> 'phone', '')),
          ghl_id        = coalesce(c.ghl_id, nullif(r ->> 'ghl_id', '')),
          types         = array(select distinct t from unnest(c.types || v_types) t),
          company_id    = coalesce(c.company_id, nullif(r ->> 'company_id', '')::uuid),
          address_line1 = coalesce(c.address_line1, nullif(r ->> 'address_line1', '')),
          address_line2 = coalesce(c.address_line2, nullif(r ->> 'address_line2', '')),
          city          = coalesce(c.city, nullif(r ->> 'city', '')),
          region        = coalesce(c.region, nullif(r ->> 'region', '')),
          postal_code   = coalesce(c.postal_code, nullif(r ->> 'postal_code', '')),
          country       = coalesce(c.country, nullif(r ->> 'country', '')),
          time_zone     = coalesce(c.time_zone, nullif(r ->> 'time_zone', '')),
          tags          = array(select distinct t from unnest(c.tags || v_tags) t limit 50),
          extra_fields  = coalesce(r -> 'extra_fields', '{}'::jsonb) || c.extra_fields,
          email_consent = case when v_email_c = 'opted_out' and c.email_consent <> 'opted_out' then 'opted_out' else c.email_consent end,
          email_consent_at = case when v_email_c = 'opted_out' and c.email_consent <> 'opted_out' then now() else c.email_consent_at end,
          email_consent_source = case when v_email_c = 'opted_out' and c.email_consent <> 'opted_out' then 'GHL import (DND)' else c.email_consent_source end,
          sms_consent   = case when v_sms_c = 'opted_out' and c.sms_consent <> 'opted_out' then 'opted_out' else c.sms_consent end,
          sms_consent_at = case when v_sms_c = 'opted_out' and c.sms_consent <> 'opted_out' then now() else c.sms_consent_at end,
          sms_consent_source = case when v_sms_c = 'opted_out' and c.sms_consent <> 'opted_out' then 'GHL import (DND)' else c.sms_consent_source end
        where c.id = (r ->> 'target_id')::uuid and c.archived_at is null;

        if found then v_updated := v_updated + 1; else v_skipped := v_skipped + 1; end if;

      else
        v_skipped := v_skipped + 1;
      end if;

    exception
      when unique_violation then
        v_errors := v_errors || jsonb_build_object('row', r -> 'row', 'message', 'Another contact already has this email, phone or GHL ID');
      when others then
        v_errors := v_errors || jsonb_build_object('row', r -> 'row', 'message', left(sqlerrm, 200));
    end;
  end loop;

  update public.imports i set
    created_count = i.created_count + v_created,
    updated_count = i.updated_count + v_updated,
    skipped_count = i.skipped_count + v_skipped,
    error_count   = i.error_count + jsonb_array_length(v_errors)
  where i.id = p_import_id;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped, 'errors', v_errors);
end;
$$;

revoke execute on function public.import_contacts_batch(uuid, jsonb) from public, anon;
grant execute on function public.import_contacts_batch(uuid, jsonb) to authenticated;
