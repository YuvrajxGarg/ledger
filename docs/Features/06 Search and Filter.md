# 06 · Search and Filter

Global search + filters across closing sheets, invoices, vendors, reimbursements, payments, dispatch log.

## Filters
Project · vendor · date range · payment mode · status (unpaid/partial/paid, approved/pending) · amount range ·
GST applicable/exempt · dispatch batch.

## Impl
Server-side query params → Prisma `where` builder. Start simple (per-entity filtered lists); a global omni-search
can come later, optionally LLM-assisted.
