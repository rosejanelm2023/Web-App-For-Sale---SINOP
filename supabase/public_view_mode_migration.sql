-- Public read-only View Mode.
-- Exposes only the employee names and issued-property columns displayed on the viewer page.
-- No insert, update, delete, approval, or administrative capability is granted.

create or replace function public.public_viewer_employees()
returns table (
  id uuid,
  full_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select employee.id, employee.full_name
  from public.employees employee
  where employee.active = true
  order by employee.full_name;
$$;

create or replace function public.public_viewer_property()
returns table (
  id uuid,
  classification text,
  employee_id uuid,
  item_description text,
  brand text,
  model text,
  serial_number text,
  ppe_number text,
  inventory_number text,
  amount numeric,
  date_acquired date,
  supplier_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    property.id,
    property.classification::text,
    property.issued_to_employee_id,
    coalesce(nullif(property.item_description, ''), nullif(item.description, ''), item.item_name),
    coalesce(property.brand, ''),
    coalesce(property.model, ''),
    coalesce(property.serial_number, ''),
    coalesce(property.property_number, ''),
    coalesce(property.inventory_item_number, ''),
    property.acquisition_cost,
    property.date_acquired,
    supplier.supplier_name
  from public.property_units property
  join public.items item on item.id = property.item_id
  join public.suppliers supplier on supplier.id = property.supplier_id
  where property.issued_to_employee_id is not null
    and property.current_status <> 'Disposed'
    and property.classification in ('Semi-Expendable', 'Capital Outlay')
  order by property.date_acquired, property.property_sequence, property.inventory_sequence, property.id;
$$;

revoke all on function public.public_viewer_employees() from public;
revoke all on function public.public_viewer_property() from public;
grant execute on function public.public_viewer_employees() to anon, authenticated;
grant execute on function public.public_viewer_property() to anon, authenticated;

comment on function public.public_viewer_employees() is
  'Minimal employee list for the public, read-only View Mode.';
comment on function public.public_viewer_property() is
  'Minimal issued-property projection for the public, read-only View Mode.';
