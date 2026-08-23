-- ONE-TIME RESET: removes every inventory and master-data record.
-- Authentication users are not deleted.
-- Run only when you want to start with a completely empty database.

truncate table
  audit_logs,
  rsmi_ris_records,
  rsmi_reports,
  stock_movements,
  ris_batch_allocations,
  requisition_issue_slip_items,
  requisition_issue_slips,
  property_units,
  inventory_batches,
  inspection_acceptance_items,
  inspection_acceptance_reports,
  purchase_order_items,
  purchase_orders,
  system_settings,
  items,
  employees,
  item_categories,
  uacs_accounts,
  suppliers,
  offices
restart identity cascade;
