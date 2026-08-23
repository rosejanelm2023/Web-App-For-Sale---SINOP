-- Philippine Government Inventory Management System
-- PostgreSQL / Supabase schema
-- All currency uses numeric; important document operations are transactional RPCs.

create extension if not exists pgcrypto;

create type po_status as enum ('Draft', 'Completed', 'Cancelled');
create type iar_status as enum ('Draft', 'Partially Inspected', 'Completed', 'Rejected', 'Cancelled');
create type ris_status as enum ('Draft', 'Completed', 'Cancelled');
create type rsmi_status as enum ('Draft', 'Finalized', 'Cancelled');
create type item_classification as enum ('Expendable', 'Semi-Expendable', 'Capital Outlay');
create type category_rule as enum (
  'Always Expendable',
  'Always Semi-Expendable',
  'Always Capital Outlay',
  'Determine using acquisition-cost threshold'
);
create type property_status as enum (
  'Available', 'Issued', 'Under Repair', 'Returned',
  'Unserviceable', 'Transferred', 'Disposed'
);
create type movement_type as enum (
  'Receipt from IAR', 'Issue through RIS', 'Adjustment In',
  'Adjustment Out', 'Cancellation or Reversal'
);

create table offices (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null unique,
  address text,
  contact_person text,
  contact_number text,
  email text,
  tax_identification_number text unique,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table uacs_accounts (
  id uuid primary key default gen_random_uuid(),
  uacs_code text not null unique,
  account_title text not null,
  account_category text not null,
  ppe_sub_major text,
  gl_account text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table item_categories (
  id uuid primary key default gen_random_uuid(),
  category_name text not null unique,
  description text,
  classification_rule category_rule not null,
  default_classification item_classification,
  threshold_based_classification_enabled boolean not null default false,
  useful_life_requirement_years numeric(8,2) check (useful_life_requirement_years is null or useful_life_requirement_years >= 0),
  qualifies_as_ppe boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (classification_rule = 'Determine using acquisition-cost threshold' and threshold_based_classification_enabled)
    or classification_rule <> 'Determine using acquisition-cost threshold'
  )
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null unique,
  full_name text not null,
  plantilla_position text not null,
  office_id uuid not null references offices(id),
  employment_status text not null default 'Permanent',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  item_code text not null unique,
  item_name text not null,
  description text,
  category_id uuid not null references item_categories(id),
  unit_of_measure text not null,
  default_uacs_account_id uuid references uacs_accounts(id),
  reorder_level numeric(18,3) not null default 0 check (reorder_level >= 0),
  useful_life_years numeric(8,2) check (useful_life_years is null or useful_life_years >= 0),
  default_classification item_classification,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table system_settings (
  setting_key text primary key,
  numeric_value numeric(18,2),
  text_value text,
  json_value jsonb,
  description text,
  updated_at timestamptz not null default now()
);

insert into system_settings (setting_key, numeric_value, description) values
  ('capitalization_threshold', 50000.00, 'Acquisition cost threshold applied to each individual accepted item.'),
  ('current_reporting_year', 2026, 'Current reporting year used for document numbering.')
on conflict (setting_key) do nothing;

insert into system_settings (setting_key, text_value, description) values
  ('office_name', 'Sample Philippine Government Office', 'Printed office name.'),
  ('office_address', 'Manila, Philippines', 'Printed office address.'),
  ('default_fund_source', 'Regular Fund 01', 'Current default fund source for new purchase orders.'),
  ('default_delivery_location', '3rd Floor Esquina Dos Bldg, J.C. Aquino Ave, Butuan City', 'Permanent delivery location for purchase orders.')
on conflict (setting_key) do nothing;

insert into system_settings (setting_key, json_value, description) values
  ('default_report_signatories', '{"prepared_by":"","certified_by":"","approved_by":""}', 'Configurable report signatories.')
on conflict (setting_key) do nothing;

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  po_date date not null,
  supplier_id uuid not null references suppliers(id),
  supplier_address text,
  purchase_request_number text,
  purpose text,
  mode_of_procurement text,
  delivery_location text,
  delivery_period text,
  fund_source text,
  uacs_account_id uuid references uacs_accounts(id),
  remarks text,
  status po_status not null default 'Draft',
  performed_by text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'Cancelled' or nullif(trim(cancellation_reason), '') is not null)
);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  item_id uuid not null references items(id),
  item_description text,
  quantity_ordered numeric(18,3) not null check (quantity_ordered > 0),
  unit_cost numeric(18,2) not null check (unit_cost >= 0),
  total_cost numeric(18,2) generated always as (quantity_ordered * unit_cost) stored,
  brand text,
  model text,
  specifications text,
  remarks text,
  unique (purchase_order_id, line_number)
);

