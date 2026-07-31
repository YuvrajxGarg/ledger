# Conventions

## Money
- Store as **integer paise** (₹1 = 100). Never floats in the DB.
- Format for display with `formatINR(paise)` from `@/lib/money` → `₹75,500`.
- Parse user input with `toPaise(rupeesString)`.

## Data access
- Prisma only on the server. Client components never import `@/lib/db`.
- Reads in RSC; writes in `actions.ts` server actions validated with `zod`.
- Import enums/types from `@/lib/db` (re-exported from Prisma), never hand-rolled unions.

## State changes
- Every mutation that changes workflow state calls `logAudit(...)` and, where the §7 matrix applies,
  the matching `notify*()` function.

## UI
- shadcn/ui primitives in `src/components/ui`. App-specific components in `src/components`.
- Status shown via `<StatusBadge>` mapping each enum to a consistent colour.
- Theme-aware (light/dark). Use semantic Tailwind tokens, not hardcoded hex.

## Routing
- Kebab-case route segments; PascalCase component files.
- Role-gated pages check `getCurrentUser().role` server-side; don't rely on hiding nav only.

## Commits (when git is used for `web/`)
- Conventional-ish: `feat:`, `fix:`, `docs:`, `chore:`. Keep the vault + roadmap updated in the same change.
