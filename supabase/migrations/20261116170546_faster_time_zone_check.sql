-- Faster time-zone check on contacts.
-- The previous check scanned Postgres's full list of ~1,200 time zones for every
-- contact saved, which made large imports too slow (Supabase stops any single
-- request after ~8 seconds). Now we:
--   1. only check when the time zone is new or changed, and
--   2. ask Postgres to convert a time into that zone — instant, and it still
--      refuses anything that isn't a real time zone.

create or replace function public.enforce_contact_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  by_person boolean := current_user in ('authenticated', 'anon');
begin
  -- Time zone must be a real one (e.g. America/New_York).
  if new.time_zone is not null and (tg_op = 'INSERT' or new.time_zone is distinct from old.time_zone) then
    if new.time_zone !~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+){0,2}$' then
      raise exception 'Unknown time zone: %', new.time_zone using errcode = '22023';
    end if;
    -- Raises "time zone ... not recognized" (also code 22023) if it isn't real.
    perform now() at time zone new.time_zone;
  end if;

  -- Tidy: no duplicate types.
  new.types := array(select distinct t from unnest(new.types) t order by t);

  if tg_op = 'INSERT' then
    if new.email_consent = 'unknown' then
      new.email_consent_at := null;
      new.email_consent_source := null;
    elsif by_person or new.email_consent_at is null then
      new.email_consent_at := now();
    end if;
    if new.sms_consent = 'unknown' then
      new.sms_consent_at := null;
      new.sms_consent_source := null;
    elsif by_person or new.sms_consent_at is null then
      new.sms_consent_at := now();
    end if;
    return new;
  end if;

  -- ---- UPDATE ----
  if new.email_consent is distinct from old.email_consent then
    if by_person and old.email_consent = 'opted_out' then
      raise exception 'This contact unsubscribed from email. Only the contact can opt back in.'
        using errcode = '42501';
    end if;
    if by_person and new.email_consent = 'unknown' then
      raise exception 'Email consent can''t be reset to "not asked" once recorded.'
        using errcode = '42501';
    end if;
    if by_person or new.email_consent_at is not distinct from old.email_consent_at then
      new.email_consent_at := now();
    end if;
  elsif by_person then
    new.email_consent_at := old.email_consent_at;
    new.email_consent_source := old.email_consent_source;
  end if;

  if new.sms_consent is distinct from old.sms_consent then
    if by_person and old.sms_consent = 'opted_out' then
      raise exception 'This contact opted out of SMS. Only the contact can opt back in.'
        using errcode = '42501';
    end if;
    if by_person and new.sms_consent = 'unknown' then
      raise exception 'SMS consent can''t be reset to "not asked" once recorded.'
        using errcode = '42501';
    end if;
    if by_person or new.sms_consent_at is not distinct from old.sms_consent_at then
      new.sms_consent_at := now();
    end if;
  elsif by_person then
    new.sms_consent_at := old.sms_consent_at;
    new.sms_consent_source := old.sms_consent_source;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_contact_rules() from public, anon, authenticated;