create table inspection_acceptance_reports (
  id uuid primary key default gen_random_uuid(),
  iar_number text not null unique,
  iar_date date not null,
  purchase_order_id uuid not null references purchase_orders(id),
  invoice_number text,
  invoice_date date,
  delivery_receipt_number text,
  delivery_receipt_date date,
  inspection_date date,
  acceptance_date date,
  inspection_status text,
  acceptance_status text,
  remarks text,
  status iar_status not null default 'Draft',
  performed_by text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'Cancelled' or nullif(trim(cancellation_reason), '') is not null)
);

create table inspection_acceptance_items (
  id uuid primary key default gen_random_uuid(),
  iar_id uuid not null references inspection_acceptance_reports(id) on delete cascade,
  purchase_order_item_id uuid not null references purchase_order_items(id),
  quantity_delivered numeric(18,3) not null default 0 check (quantity_delivered >= 0),
  quantity_inspected numeric(18,3) not null default 0 check (quantity_inspected >= 0),
  quantity_accepted numeric(18,3) not null default 0 check (quantity_accepted >= 0),
  quantity_rejected numeric(18,3) not null default 0 check (quantity_rejected >= 0),
  condition text,
  remarks text,
  system_classification item_classification,
  final_classification item_classification,
  classification_override_reason text,
  processed_at timestamptz,
  unique (iar_id, purchase_order_item_id),
  check (quantity_inspected <= quantity_delivered),
  check (quantity_accepted + quantity_rejected <= quantity_inspected),
  check (
    final_classification is null
    or system_classification is null
    or final_classification = system_classification
    or nullif(trim(classification_override_reason), '') is not null
  )
);

create table inventory_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null unique,
  item_id uuid not null references items(id),
  source_iar_item_id uuid not null unique references inspection_acceptance_items(id),
  date_received date not null,
  quantity_received numeric(18,3) not null check (quantity_received > 0),
  quantity_remaining numeric(18,3) not null check (quantity_remaining >= 0 and quantity_remaining <= quantity_received),
  unit_cost numeric(18,2) not null check (unit_cost >= 0),
  total_value numeric(18,2) generated always as (quantity_received * unit_cost) stored,
  status text not null default 'Open' check (status in ('Open', 'Depleted', 'Cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table property_units (
  id uuid primary key default gen_random_uuid(),
  source_iar_item_id uuid not null references inspection_acceptance_items(id),
  unit_sequence integer not null check (unit_sequence > 0),
  classification item_classification not null check (classification in ('Semi-Expendable', 'Capital Outlay')),
  item_id uuid not null references items(id),
  item_description text,
  item_category_id uuid not null references item_categories(id),
  brand text,
  model text,
  serial_number text,
  property_number text,
  property_number_year integer,
  property_sequence integer,
  par_number text,
  par_year integer,
  par_sequence integer,
  ics_number text,
  ics_year integer,
  ics_sequence integer,
  inventory_item_number text,
  inventory_sequence integer,
  acquisition_cost numeric(18,2) not null check (acquisition_cost >= 0),
  supplier_id uuid not null references suppliers(id),
  purchase_order_id uuid not null references purchase_orders(id),
  iar_id uuid not null references inspection_acceptance_reports(id),
  date_acquired date not null,
  date_accepted date not null,
  uacs_account_id uuid references uacs_accounts(id),
  fund_source text,
  current_status property_status not null default 'Available',
  current_location text,
  issued_to_employee_id uuid references employees(id),
  ics_issued_by_employee_id uuid references employees(id),
  ics_approved_by_employee_id uuid references employees(id),
  employee_plantilla_position text,
  office_id uuid references offices(id),
  condition text not null default 'Serviceable' check (condition in ('Serviceable', 'Unserviceable', 'Repair')),
  other_info text,
  issued_at timestamptz,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_iar_item_id, unit_sequence),
  unique (classification, property_number),
  unique (par_number),
  unique (classification, uacs_account_id, property_number_year, property_sequence),
  unique (ics_number),
  unique (inventory_item_number),
  unique (ics_year, ics_sequence),
  unique (uacs_account_id, inventory_sequence),
  check (property_number is null or nullif(trim(property_number), '') is not null)
);

