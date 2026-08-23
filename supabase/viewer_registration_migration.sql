-- Public registration with Super Admin approval and a general read-only Viewer role.
-- Run after roles_and_auth_migration.sql. Existing inventory data is unchanged.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_check;
drop index if exists public.profiles_employee_viewer_idx;

update public.profiles set role = 'viewer', employee_id = null where role = 'employee_viewer';

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('super_admin', 'staff', 'viewer', 'pending'));

create or replace function public.is_inventory_reader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('super_admin', 'staff', 'viewer'), false);
$$;

create or replace function public.handle_new_inventory_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
begin
  if exists(select 1 from public.profiles) then
    v_role := 'pending';
    v_active := false;
  else
    v_role := 'super_admin';
    v_active := true;
  end if;
  insert into public.profiles(id, email, full_name, role, active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    v_role,
    v_active
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_role text;
  v_active boolean;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if found then return v_profile; end if;

  if exists(select 1 from public.profiles) then
    v_role := 'pending';
    v_active := false;
  else
    v_role := 'super_admin';
    v_active := true;
  end if;
  v_email := coalesce(auth.jwt() ->> 'email', '');
  insert into public.profiles(id, email, full_name, role, active)
  values (auth.uid(), v_email, split_part(v_email, '@', 1), v_role, v_active)
  returning * into v_profile;
  return v_profile;
end;
$$;

create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_role text,
  p_employee_id uuid,
  p_active boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_super_admin() then raise exception 'Only the Super Admin can manage user access'; end if;
  if p_role not in ('super_admin', 'staff', 'viewer', 'pending') then raise exception 'Invalid user role'; end if;
  if p_user_id = auth.uid() and (p_role <> 'super_admin' or not p_active) then
    raise exception 'You cannot remove your own Super Admin access';
  end if;

  update public.profiles
     set role = p_role,
         employee_id = null,
         active = case when p_role = 'pending' then false else p_active end,
         updated_at = now()
   where id = p_user_id
   returning * into v_profile;
  if not found then raise exception 'User profile not found'; end if;
  return v_profile;
end;
$$;

-- Replace Staff-only read policies with policies that also allow active Viewers.
do $$
declare t text;
begin
  foreach t in array array[
    'offices','suppliers','uacs_accounts','item_categories','employees','items','system_settings',
    'purchase_orders','inspection_acceptance_reports','requisition_issue_slips','rsmi_reports',
    'inventory_batches','ris_batch_allocations','stock_movements','rsmi_ris_records'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_reader', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_inventory_reader())', t || '_reader', t);
  end loop;
end $$;

drop policy if exists po_items_read on public.purchase_order_items;
create policy po_items_read on public.purchase_order_items for select to authenticated using (public.is_inventory_reader());
drop policy if exists iar_items_read on public.inspection_acceptance_items;
create policy iar_items_read on public.inspection_acceptance_items for select to authenticated using (public.is_inventory_reader());
drop policy if exists ris_items_read on public.requisition_issue_slip_items;
create policy ris_items_read on public.requisition_issue_slip_items for select to authenticated using (public.is_inventory_reader());
drop policy if exists property_units_staff_read on public.property_units;
create policy property_units_reader on public.property_units for select to authenticated using (public.is_inventory_reader());

revoke execute on function public.is_inventory_reader() from public, anon;
grant execute on function public.is_inventory_reader() to authenticated;

comment on function public.is_inventory_reader() is 'True for active Super Admin, Staff, and general read-only Viewer accounts.';
