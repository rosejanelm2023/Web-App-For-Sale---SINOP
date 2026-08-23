# Assumptions

- Supabase PostgreSQL is the only authoritative business database.
- The current interface demonstrates workflows with seeded in-session data until Supabase environment values are supplied.
- Quantity can be decimal for supplies and whole-number for property units; property-unit generation rejects fractional accepted quantities.
- FIFO ordering uses receipt date, creation time, then batch identifier.
- A finalized RSMI owns each included RIS; reversal requires a cancellation reason and audit entry.
- Weighted unit cost in an RSMI is total FIFO allocation cost divided by total issued quantity; detailed allocations remain stored.
- “Performed By” is required for important actions until authentication is added.
- Configurable accounting fields require office review before production use.
