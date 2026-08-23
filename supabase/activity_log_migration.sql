-- Super Admin Activity Log / Audit Trail
-- Safe to run after the authentication and role migrations.
-- Existing audit records are retained. Application users cannot alter or delete history.

alter table public.audit_logs add column if not exists user_id uuid;
alter table public.audit_logs add column if not exists user_email text;
alter table public.audit_logs add column if not exists user_role text;

create index if not exists audit_logs_action_at_idx on public.audit_logs (action_at desc);
create index if not exists audit_logs_user_idx on public.audit_logs (user_id, action_at desc);

create or replace function public.normalize_inventory_audit_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_actor_email text;
  v_actor_role text;
  v_normalized_action text;
begin
  select p.full_name, p.email, p.role
    into v_actor_name, v_actor_email, v_actor_role
    from public.profiles p
    where p.id = auth.uid();

  new.user_id := coalesce(new.user_id, auth.uid());
  new.user_email := coalesce(new.user_email, v_actor_email, auth.jwt() ->> 'email');
  new.user_role := coalesce(new.user_role, v_actor_role, 'system');
  new.performed_by := coalesce(nullif(new.performed_by, ''), nullif(v_actor_name, ''), new.user_email, 'System');

  v_normalized_action := case
    when lower(new.action_type) in ('created', 'edited', 'submitted', 'approved', 'unposted', 'deleted') then initcap(lower(new.action_type))
    when lower(new.action_type) ~ '(complete|approval|approve|finali|generation|issuance)' then 'Approved'
    when lower(new.action_type) ~ 'unpost' then 'Unposted'
    when lower(new.action_type) ~ 'delet' then 'Deleted'
    when lower(new.action_type) ~ '(creat|insert)' then 'Created'
    else 'Edited'
  end;
  new.action_type := v_normalized_action;
  new.reason := coalesce(new.reason, format('%s %s was %s.', new.entity_type, coalesce(new.reference_number, new.entity_id::text), lower(v_normalized_action)));

  if exists (
    select 1
    from public.audit_logs existing
    where existing.entity_type = new.entity_type
      and existing.entity_id is not distinct from new.entity_id
      and existing.reference_number is not distinct from new.reference_number
      and existing.action_type = v_normalized_action
      and existing.action_at >= coalesce(new.action_at, now()) - interval '3 seconds'
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_inventory_audit_entry_trigger on public.audit_logs;
create trigger normalize_inventory_audit_entry_trigger
before insert on public.audit_logs
for each row execute function public.normalize_inventory_audit_entry();

create or replace function public.capture_inventory_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_actor_email text;
  v_actor_role text;
  v_action text;
  v_reference text;
  v_old_status text;
  v_new_status text;
  v_entity_id uuid;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
    v_entity_id := nullif(v_after ->> 'id', '')::uuid;
    v_action := 'Created';
  elsif tg_op = 'DELETE' then
    v_before := to_jsonb(old);
    v_entity_id := nullif(v_before ->> 'id', '')::uuid;
    v_action := 'Deleted';
  else
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_entity_id := nullif(v_after ->> 'id', '')::uuid;
    v_old_status := lower(coalesce(v_before ->> 'status', v_before ->> 'current_status', ''));
    v_new_status := lower(coalesce(v_after ->> 'status', v_after ->> 'current_status', ''));

    if v_old_status <> v_new_status and v_new_status in ('submitted', 'pending', 'pending approval') then
      v_action := 'Submitted';
    elsif v_old_status <> v_new_status and v_new_status in ('approved', 'completed', 'accepted', 'finalized', 'issued') then
      v_action := 'Approved';
    elsif v_old_status in ('approved', 'completed', 'accepted', 'finalized', 'issued')
      and v_new_status in ('draft', 'open', 'available') then
      v_action := 'Unposted';
    else
      v_action := 'Edited';
    end if;
  end if;

  select p.full_name, p.email, p.role
    into v_actor_name, v_actor_email, v_actor_role
    from public.profiles p
    where p.id = v_actor_id;

  v_actor_email := coalesce(v_actor_email, auth.jwt() ->> 'email');
  v_actor_name := coalesce(nullif(v_actor_name, ''), v_actor_email, 'System');
  v_actor_role := coalesce(v_actor_role, 'system');
  v_reference := coalesce(
    v_after ->> tg_argv[1], v_before ->> tg_argv[1],
    v_after ->> 'inventory_item_number', v_before ->> 'inventory_item_number',
    v_after ->> 'ics_number', v_before ->> 'ics_number',
    v_after ->> 'setting_key', v_before ->> 'setting_key',
    v_entity_id::text
  );

  insert into public.audit_logs (
    performed_by, action_type, entity_type, entity_id, reference_number,
    reason, before_data, after_data, user_id, user_email, user_role
  ) values (
    v_actor_name, v_action, tg_argv[0], v_entity_id, v_reference,
    format('%s %s was %s.', tg_argv[0], v_reference, lower(v_action)),
    v_before, v_after, v_actor_id, v_actor_email, v_actor_role
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('purchase_orders', 'PO', 'po_number'),
      ('inspection_acceptance_reports', 'IAR', 'iar_number'),
      ('requisition_issue_slips', 'RIS', 'ris_number'),
      ('rsmi_reports', 'RSMI', 'rsmi_number'),
      ('property_units', 'Property', 'property_number'),
      ('suppliers', 'Suppliers', 'supplier_name'),
      ('items', 'Items', 'item_name'),
      ('employees', 'Employees', 'full_name'),
      ('uacs_accounts', 'UACS', 'uacs_code'),
      ('item_categories', 'Categories', 'category_name'),
      ('offices', 'Departments', 'name'),
      ('system_settings', 'System Settings', 'setting_key')
    ) as x(table_name, module_name, reference_column)
  loop
    if to_regclass('public.' || target.table_name) is not null then
      execute format('drop trigger if exists activity_log_trigger on public.%I', target.table_name);
      execute format(
        'create trigger activity_log_trigger after insert or update or delete on public.%I for each row execute function public.capture_inventory_activity(%L, %L)',
        target.table_name, target.module_name, target.reference_column
      );
    end if;
  end loop;
end $$;

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_staff_read on public.audit_logs;
drop policy if exists audit_logs_admin_write on public.audit_logs;
drop policy if exists audit_logs_super_admin_read on public.audit_logs;

create policy audit_logs_super_admin_read
on public.audit_logs
for select
to authenticated
using (public.is_super_admin());

grant select on public.audit_logs to authenticated;
revoke insert, update, delete on public.audit_logs from anon, authenticated;

comment on table public.audit_logs is
  'Immutable activity history. Only Super Admin may view; entries are written automatically by database triggers and protected workflow functions.';
