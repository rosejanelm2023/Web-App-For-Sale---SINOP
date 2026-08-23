-- Staff profile completion and private profile photos.
-- Safe to run after viewer_registration_migration.sql. Existing inventory records are unchanged.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists middle_initial text,
  add column if not exists last_name text,
  add column if not exists display_name text,
  add column if not exists avatar_path text,
  add column if not exists profile_completed boolean not null default false;

insert into public.system_settings (setting_key, text_value, description)
values ('office_name', 'Your Agency', 'Official entity name printed on government inventory and property forms.')
on conflict (setting_key) do update
set text_value = excluded.text_value,
    description = excluded.description,
    updated_at = now();

create or replace function public.save_my_profile(
  p_first_name text,
  p_middle_initial text,
  p_last_name text,
  p_display_name text,
  p_avatar_path text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_first text := trim(coalesce(p_first_name, ''));
  v_middle text := upper(trim(coalesce(p_middle_initial, '')));
  v_last text := trim(coalesce(p_last_name, ''));
  v_display text := trim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if v_first = '' then raise exception 'First name is required'; end if;
  if v_last = '' then raise exception 'Last name is required'; end if;
  if v_display = '' then raise exception 'Display name is required'; end if;
  if length(v_middle) > 2 then raise exception 'Middle initial must contain at most two characters'; end if;

  update public.profiles
     set first_name = v_first,
         middle_initial = nullif(v_middle, ''),
         last_name = v_last,
         display_name = v_display,
         full_name = concat_ws(' ', v_first, nullif(v_middle, ''), v_last),
         avatar_path = coalesce(nullif(trim(coalesce(p_avatar_path, '')), ''), avatar_path),
         profile_completed = true,
         updated_at = now()
   where id = auth.uid()
   returning * into v_profile;

  if not found then raise exception 'User profile not found'; end if;
  return v_profile;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 3145728, array['image/png','image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_photos_read_own on storage.objects;
create policy profile_photos_read_own on storage.objects
for select to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists profile_photos_insert_own on storage.objects;
create policy profile_photos_insert_own on storage.objects
for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists profile_photos_update_own on storage.objects;
create policy profile_photos_update_own on storage.objects
for update to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists profile_photos_delete_own on storage.objects;
create policy profile_photos_delete_own on storage.objects
for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

revoke execute on function public.save_my_profile(text, text, text, text, text) from public, anon;
grant execute on function public.save_my_profile(text, text, text, text, text) to authenticated;

comment on function public.save_my_profile(text, text, text, text, text)
is 'Lets an authenticated user complete or update their own simple account profile.';
