# Proposed folder structure

```text
app/
  page.tsx                 Interactive application shell and module pages
  layout.tsx               Metadata and document layout
  globals.css              Tailwind import and product styling
lib/
  classification.ts        Category/threshold classification rules
  supabase.ts              Supabase REST/RPC client boundary
supabase/
  schema.sql               Relational schema and transactional functions
  seed.sql                 Sample master and transaction records
static/
  index.html               Sites release shell
  app.js                   Interactive release modules
scripts/
  build-static.mjs         Sites release build
docs/
  requirements-summary.md
  database-design.md
  folder-structure.md
  assumptions.md
```

Future authentication, PAR/ICS, transfer, disposal, repair, and depreciation capabilities can be added as separate modules without changing the core document and ledger relationships.
