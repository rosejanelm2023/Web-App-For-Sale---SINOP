-- Automatic property numbering for Semi-Expendable and Capital Outlay units.
-- Format: YYYY-PPE_SUB_MAJOR-GL_ACCOUNT-SEQUENCE (example: 2026-05-02-0001).
-- The sequence is independent per year, classification, and UACS account.

alter table public.property_units
  add column if not exists property_number_year integer,
  add column if not exists property_sequence integer;

alter table public.property_units
  drop constraint if exists property_units_property_number_key;

-- Preserve any already formatted number by extracting its year and sequence.
update public.property_units
set property_number_year = coalesce(property_number_year, split_part(property_number, '-', 1)::integer),
    property_sequence = coalesce(property_sequence, split_part(property_number, '-', 4)::integer)
where property_number ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4,}$';

-- Assign numbers to existing unnumbered records in their original creation order.
with existing_max as (
  select classification, uacs_account_id,
         coalesce(property_number_year, extract(year from date_accepted)::integer) as number_year,
         coalesce(max(property_sequence), 0) as max_sequence
  from public.property_units
  group by classification, uacs_account_id,
           coalesce(property_number_year, extract(year from date_accepted)::integer)
), ranked as (
  select p.id,
         extract(year from p.date_accepted)::integer as number_year,
         coalesce(m.max_sequence, 0) + row_number() over (
           partition by p.classification, p.uacs_account_id, extract(year from p.date_accepted)::integer
           order by p.created_at, p.id
         ) as number_sequence,
         ua.ppe_sub_major,
         ua.gl_account
  from public.property_units p
  join public.uacs_accounts ua on ua.id = p.uacs_account_id
  left join existing_max m
    on m.classification = p.classification
   and m.uacs_account_id = p.uacs_account_id
   and m.number_year = extract(year from p.date_accepted)::integer
  where p.property_number is null
    and nullif(trim(ua.ppe_sub_major), '') is not null
    and nullif(trim(ua.gl_account), '') is not null
)
update public.property_units p
set property_number_year = ranked.number_year,
    property_sequence = ranked.number_sequence,
    property_number = ranked.number_year::text || '-' || lpad(ranked.ppe_sub_major, 2, '0') || '-' ||
      lpad(ranked.gl_account, 2, '0') || '-' || lpad(ranked.number_sequence::text, 4, '0')
from ranked
where p.id = ranked.id;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.property_units'::regclass
      and conname = 'property_units_classification_property_number_key'
  ) then
    alter table public.property_units
      add constraint property_units_classification_property_number_key
      unique (classification, property_number);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.property_units'::regclass
      and conname = 'property_units_number_sequence_key'
  ) then
    alter table public.property_units
      add constraint property_units_number_sequence_key
      unique (classification, uacs_account_id, property_number_year, property_sequence);
  end if;
end
$$;

create or replace function public.complete_iar(p_iar_id uuid, p_performed_by text)
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

revoke execute on function public.complete_iar(uuid, text) from anon;
grant execute on function public.complete_iar(uuid, text) to authenticated;
