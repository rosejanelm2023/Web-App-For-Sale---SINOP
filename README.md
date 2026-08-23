# Agency Inventory Management Platform

This repository is the separate, customizable product edition of the inventory and property management application. It does not include the DMW project's Supabase credentials or records.

After an approved user signs in for the first time, the onboarding screen collects their profile and optionally lets them set an agency name, choose an accent color, and upload an official PNG/JPG header. The selected branding is applied to the workspace and printable forms. Subscription billing and full tenant-level data isolation are separate launch phases.

An internal monitoring and monthly-report preparation application for a Philippine government office. It covers purchase orders, inspection and acceptance, configurable item classification, expendable inventory, FIFO issuance, RSMI preparation, and individual property-unit records.

This initial release intentionally has no authentication, login, roles, or complex approval routing. It does not claim automatic COA compliance. Accounting classifications, thresholds, UACS mappings, signatories, and report settings remain configurable for office review.

## Technology stack

- Next.js 16 with TypeScript
- Tailwind CSS 4
- PostgreSQL through Supabase
- Supabase used as the business database only
- Vercel-compatible application source
- Cloudflare Worker-compatible Sites release output

## Current features

- Dashboard metrics, activity tables, low-stock monitoring, and issuance charts
- Purchase Order list, form, line calculations, completion controls, and IAR handoff
- IAR creation from completed POs, partial delivery/acceptance, validation, and classification
- Editable per-item capitalization threshold, initially ₱50,000
- Expendable inventory batches, running balances, stock movements, and FIFO allocations
- RIS list, full header/line form, stock validation, completion audit, CSV export, and clean print layout
- RSMI period selection, eligible-RIS selection, duplicate prevention, finalization, print, and CSV export
- Individual semi-expendable and capital-outlay property records
- Property number uniqueness, assignment, location, condition, and missing-identifier editing
- Supplier, item, category, employee, office, UACS, and system-setting master data
- RIS, RSMI, semi-expendable, capital-outlay, and inventory-balance reports
- Search, filters, sortable-ready tables, pagination, status badges, empty states, confirmations, validation messages, notifications, and print styling
- Audit-log structure and temporary “Performed By” capture

The bundled interface uses realistic in-session seed records until Supabase environment values are supplied. PostgreSQL remains the intended authoritative data store.

## Design documentation

- `docs/requirements-summary.md`
- `docs/database-design.md`
- `docs/folder-structure.md`
- `docs/assumptions.md`

## Local installation

Node.js 22.13 or newer is required.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by the development server.

## Required environment variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

The service-role key is server-only and must never be exposed in client code or committed.

## Supabase setup and database migrations

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run `supabase/schema.sql` in a new, empty database.
4. Run `supabase/seed.sql` for development sample data.
5. Copy `.env.example` to `.env.local` and add the project values.
6. Restart the development server.

For later schema changes, create a dated SQL migration under `supabase/migrations/`, test it against a staging Supabase project, and apply it through the Supabase CLI or SQL Editor. Important operations are exposed as transactional PostgreSQL functions:

- `complete_iar`
- `complete_ris`
- `finalize_rsmi`

If any validation, classification, batch, property-unit, FIFO, movement, or RSMI-inclusion step fails, PostgreSQL rolls back the entire function call.

## Seed data

`supabase/seed.sql` includes:

- Three suppliers
- Three offices
- Five plantilla employees
- Four UACS accounts
- Expendable, threshold-based, and capital-outlay categories
- Ten items
- Sample draft and completed purchase orders with line items

The script uses stable development UUIDs and conflict-safe inserts.

## Builds

```bash
npm run build:next
```

Creates the full Next/vinext build.

```bash
npm run build
```

Creates the Sites-compatible release under `dist/`.

## Vercel deployment

1. Import the repository into Vercel.
2. Select the Next.js framework preset.
3. Use `npm run build:next` as the build command if Vercel does not detect it automatically.
4. Add the three Supabase environment variables for Preview and Production.
5. Deploy and verify the transactional RPC permissions against a non-production Supabase project before enabling office data entry.

## Intentionally deferred

- Authentication, login, and user roles
- Electronic signatures
- PAR and ICS
- Property Transfer Report
- Disposal workflow
- Depreciation
- Repair history
- Barcode and QR scanning
- Email notifications
- Complex approval routing

The relational design isolates these future capabilities from the current document, inventory, ledger, RSMI, and property-unit foundations.
