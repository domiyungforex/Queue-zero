-- school_snapshot already selects school_profiles.programme, but the column
-- was never created because 20261111000000 failed before this alter ran.
alter table public.school_profiles
  add column if not exists programme text;

comment on column public.school_profiles.programme is
  'Optional academic programme. Null until a roster or profile sets it.';
