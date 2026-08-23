begin;

-- Staff may perform the complete transaction workflow except Delete and Unpost.
-- Unpost is defined as returning any non-Draft document to Draft.
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

  if public.current_app_role() <> 'staff' then
    raise exception 'This action is not allowed for your account';
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Only the Super Admin can delete transactions';
  end if;

  if tg_op = 'UPDATE'
     and old.status::text <> 'Draft'
     and new.status::text = 'Draft' then
    raise exception 'Only the Super Admin can unpost transactions';
  end if;

  return new;
end;
$$;

-- Document headers: Staff may create, edit, approve, complete, and finalize.
-- Delete remains Super Admin-only; the trigger above separately blocks Unpost.
do $$
declare
  t text;
begin
  foreach t in array array[
    'purchase_orders',
    'inspection_acceptance_reports',
    'requisition_issue_slips',
    'rsmi_reports'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_inventory_staff())',
      t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_inventory_staff()) with check (public.is_inventory_staff())',
      t || '_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_super_admin())',
      t || '_admin_delete', t
    );
  end loop;
end $$;

comment on function public.enforce_inventory_workflow_role() is
  'Super Admin has full workflow control. Staff may create, edit, approve, complete, and finalize, but may not delete or return posted documents to Draft.';

commit;
