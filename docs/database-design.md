# Database design

## Core relationships

- An `office` has many `employees`; an employee may receive many property units.
- An `item_category` has many `items`; its classification rule controls accepted-item classification.
- A `supplier` has many `purchase_orders`; a PO has many `purchase_order_items`.
- A completed PO has one or more `inspection_acceptance_reports`; each IAR line points to one PO line.
- One accepted expendable IAR line creates an `inventory_batch`.
- One accepted semi-expendable or capital-outlay unit creates one `property_unit`.
- A `requisition_issue_slip` has many items. Each issued line has one or more `ris_batch_allocations` pointing to FIFO batches.
- Each receipt, issue, adjustment, and reversal creates `stock_movements`.
- An `rsmi_report` includes many eligible RIS records through `rsmi_ris_records`. The unique RIS foreign key prevents duplicate inclusion.
- Important mutations append an `audit_log` row.

## Transaction boundaries

The following operations are implemented as PostgreSQL functions/RPCs and must run atomically:

- IAR completion, classification, batch creation, and property-unit creation.
- RIS completion, stock validation, FIFO allocations, batch deductions, and movement creation.
- RSMI finalization and RIS inclusion.
- Cancellation/reversal of completed records.

Database constraints provide the final protection against duplicate document numbers, negative money or quantities, over-acceptance, duplicate processing, duplicate property numbers, and duplicate RSMI inclusion.
