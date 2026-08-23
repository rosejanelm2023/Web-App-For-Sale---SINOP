# Requirements summary

## Transaction flows

1. Purchase Order → Inspection and Acceptance Report.
2. Completed IAR → category/threshold classification.
3. Expendable item → FIFO inventory batches → RIS → RSMI.
4. Semi-expendable or capital-outlay item → one property-unit record per accepted unit.
5. Completed and cancelled documents remain auditable; completed records are never hard-deleted.

## Modules

- Admin master data: suppliers, items, item categories, employees, offices, UACS accounts, and system settings.
- Purchase Orders and multi-line items.
- Inspection and Acceptance Reports with partial delivery and acceptance.
- Inventory batches, stock movements, and FIFO cost allocations.
- Requisition and Issue Slips with printing and completion controls.
- RSMI generation from eligible completed RIS records.
- Semi-expendable and capital-outlay property-unit registers.
- Dashboard, operational reports, CSV export, and print layouts.
- Audit log with a temporary “Performed By” value until authentication is introduced.

## Deferred

Authentication, roles, electronic signatures, PAR, ICS, transfer/disposal workflows, depreciation, repair history, barcode/QR scanning, notifications, and complex approval routing are intentionally excluded.

The application does not claim automatic COA compliance. Thresholds, classifications, UACS mappings, signatories, and report settings remain configurable for review.
