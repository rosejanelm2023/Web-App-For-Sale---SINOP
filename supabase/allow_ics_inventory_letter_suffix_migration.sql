create or replace function issue_semi_expendable_property(
  p_property_id uuid,
  p_employee_id uuid,
  p_issued_by_employee_id uuid,
  p_generate_ics boolean,
  p_ics_number text,
  p_inventory_item_number text,
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
    select 1 from property_units where upper(inventory_item_number) = upper(trim(p_inventory_item_number)) and id <> p_property_id
  ) then
    raise exception 'Inventory Item No. % is already assigned to another property record', trim(p_inventory_item_number);
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

revoke all on function issue_semi_expendable_property(uuid, uuid, uuid, boolean, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function issue_semi_expendable_property(uuid, uuid, uuid, boolean, text, text, text, text, text, text, text, text) to authenticated;
