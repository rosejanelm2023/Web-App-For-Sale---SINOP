-- Authentication and role-based access for the Inventory and Property Management System.
-- Run this file once in the Supabase SQL Editor after the other schema migrations.
-- Existing inventory records are not changed or deleted.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'staff' check (role in ('super_admin', 'staff', 'employee_viewer')),
  employee_id uuid references public.employees(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role <> 'employee_viewer' or employee_id is not null)
);

create unique index if not exists profiles_employee_viewer_idx
  on public.profiles(employee_id)
  where employee_id is not null and role = 'employee_viewer';

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

create or replace function public.is_active_inventory_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'super_admin', false);
$$;

create or replace function public.is_inventory_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('super_admin', 'staff'), false);
$$;

create or replace function public.handle_new_inventory_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select case when exists(select 1 from public.profiles) then 'staff' else 'super_admin' end into v_role;
  insert into public.profiles(id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    v_role
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_inventory_profile on auth.users;
create trigger on_auth_user_created_inventory_profile
after insert or update of email on auth.users
for each row execute function public.handle_new_inventory_user();

create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_role text;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if found then return v_profile; end if;

  select case when exists(select 1 from public.profiles) then 'staff' else 'super_admin' end into v_role;
  v_email := coalesce(auth.jwt() ->> 'email', '');
  insert into public.profiles(id, email, full_name, role)
  values (auth.uid(), v_email, split_part(v_email, '@', 1), v_role)
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
  if p_role not in ('super_admin', 'staff', 'employee_viewer') then raise exception 'Invalid user role'; end if;
  if p_role = 'employee_viewer' and p_employee_id is null then
    raise exception 'An Employee Viewer must be linked to an employee';
  end if;
  if p_user_id = auth.uid() and (p_role <> 'super_admin' or not p_active) then
    raise exception 'You cannot remove your own Super Admin access';
  end if;

  update public.profiles
     set role = p_role,
         employee_id = case when p_role = 'employee_viewer' then p_employee_id else null end,
         active = p_active,
         updated_at = now()
   where id = p_user_id
   returning * into v_profile;
  if not found then raise exception 'User profile not found'; end if;
  return v_profile;
end;
$$;

create or replace function public.my_issued_property()
returns table (
  id uuid,
  classification text,
  property_or_inventory_number text,
  item_name text,
  description text,
  brand text,
  model text,
  serial_number text,
  date_acquired date,
  issued_at timestamptz,
  condition text,
  current_status text,
  employee_name text,
  employee_position text,
  office_name text,
  other_information text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pu.id,
    pu.classification::text,
    coalesce(pu.inventory_item_number, pu.property_number),
    i.item_name,
    coalesce(pu.item_description, i.description),
    pu.brand,
    pu.model,
    pu.serial_number,
    pu.date_acquired,
    pu.issued_at,
    pu.condition,
    pu.current_status::text,
    e.full_name,
    e.plantilla_position,
    o.name,
    pu.other_info
  from public.profiles p
  join public.employees e on e.id = p.employee_id
  join public.property_units pu on pu.issued_to_employee_id = e.id
  join public.items i on i.id = pu.item_id
  left join public.offices o on o.id = pu.office_id
  where p.id = auth.uid()
    and p.active
    and p.role = 'employee_viewer'
    and pu.current_status = 'Issued'
  order by i.item_name, coalesce(pu.inventory_item_number, pu.property_number);
$$;

create or replace function public.enforce_inventory_workflow_role()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.is_super_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if public.current_app_role() <> 'staff' then raise exception 'This action is not allowed for your account'; end if;
  if tg_op = 'DELETE' then raise exception 'Only the Super Admin can delete transactions'; end if;
  if new.status::text <> 'Draft' then raise exception 'Only the Super Admin can approve, post, complete, cancel, or unpost transactions'; end if;
  if tg_op = 'UPDATE' and old.status::text <> 'Draft' then raise exception 'Only the Super Admin can change a posted transaction'; end if;
  return new;
end;
$$;

create or replace function public.enforce_property_editor_role()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_inventory_staff() then raise exception 'This property action is not allowed for your account'; end if;
  if tg_op = 'DELETE' and not public.is_super_admin() then raise exception 'Only the Super Admin can delete property records'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists purchase_orders_role_guard on public.purchase_orders;
create trigger purchase_orders_role_guard before insert or update or delete on public.purchase_orders
for each row execute function public.enforce_inventory_workflow_role();
drop trigger if exists iar_role_guard on public.inspection_acceptance_reports;
create trigger iar_role_guard before insert or update or delete on public.inspection_acceptance_reports
for each row execute function public.enforce_inventory_workflow_role();
drop trigger if exists ris_role_guard on public.requisition_issue_slips;
create trigger ris_role_guard before insert or update or delete on public.requisition_issue_slips
for each row execute function public.enforce_inventory_workflow_role();
drop trigger if exists rsmi_role_guard on public.rsmi_reports;
create trigger rsmi_role_guard before insert or update or delete on public.rsmi_reports
for each row execute function public.enforce_inventory_workflow_role();
drop trigger if exists property_units_role_guard on public.property_units;
create trigger property_units_role_guard before insert or update or delete on public.property_units
for each row execute function public.enforce_property_editor_role();

-- Remove the previous universal authenticated policies before defining role policies.
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.profiles enable row level security;
create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using (id = auth.uid() or public.is_super_admin());
grant select on public.profiles to authenticated;

-- Master data: Super Admin and Staff can view, create, and edit. Only Super Admin can delete.
do $$
declare t text;
begin
  foreach t in array array['offices','suppliers','uacs_accounts','item_categories','employees','items','system_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_inventory_staff())', t || '_staff_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_inventory_staff())', t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_inventory_staff()) with check (public.is_inventory_staff())', t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_super_admin())', t || '_admin_delete', t);
  end loop;
end $$;

-- Document headers: Staff can create and edit Drafts; Super Admin controls all posted states and deletion.
do $$
declare t text;
begin
  foreach t in array array['purchase_orders','inspection_acceptance_reports','requisition_issue_slips','rsmi_reports']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_inventory_staff())', t || '_staff_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_super_admin() or (public.current_app_role() = ''staff'' and status::text = ''Draft''))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_super_admin() or (public.current_app_role() = ''staff'' and status::text = ''Draft'')) with check (public.is_super_admin() or (public.current_app_role() = ''staff'' and status::text = ''Draft''))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_super_admin())', t || '_admin_delete', t);
  end loop;
