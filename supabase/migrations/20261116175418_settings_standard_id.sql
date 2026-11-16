-- The settings row used "true" as its id, but the activity log expects every
-- record to have a standard unique id (uuid), so changes to settings couldn't
-- be logged. Give it a normal id; a separate "singleton" column still
-- guarantees there is only ever one settings row.

alter table public.app_settings drop constraint app_settings_pkey;
alter table public.app_settings rename column id to singleton;
alter table public.app_settings add constraint app_settings_one_row unique (singleton);
alter table public.app_settings add column id uuid not null default gen_random_uuid();
alter table public.app_settings add primary key (id);
