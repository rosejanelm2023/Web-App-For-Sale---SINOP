begin;

alter table property_units
  add column if not exists ics_number text,
  add column if not exists ics_year integer,
  add column if not exists ics_sequence integer,
  add column if not exists inventory_item_number text,
  add column if not exists inventory_sequence integer,
  add column if not exists ics_issued_by_employee_id uuid references employees(id),
  add column if not exists ics_approved_by_employee_id uuid references employees(id),
  add column if not exists other_info text,
  add column if not exists issued_at timestamptz;

create unique index if not exists property_units_ics_number_key
  on property_units (ics_number) where ics_number is not null;
create unique index if not exists property_units_inventory_item_number_key
  on property_units (inventory_item_number) where inventory_item_number is not null;
create unique index if not exists property_units_ics_sequence_key
  on property_units (ics_year, ics_sequence) where ics_year is not null and ics_sequence is not null;
create unique index if not exists property_units_inventory_sequence_key
  on property_units (uacs_account_id, inventory_sequence) where uacs_account_id is not null and inventory_sequence is not null;

create or replace function issue_semi_expendable_property(
  p_property_id uuid,
  p_employee_id uuid,
  p_issued_by_employee_id uuid,
  p_approved_by_employee_id uuid,
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
  v_ics_sequence integer;
  v_inventory_sequence integer;
  v_inventory_prefix text;
begin
  if nullif(trim(p_performed_by), '') is null then raise exception 'Performed By is required'; end if;
  if p_employee_id is null or p_issued_by_employee_id is null or p_approved_by_employee_id is null then
    raise exception 'Issued to, Issued by, and Approved by are required';
  end if;

  select * into v_property from property_units where id = p_property_id for update;
  if not found then raise exception 'Property unit not found'; end if;
  if v_property.classification <> 'Semi-Expendable' then raise exception 'Only semi-expendable units can be issued through an ICS'; end if;

  select * into v_employee from employees where id = p_employee_id and active;
  if not found then raise exception 'The receiving employee is missing or inactive'; end if;
  if not exists (select 1 from employees where id = p_issued_by_employee_id and active) then raise exception 'The Issued by employee is missing or inactive'; end if;
  if not exists (select 1 from employees where id = p_approved_by_employee_id and active) then raise exception 'The Approved by employee is missing or inactive'; end if;
  select uacs_code into v_uacs_code from uacs_accounts where id = v_property.uacs_account_id;
  if nullif(trim(v_uacs_code), '') is null or length(v_uacs_code) < 8 then raise exception 'A valid UACS code is required before issuing this item'; end if;

  if v_property.ics_number is null or v_property.inventory_item_number is null then
    v_year := extract(year from v_issue_date)::integer;
    perform pg_advisory_xact_lock(hashtextextended('semi-ics:' || v_year::text, 0));
    select coalesce(max(ics_sequence), 0) + 1 into v_ics_sequence from property_units where ics_year = v_year;
    v_inventory_prefix := substring(v_uacs_code from 5 for 4);
    perform pg_advisory_xact_lock(hashtextextended('semi-inventory:' || v_property.uacs_account_id::text, 0));
    select coalesce(max(inventory_sequence), 0) + 1 into v_inventory_sequence
      from property_units where uacs_account_id = v_property.uacs_account_id and inventory_sequence is not null;
  else
    v_year := v_property.ics_year;
    v_ics_sequence := v_property.ics_sequence;
    v_inventory_sequence := v_property.inventory_sequence;
  end if;

  update property_units set
    ics_number = coalesce(ics_number, v_year::text || '-' || to_char(v_issue_date, 'MM') || '-' || lpad(v_ics_sequence::text, 4, '0')),
    ics_year = coalesce(ics_year, v_year),
    ics_sequence = coalesce(ics_sequence, v_ics_sequence),
    inventory_item_number = coalesce(inventory_item_number, v_inventory_prefix || '-' || to_char(v_issue_date, 'MM') || '-' || lpad(v_inventory_sequence::text, 4, '0')),
    inventory_sequence = coalesce(inventory_sequence, v_inventory_sequence),
    issued_to_employee_id = p_employee_id,
    ics_issued_by_employee_id = p_issued_by_employee_id,
    ics_approved_by_employee_id = p_approved_by_employee_id,
    employee_plantilla_position = v_employee.plantilla_position,
    office_id = v_employee.office_id,
    brand = nullif(trim(p_brand), ''),
    model = nullif(trim(p_model), ''),
    serial_number = nullif(trim(p_serial_number), ''),
    condition = coalesce(nullif(trim(p_condition), ''), 'Good'),
    other_info = nullif(trim(p_other_info), ''),
    current_status = 'Issued',
    issued_at = coalesce(issued_at, now()),
    updated_at = now()
  where id = p_property_id
  returning * into v_updated;

  insert into audit_logs (performed_by, action_type, entity_type, entity_id, reference_number, before_data, after_data)
  values (p_performed_by, case when v_property.ics_number is null then 'Semi-expendable ICS issuance' else 'Semi-expendable ICS update' end,
          'Property Unit', p_property_id, v_updated.ics_number, to_jsonb(v_property), to_jsonb(v_updated));
  return v_updated;
end;
$$;

revoke all on function issue_semi_expendable_property(uuid, uuid, uuid, uuid, text, text, text, text, text, text) from public, anon;
grant execute on function issue_semi_expendable_property(uuid, uuid, uuid, uuid, text, text, text, text, text, text) to authenticated;

commit;