create table requisition_issue_slips (
  id uuid primary key default gen_random_uuid(),
  ris_number text not null unique,
  ris_date date not null,
  requesting_office_id uuid not null references offices(id),
  purpose text,
  requested_by_employee_id uuid references employees(id),
  approved_by text,
  issued_by text,
  received_by text,
  status ris_status not null default 'Draft',
  remarks text,
  performed_by text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'Cancelled' or nullif(trim(cancellation_reason), '') is not null)
);

create table requisition_issue_slip_items (
  id uuid primary key default gen_random_uuid(),
  ris_id uuid not null references requisition_issue_slips(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  item_id uuid not null references items(id),
  quantity_requested numeric(18,3) not null check (quantity_requested > 0),
  quantity_issued numeric(18,3) not null default 0 check (quantity_issued >= 0 and quantity_issued <= quantity_requested),
  remarks text,
  processed_at timestamptz,
  unique (ris_id, line_number)
);

create table ris_batch_allocations (
  id uuid primary key default gen_random_uuid(),
  ris_item_id uuid not null references requisition_issue_slip_items(id),
  inventory_batch_id uuid not null references inventory_batches(id),
  quantity numeric(18,3) not null check (quantity > 0),
  unit_cost numeric(18,2) not null check (unit_cost >= 0),
  total_value numeric(18,2) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now(),
  unique (ris_item_id, inventory_batch_id)
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_date timestamptz not null default now(),
  item_id uuid not null references items(id),
  transaction_type movement_type not null,
  reference_document text not null,
  reference_number text not null,
  quantity_received numeric(18,3) not null default 0 check (quantity_received >= 0),
  quantity_issued numeric(18,3) not null default 0 check (quantity_issued >= 0),
  unit_cost numeric(18,2) not null check (unit_cost >= 0),
  total_value numeric(18,2) not null,
  running_quantity_balance numeric(18,3) not null,
  running_value_balance numeric(18,2) not null,
  inventory_batch_id uuid references inventory_batches(id),
  remarks text,
  created_at timestamptz not null default now(),
  check ((quantity_received > 0 and quantity_issued = 0) or (quantity_issued > 0 and quantity_received = 0))
);

create table rsmi_reports (
  id uuid primary key default gen_random_uuid(),
  rsmi_number text not null unique,
  reporting_period_start date not null,
  reporting_period_end date not null,
  date_prepared date not null,
  status rsmi_status not null default 'Draft',
  prepared_by text,
  remarks text,
  performed_by text,
  finalized_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporting_period_end >= reporting_period_start),
  check (status <> 'Cancelled' or nullif(trim(cancellation_reason), '') is not null)
);

create table rsmi_ris_records (
  id uuid primary key default gen_random_uuid(),
  rsmi_id uuid not null references rsmi_reports(id) on delete cascade,
  ris_id uuid not null unique references requisition_issue_slips(id),
  included_at timestamptz not null default now(),
  unique (rsmi_id, ris_id)
);

create table audit_logs (
  id bigint generated always as identity primary key,
  action_at timestamptz not null default now(),
  performed_by text not null,
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  reference_number text,
  reason text,
  before_data jsonb,
  after_data jsonb
);

create index employees_office_idx on employees (office_id, active);
create index items_category_idx on items (category_id, active);
create index po_supplier_date_idx on purchase_orders (supplier_id, po_date);
create index po_items_po_idx on purchase_order_items (purchase_order_id);
create index iar_po_idx on inspection_acceptance_reports (purchase_order_id, iar_date);
create index iar_items_po_line_idx on inspection_acceptance_items (purchase_order_item_id);
create index inventory_batches_fifo_idx on inventory_batches (item_id, date_received, created_at, id) where quantity_remaining > 0 and status = 'Open';
create index property_units_classification_idx on property_units (classification, current_status);
create index property_units_employee_idx on property_units (issued_to_employee_id);
create index ris_office_date_idx on requisition_issue_slips (requesting_office_id, ris_date);
create index stock_movements_item_date_idx on stock_movements (item_id, movement_date);
create index rsmi_period_idx on rsmi_reports (reporting_period_start, reporting_period_end, status);
create index audit_entity_idx on audit_logs (entity_type, entity_id, action_at);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'offices','suppliers','uacs_accounts','item_categories','employees','items',
    'purchase_orders','inspection_acceptance_reports','inventory_batches',
    'property_units','requisition_issue_slips','rsmi_reports'
  ]
  loop
    execute format(
      'create trigger %I before update on %I for each row execute function set_updated_at()',
      table_name || '_updated_at', table_name
    );
  end loop;
