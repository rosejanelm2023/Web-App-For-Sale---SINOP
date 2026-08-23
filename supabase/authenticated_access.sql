-- Run this once in Supabase SQL Editor after supabase/schema.sql.
-- All signed-in inventory users share the same office records.

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'offices','suppliers','uacs_accounts','item_categories','employees','items',
    'system_settings','purchase_orders','purchase_order_items',
    'inspection_acceptance_reports','inspection_acceptance_items',
    'inventory_batches','property_units','requisition_issue_slips',
    'requisition_issue_slip_items','ris_batch_allocations','stock_movements',
    'rsmi_reports','rsmi_ris_records','audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    policy_name := table_name || '_authenticated_all';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = policy_name
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (true) with check (true)',
        policy_name,
        table_name
      );
    end if;
  end loop;
end
$$;

revoke execute on function public.complete_iar(uuid, text) from anon;
revoke execute on function public.complete_ris(uuid, text) from anon;
grant execute on function public.complete_iar(uuid, text) to authenticated;
grant execute on function public.complete_ris(uuid, text) to authenticated;