end $$;

-- Draft document lines remain editable by Staff. Cascaded or direct deletion of posted data is Super Admin-only.
alter table public.purchase_order_items enable row level security;
grant select, insert, update, delete on public.purchase_order_items to authenticated;
create policy po_items_read on public.purchase_order_items for select to authenticated using (public.is_inventory_staff());
create policy po_items_insert on public.purchase_order_items for insert to authenticated with check (
  public.is_super_admin() or exists(select 1 from public.purchase_orders p where p.id = purchase_order_id and p.status::text = 'Draft' and public.current_app_role() = 'staff')
);
create policy po_items_update on public.purchase_order_items for update to authenticated using (
  public.is_super_admin() or exists(select 1 from public.purchase_orders p where p.id = purchase_order_id and p.status::text = 'Draft' and public.current_app_role() = 'staff')
) with check (
  public.is_super_admin() or exists(select 1 from public.purchase_orders p where p.id = purchase_order_id and p.status::text = 'Draft' and public.current_app_role() = 'staff')
);
create policy po_items_delete on public.purchase_order_items for delete to authenticated using (
  public.is_super_admin() or exists(select 1 from public.purchase_orders p where p.id = purchase_order_id and p.status::text = 'Draft' and public.current_app_role() = 'staff')
);

alter table public.inspection_acceptance_items enable row level security;
grant select, insert, update, delete on public.inspection_acceptance_items to authenticated;
create policy iar_items_read on public.inspection_acceptance_items for select to authenticated using (public.is_inventory_staff());
create policy iar_items_insert on public.inspection_acceptance_items for insert to authenticated with check (
  public.is_super_admin() or exists(select 1 from public.inspection_acceptance_reports r where r.id = iar_id and r.status::text = 'Draft' and public.current_app_role() = 'staff')
);
create policy iar_items_update on public.inspection_acceptance_items for update to authenticated using (
  public.is_super_admin() or exists(select 1 from public.inspection_acceptance_reports r where r.id = iar_id and r.status::text = 'Draft' and public.current_app_role() = 'staff')
) with check (
  public.is_super_admin() or exists(select 1 from public.inspection_acceptance_reports r where r.id = iar_id and r.status::text = 'Draft' and public.current_app_role() = 'staff')
);
create policy iar_items_delete on public.inspection_acceptance_items for delete to authenticated using (
  public.is_super_admin() or exists(select 1 from public.inspection_acceptance_reports r where r.id = iar_id and r.status::text = 'Draft' and public.current_app_role() = 'staff')
);