end;
$$;

create or replace function classify_item(p_item_id uuid, p_unit_cost numeric)
returns item_classification language plpgsql stable as $$
declare
  v_rule category_rule;
  v_default item_classification;
  v_useful_life numeric;
  v_ppe boolean;
  v_threshold numeric;
begin
  select c.classification_rule, coalesce(i.default_classification, c.default_classification),
         coalesce(i.useful_life_years, c.useful_life_requirement_years), c.qualifies_as_ppe
    into v_rule, v_default, v_useful_life, v_ppe
  from items i join item_categories c on c.id = i.category_id
  where i.id = p_item_id;

  if not found then raise exception 'Item not found'; end if;
  if v_rule = 'Always Expendable' then return 'Expendable'; end if;
  if v_rule = 'Always Semi-Expendable' then return 'Semi-Expendable'; end if;
  if v_rule = 'Always Capital Outlay' then return 'Capital Outlay'; end if;

  select numeric_value into v_threshold from system_settings where setting_key = 'capitalization_threshold';
  if v_ppe and p_unit_cost >= coalesce(v_threshold, 50000) then return 'Capital Outlay'; end if;
  if coalesce(v_useful_life, 0) > 1 then return 'Semi-Expendable'; end if;
  return coalesce(v_default, 'Expendable');
end;
$$;

create or replace function complete_iar(p_iar_id uuid, p_performed_by text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_iar inspection_acceptance_reports%rowtype;
  v_line record;
  v_class item_classification;
  v_sequence integer;
  v_property_sequence integer;
  v_property_number text;
  v_property_year integer;
  v_running_qty numeric;
  v_running_value numeric;
begin
  if nullif(trim(p_performed_by), '') is null then raise exception 'Performed By is required'; end if;
  select * into v_iar from inspection_acceptance_reports where id = p_iar_id for update;
  if not found then raise exception 'IAR not found'; end if;
  if v_iar.status = 'Completed' then raise exception 'IAR was already completed'; end if;
  if v_iar.status in ('Cancelled','Rejected') then raise exception 'IAR cannot be completed from status %', v_iar.status; end if;
  if not exists (select 1 from purchase_orders where id = v_iar.purchase_order_id and status = 'Completed') then
    raise exception 'The related purchase order must be completed';
  end if;

  for v_line in
    select iai.*, poi.item_id, poi.unit_cost, poi.quantity_ordered, poi.item_description,
           poi.brand, poi.model, po.supplier_id, po.fund_source,
           coalesce(po.uacs_account_id, i.default_uacs_account_id) as uacs_account_id,
           ua.ppe_sub_major, ua.gl_account, po.po_date, i.category_id
    from inspection_acceptance_items iai
    join purchase_order_items poi on poi.id = iai.purchase_order_item_id
    join items i on i.id = poi.item_id
    join purchase_orders po on po.id = poi.purchase_order_id
    left join uacs_accounts ua on ua.id = coalesce(po.uacs_account_id, i.default_uacs_account_id)
    where iai.iar_id = p_iar_id
    for update of iai
  loop
    if v_line.processed_at is not null then raise exception 'IAR line was already processed'; end if;
    if v_line.quantity_delivered > v_line.quantity_ordered then raise exception 'Delivered quantity exceeds ordered quantity'; end if;
    if v_line.quantity_accepted > v_line.quantity_delivered then raise exception 'Accepted quantity exceeds delivered quantity'; end if;
    if v_line.quantity_accepted = 0 then
      update inspection_acceptance_items set processed_at = now() where id = v_line.id;
      continue;
    end if;

    v_class := classify_item(v_line.item_id, v_line.unit_cost);
    update inspection_acceptance_items
      set system_classification = v_class,
          final_classification = coalesce(final_classification, v_class),
          processed_at = now()
      where id = v_line.id
      returning final_classification into v_class;

    if v_class = 'Expendable' then
      insert into inventory_batches (
        batch_number, item_id, source_iar_item_id, date_received,
        quantity_received, quantity_remaining, unit_cost
      ) values (
        'B-' || replace(v_iar.iar_number, 'IAR-', '') || '-' || right(v_line.id::text, 4),
        v_line.item_id, v_line.id, coalesce(v_iar.acceptance_date, v_iar.iar_date),
        v_line.quantity_accepted, v_line.quantity_accepted, v_line.unit_cost
      );
      select coalesce(sum(quantity_remaining),0), coalesce(sum(quantity_remaining * unit_cost),0)
        into v_running_qty, v_running_value from inventory_batches
        where item_id = v_line.item_id and status <> 'Cancelled';
      insert into stock_movements (
        item_id, transaction_type, reference_document, reference_number,
        quantity_received, unit_cost, total_value, running_quantity_balance,
        running_value_balance, inventory_batch_id, remarks
      )
      select v_line.item_id, 'Receipt from IAR', 'IAR', v_iar.iar_number,
             v_line.quantity_accepted, v_line.unit_cost, v_line.quantity_accepted * v_line.unit_cost,
             v_running_qty, v_running_value, id, 'Created on IAR completion'
      from inventory_batches where source_iar_item_id = v_line.id;
    else
      if trunc(v_line.quantity_accepted) <> v_line.quantity_accepted then
        raise exception 'Property-unit quantity must be a whole number';
      end if;
      if v_line.uacs_account_id is null or nullif(trim(v_line.ppe_sub_major), '') is null or nullif(trim(v_line.gl_account), '') is null then
        raise exception 'The UACS account for % must include PPE Sub-Major and GL Account codes', v_line.item_description;
      end if;
      v_property_year := extract(year from coalesce(v_iar.acceptance_date, v_iar.iar_date))::integer;
      perform pg_advisory_xact_lock(hashtextextended(
        v_property_year::text || ':' || v_class::text || ':' || v_line.uacs_account_id::text,
        0
      ));
      select coalesce(max(property_sequence), 0)
        into v_property_sequence
      from property_units
      where classification = v_class
        and uacs_account_id = v_line.uacs_account_id
        and property_number_year = v_property_year;
      for v_sequence in 1..v_line.quantity_accepted::integer loop
        v_property_sequence := v_property_sequence + 1;
        v_property_number := v_property_year::text || '-' || lpad(v_line.ppe_sub_major, 2, '0') || '-' ||
          lpad(v_line.gl_account, 2, '0') || '-' || lpad(v_property_sequence::text, 4, '0');
        insert into property_units (
          source_iar_item_id, unit_sequence, classification, item_id, item_description,
          item_category_id, brand, model, acquisition_cost, supplier_id,
          purchase_order_id, iar_id, date_acquired, date_accepted,
          uacs_account_id, fund_source, property_number, property_number_year, property_sequence
        ) values (
          v_line.id, v_sequence, v_class, v_line.item_id, v_line.item_description,
          v_line.category_id, v_line.brand, v_line.model, v_line.unit_cost, v_line.supplier_id,
          v_iar.purchase_order_id, v_iar.id, v_line.po_date,
          coalesce(v_iar.acceptance_date, v_iar.iar_date),
          v_line.uacs_account_id, v_line.fund_source, v_property_number, v_property_year, v_property_sequence
        );
      end loop;
    end if;
  end loop;

  update inspection_acceptance_reports
    set status = 'Completed', performed_by = p_performed_by, completed_at = now()
    where id = p_iar_id;
  insert into audit_logs (performed_by, action_type, entity_type, entity_id, reference_number)
    values (p_performed_by, 'IAR completion', 'IAR', p_iar_id, v_iar.iar_number);
end;
$$;

create or replace function complete_ris(p_ris_id uuid, p_performed_by text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ris requisition_issue_slips%rowtype;
  v_line record;
  v_batch record;
  v_needed numeric;
  v_take numeric;
  v_available numeric;
  v_running_qty numeric;
  v_running_value numeric;
begin
  if nullif(trim(p_performed_by), '') is null then raise exception 'Performed By is required'; end if;
  select * into v_ris from requisition_issue_slips where id = p_ris_id for update;
  if not found then raise exception 'RIS not found'; end if;
  if v_ris.status = 'Completed' then raise exception 'RIS was already completed'; end if;
  if v_ris.status = 'Cancelled' then raise exception 'Cancelled RIS cannot be completed'; end if;

  for v_line in select * from requisition_issue_slip_items where ris_id = p_ris_id for update loop
    if v_line.processed_at is not null then raise exception 'RIS line was already processed'; end if;
    select coalesce(sum(quantity_remaining), 0) into v_available
      from inventory_batches where item_id = v_line.item_id and status = 'Open';
    if v_line.quantity_issued > v_available then raise exception 'Issued quantity exceeds available stock'; end if;
    v_needed := v_line.quantity_issued;

    for v_batch in
      select * from inventory_batches
      where item_id = v_line.item_id and status = 'Open' and quantity_remaining > 0
      order by date_received, created_at, id
      for update
    loop
      exit when v_needed <= 0;
      v_take := least(v_needed, v_batch.quantity_remaining);
      insert into ris_batch_allocations (ris_item_id, inventory_batch_id, quantity, unit_cost)
        values (v_line.id, v_batch.id, v_take, v_batch.unit_cost);
      update inventory_batches
        set quantity_remaining = quantity_remaining - v_take,
            status = case when quantity_remaining - v_take = 0 then 'Depleted' else 'Open' end
        where id = v_batch.id;
      select coalesce(sum(quantity_remaining),0), coalesce(sum(quantity_remaining * unit_cost),0)
        into v_running_qty, v_running_value
        from inventory_batches where item_id = v_line.item_id and status <> 'Cancelled';
      insert into stock_movements (
        item_id, transaction_type, reference_document, reference_number,
        quantity_issued, unit_cost, total_value, running_quantity_balance,
        running_value_balance, inventory_batch_id, remarks
      ) values (
        v_line.item_id, 'Issue through RIS', 'RIS', v_ris.ris_number,
        v_take, v_batch.unit_cost, v_take * v_batch.unit_cost,
        v_running_qty, v_running_value, v_batch.id, 'FIFO issue'
      );
      v_needed := v_needed - v_take;
    end loop;
    if v_needed > 0 then raise exception 'FIFO allocation failed due to insufficient stock'; end if;
    update requisition_issue_slip_items set processed_at = now() where id = v_line.id;
  end loop;

  update requisition_issue_slips
    set status = 'Completed', performed_by = p_performed_by, completed_at = now()
    where id = p_ris_id;
  insert into audit_logs (performed_by, action_type, entity_type, entity_id, reference_number)
    values (p_performed_by, 'RIS completion and FIFO deduction', 'RIS', p_ris_id, v_ris.ris_number);
end;
$$;

create or replace function finalize_rsmi(p_rsmi_id uuid, p_ris_ids uuid[], p_performed_by text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rsmi rsmi_reports%rowtype;
  v_ris_id uuid;
begin
  if nullif(trim(p_performed_by), '') is null then raise exception 'Performed By is required'; end if;
  if coalesce(array_length(p_ris_ids, 1), 0) = 0 then raise exception 'Select at least one completed RIS'; end if;
  select * into v_rsmi from rsmi_reports where id = p_rsmi_id for update;
  if not found then raise exception 'RSMI not found'; end if;
  if v_rsmi.status <> 'Draft' then raise exception 'Only a draft RSMI can be finalized'; end if;

  foreach v_ris_id in array p_ris_ids loop
    if not exists (select 1 from requisition_issue_slips where id = v_ris_id and status = 'Completed' for update) then
      raise exception 'Every selected RIS must be completed';
    end if;
    if exists (select 1 from rsmi_ris_records where ris_id = v_ris_id) then
      raise exception 'A selected RIS is already included in an RSMI';
    end if;
    insert into rsmi_ris_records (rsmi_id, ris_id) values (p_rsmi_id, v_ris_id);
  end loop;

  update rsmi_reports
    set status = 'Finalized', performed_by = p_performed_by, finalized_at = now()
    where id = p_rsmi_id;
  insert into audit_logs (performed_by, action_type, entity_type, entity_id, reference_number)
    values (p_performed_by, 'RSMI generation', 'RSMI', p_rsmi_id, v_rsmi.rsmi_number);
end;
$$;

create or replace view inventory_balances as
select
  i.id as item_id,
  i.item_code,
  i.item_name,
  i.unit_of_measure,
  i.reorder_level,
  coalesce(sum(b.quantity_remaining), 0)::numeric(18,3) as ending_balance,
  coalesce(sum(b.quantity_remaining * b.unit_cost), 0)::numeric(18,2) as total_remaining_value,
  case when coalesce(sum(b.quantity_remaining), 0) <= i.reorder_level then 'Low stock' else 'In stock' end as stock_status
from items i
left join inventory_batches b on b.item_id = i.id and b.status <> 'Cancelled'
group by i.id;

create or replace view rsmi_line_details as
select
  rr.rsmi_id, r.ris_number, r.ris_date, o.name as requesting_office,
  i.item_code, i.item_name, i.unit_of_measure,
  ri.quantity_issued,
  sum(a.total_value)::numeric(18,2) as total_issued_cost,
  case when ri.quantity_issued = 0 then 0
       else (sum(a.total_value) / ri.quantity_issued)::numeric(18,2) end as weighted_unit_cost,
  ua.uacs_code,
  ri.remarks
from rsmi_ris_records rr
join requisition_issue_slips r on r.id = rr.ris_id
join offices o on o.id = r.requesting_office_id
join requisition_issue_slip_items ri on ri.ris_id = r.id
join items i on i.id = ri.item_id
left join uacs_accounts ua on ua.id = i.default_uacs_account_id
join ris_batch_allocations a on a.ris_item_id = ri.id
group by rr.rsmi_id, r.ris_number, r.ris_date, o.name, i.item_code,
         i.item_name, i.unit_of_measure, ri.quantity_issued, ua.uacs_code, ri.remarks;

drop function if exists issue_semi_expendable_property(uuid, uuid, uuid, uuid, text, text, text, text, text, text);
drop function if exists issue_semi_expendable_property(uuid, uuid, uuid, uuid, boolean, text, text, text, text, text, text, text);
drop function if exists issue_semi_expendable_property(uuid, uuid, uuid, boolean, text, text, text, text, text, text, text, text);
drop function if exists issue_semi_expendable_property(uuid, uuid, uuid, boolean, text, text, text, text, text, text, text, text, text);

create or replace function issue_semi_expendable_property(
  p_property_id uuid,
  p_employee_id uuid,
  p_issued_by_employee_id uuid,
  p_generate_ics boolean,
  p_ics_number text,
  p_inventory_item_number text,
  p_ppe_number text,
  p_other_info text,
  p_brand text,
  p_model text,
  p_serial_number text,
  p_condition text,
  p_performed_by text
) returns property_units
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property property_units%rowtype;
  v_updated property_units%rowtype;
  v_employee employees%rowtype;
  v_uacs_code text;
  v_issue_date date := (now() at time zone 'Asia/Manila')::date;
  v_year integer;
  v_month text;
  v_ics_sequence integer;
  v_inventory_sequence integer;
  v_inventory_prefix text;
begin
  if nullif(trim(p_performed_by), '') is null then raise exception 'Performed By is required'; end if;
  if p_employee_id is null or p_issued_by_employee_id is null then
    raise exception 'Issued to / Received by and Issued by are required';
  end if;

  select * into v_property from property_units where id = p_property_id for update;
  if not found then raise exception 'Property unit not found'; end if;
  if v_property.classification <> 'Semi-Expendable' then raise exception 'Only semi-expendable units can be issued through an ICS'; end if;

  select * into v_employee from employees where id = p_employee_id and active;
  if not found then raise exception 'The receiving employee is missing or inactive'; end if;
  if not exists (select 1 from employees where id = p_issued_by_employee_id and active) then raise exception 'The Issued by employee is missing or inactive'; end if;
  select uacs_code into v_uacs_code from uacs_accounts where id = v_property.uacs_account_id;
  if nullif(trim(v_uacs_code), '') is null or length(v_uacs_code) < 8 then raise exception 'A valid UACS code is required before issuing this item'; end if;

  if (p_generate_ics or v_property.ics_number is not null) and coalesce(p_ics_number, '') !~* '^\d{4}-\d{2}-(\d{4}|\d{3}[a-z])$' then
    raise exception 'ICS No. must use YYYY-MM-0001 or YYYY-MM-001A';
  end if;
  if nullif(trim(p_inventory_item_number), '') is not null and trim(p_inventory_item_number) !~* '^\d{4}-\d{2}-(\d{4}|\d{3}[a-z])$' then
    raise exception 'Inventory Item No. must use 5030-04-0001 or 5030-04-001A';
  end if;
  if nullif(trim(p_inventory_item_number), '') is not null and exists (
    select 1 from property_units
    where upper(inventory_item_number) = upper(trim(p_inventory_item_number)) and id <> p_property_id
  ) then
    raise exception 'Inventory Item No. % is already assigned to another property record', trim(p_inventory_item_number);
  end if;
  if coalesce(trim(p_ppe_number), '') !~* '^\d{4}-\d{2}-\d{2}-(\d{4}|\d{3}[a-z])$' then
    raise exception 'PPE No. must use YYYY-XX-XX-0001 or YYYY-XX-XX-001A';
  end if;
  if exists (
    select 1 from property_units
    where classification = v_property.classification
      and upper(property_number) = upper(trim(p_ppe_number))
      and id <> p_property_id
  ) then
    raise exception 'PPE No. % is already assigned to another % record', trim(p_ppe_number), v_property.classification;
  end if;

  if p_generate_ics and (v_property.ics_number is null or v_property.inventory_item_number is null) then
    v_year := extract(year from v_issue_date)::integer;
    v_month := to_char(v_issue_date, 'MM');
    perform pg_advisory_xact_lock(hashtextextended('semi-ics:' || v_year::text, 0));
    select coalesce(max(ics_sequence), 0) + 1 into v_ics_sequence from property_units where ics_year = v_year;
    v_inventory_prefix := substring(v_uacs_code from 5 for 4);
    perform pg_advisory_xact_lock(hashtextextended('semi-inventory:' || v_property.uacs_account_id::text, 0));
    select coalesce(max(inventory_sequence), 0) + 1 into v_inventory_sequence
      from property_units where uacs_account_id = v_property.uacs_account_id and inventory_sequence is not null;
  end if;

  update property_units set
    property_number = upper(trim(p_ppe_number)),
    ics_number = case when p_generate_ics or ics_number is not null then upper(nullif(trim(p_ics_number), '')) else ics_number end,
    ics_year = case when p_generate_ics then coalesce(ics_year, v_year) else ics_year end,
    ics_sequence = case when p_generate_ics then coalesce(ics_sequence, v_ics_sequence) else ics_sequence end,
    inventory_item_number = case
      when nullif(trim(p_inventory_item_number), '') is not null then upper(trim(p_inventory_item_number))
      when p_generate_ics then coalesce(inventory_item_number, v_inventory_prefix || '-' || to_char(v_issue_date, 'MM') || '-' || lpad(v_inventory_sequence::text, 4, '0'))
      else inventory_item_number
    end,
    inventory_sequence = case when p_generate_ics then coalesce(inventory_sequence, v_inventory_sequence) else inventory_sequence end,
    issued_to_employee_id = p_employee_id,
    ics_issued_by_employee_id = p_issued_by_employee_id,
    ics_approved_by_employee_id = null,
    employee_plantilla_position = v_employee.plantilla_position,
    office_id = v_employee.office_id,
    brand = nullif(trim(p_brand), ''),
    model = nullif(trim(p_model), ''),
    serial_number = nullif(trim(p_serial_number), ''),
    condition = coalesce(nullif(trim(p_condition), ''), 'Good'),
    other_info = nullif(trim(p_other_info), ''),
    current_status = 'Issued',
    issued_at = case when p_generate_ics then coalesce(issued_at, now()) else issued_at end,
    updated_at = now()
  where id = p_property_id
  returning * into v_updated;

  insert into audit_logs (performed_by, action_type, entity_type, entity_id, reference_number, before_data, after_data)
  values (p_performed_by, case when p_generate_ics and v_property.ics_number is null then 'Semi-expendable ICS generation' when p_generate_ics then 'Semi-expendable ICS update' else 'Semi-expendable issue details update' end,
          'Property Unit', p_property_id, v_updated.ics_number, to_jsonb(v_property), to_jsonb(v_updated));
  return v_updated;
end;
$$;

revoke all on function issue_semi_expendable_property(uuid, uuid, uuid, boolean, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function issue_semi_expendable_property(uuid, uuid, uuid, boolean, text, text, text, text, text, text, text, text, text) to authenticated;

grant execute on function complete_iar(uuid, text) to anon, authenticated;
grant execute on function complete_ris(uuid, text) to anon, authenticated;
grant execute on function finalize_rsmi(uuid, uuid[], text) to anon, authenticated;