alter table public.requisition_issue_slip_items enable row level security;
grant select, insert, update, delete on public.requisition_issue_slip_items to authenticated;
create policy ris_items_read on public.requisition_issue_slip_items for select to authenticated using (public.is_inventory_staff());
create policy ris_items_insert on public.requisition_issue_slip_items for insert to authenticated with check (
  public.is_super_admin() or exists(select 1 from public.requisition_issue_slips r where r.id = ris_id and r.status::text = 'Draft' and public.current_app_role() = 'staff')
);
create policy ris_items_update on public.requisition_issue_slip_items for update to authenticated using (
  public.is_super_admin() or exists(select 1 from public.requisition_issue_slips r where r.id = ris_id and r.status::text = 'Draft' and public.current_app_role() = 'staff')
) with check (
  public.is_super_admin() or exists(select 1 from public.requisition_issue_slips r where r.id = ris_id and r.status::text = 'Draft' and public.current_app_role() = 'staff')
);
create policy ris_items_delete on public.requisition_issue_slip_items for delete to authenticated using (
  public.is_super_admin() or exists(select 1 from public.requisition_issue_slips r where r.id = ris_id and r.status::text = 'Draft' and public.current_app_role() = 'staff')
);

-- System-created inventory data is readable by Staff. Property records may be edited, but only Super Admin may delete them.
do $$
declare t text;
begin
  foreach t in array array['inventory_batches','ris_batch_allocations','stock_movements','rsmi_ris_records','audit_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_inventory_staff())', t || '_staff_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin())', t || '_admin_write', t);
  end loop;
end $$;

alter table public.property_units enable row level security;
grant select, insert, update, delete on public.property_units to authenticated;
create policy property_units_staff_read on public.property_units for select to authenticated using (public.is_inventory_staff());
create policy property_units_staff_update on public.property_units for update to authenticated using (public.is_inventory_staff()) with check (public.is_inventory_staff());
create policy property_units_admin_insert on public.property_units for insert to authenticated with check (public.is_super_admin());
create policy property_units_admin_delete on public.property_units for delete to authenticated using (public.is_super_admin());

revoke execute on all functions in schema public from anon, public;
grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.admin_update_profile(uuid, text, uuid, boolean) to authenticated;
grant execute on function public.my_issued_property() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_active_inventory_user() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_inventory_staff() to authenticated;

-- Existing workflow functions remain callable, but the role guard rejects Staff approval/post/unpost operations.
grant execute on function public.complete_iar(uuid, text) to authenticated;
grant execute on function public.complete_ris(uuid, text) to authenticated;
grant execute on function public.finalize_rsmi(uuid, uuid[], text) to authenticated;
grant execute on function public.issue_semi_expendable_property(uuid, uuid, uuid, boolean, text, text, text, text, text, text, text, text, text) to authenticated;

comment on table public.profiles is 'Application roles and optional employee links for Supabase-authenticated users.';
comment on function public.my_issued_property() is 'Returns only property currently issued to the signed-in Employee Viewer.';
