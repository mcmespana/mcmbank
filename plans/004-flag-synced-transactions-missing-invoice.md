# Plan 004: Flag bank-synced transactions missing an attached invoice/factura

> **Executor instructions**: Follow this plan step by step, run every
> verification command, and stop per the STOP conditions rather than
> improvising. Update `plans/README.md`'s status row when done.
>
> **Drift check**: `git diff --stat 0bc851b..HEAD -- hooks/use-movimientos.ts lib/services/database.ts components/transactions`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (pairs well with plan 003 but is independently useful)
- **Category**: direction (feature)
- **Planned at**: commit `0bc851b`, 2026-07-16

## Why this matters

Enable Banking (PSD2) transaction feeds never include invoice/receipt
attachments — confirmed by reading `lib/enable-banking/types.ts` and
`lib/enable-banking/dedup.ts`'s `mapTransactionToMovimiento()`, which maps
only `fecha, concepto, descripcion, contraparte, importe, booking_date,
value_date, external_id, origen_sync` and nothing file-related. That's
expected and not a bug. The actual product gap: once a transaction syncs in
automatically, there is **no follow-up prompt or indicator anywhere**
telling the user "this synced transaction still needs a receipt attached"
— confirmed by `grep -rn "sin_factura\|missing.*factura\|needs.*receipt"`
across `components/` and `hooks/` returning nothing. For a treasurer trying
to keep books complete for tax purposes, bank-synced transactions silently
accumulate without receipts unless someone remembers to check each one
individually.

## Current state

- `hooks/use-movimientos.ts` — the central transactions hook with filter
  support (search, date range, amounts, categories per
  `CLAUDE.md`'s hook table). Read its filter-building logic (likely a
  `MovimientoFilters` type and a query-builder function) to understand how
  to add a new filter without breaking existing ones.
- `movimiento.origen_sync` — set by `lib/enable-banking/dedup.ts` to
  identify bank-synced rows (confirm exact value, e.g. `'enablebanking'`,
  by reading `mapTransactionToMovimiento()`).
- `movimiento_archivo.movimiento_id` — the join needed to determine "has at
  least one attached file."
- `components/transactions/` — the transactions table/list component (find
  it via `ls components/transactions/` — likely `transaction-table.tsx` or
  similar) renders rows; this is where a badge/icon would go.
- Existing badge/icon patterns: check `components/cuentas/cuentas-manager.tsx`
  or the transactions table for how status badges (e.g. "ignorado") are
  currently rendered, and match that visual language.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Typecheck | `npx tsc --noEmit`   | exit 0               |
| Lint      | `pnpm lint`          | exit 0               |
| Dev server (manual) | `pnpm dev`  | starts on :3000      |

## Scope

**In scope**:
- `hooks/use-movimientos.ts` — add a `sinFactura` (or similarly-named)
  filter option, and/or a computed field on returned rows indicating
  whether they have zero attached files.
- The transactions list/table component that renders each movimiento row —
  add a badge/icon for "sin factura" when `origen_sync` is set (bank-synced)
  AND the row has zero `movimiento_archivo` rows.
- `lib/services/database.ts` — the underlying query, if the count needs to
  be computed via a join/subquery rather than N+1 client-side calls (prefer
  a single query with a count or `LEFT JOIN` — do NOT loop per-row calling
  a per-movimiento file-count query, that would be the exact N+1 pattern
  this repo's `docs/FUTURE_DEVELOPMENTS.md` already flags elsewhere as a
  performance problem).

**Out of scope**:
- Manual (non-synced) transactions — this flag is specifically for
  bank-synced rows, since those are the ones a human never manually
  decided "this doesn't need a receipt" for. Do not flag manual entries.
- Any bulk "mark as no receipt needed" dismissal feature — out of scope;
  note as a possible follow-up if the manual testing suggests it's needed
  (e.g. small ATM withdrawals will never have a factura and the badge would
  be permanently on).

## Git workflow

- Branch: `advisor/004-flag-missing-invoice`
- Conventional commits (e.g. `feat(transacciones): flag synced transactions without an attached invoice`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Add the "sin factura" computed flag to the movimientos query

In `lib/services/database.ts` (and `server-database.ts` if the transactions
list is also fetched server-side — check `hooks/use-movimientos.ts` to
confirm which service it calls), extend the query that backs
`use-movimientos.ts` to include a count or boolean of attached
`movimiento_archivo` rows per movimiento. Prefer a single query using
Supabase's embedded resource count syntax
(`movimiento_archivo(count)` in a `.select()`) over a second round-trip.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Surface the flag as a filter option

Add a filter (e.g. a toggle/checkbox: "Solo sincronizadas sin factura") to
whatever filter UI component `use-movimientos.ts` is wired to (find it via
`grep -rn "useMovimientos" components/` to locate the consuming component).
Match the existing filter UI patterns (dropdowns/checkboxes already present
for category/date filters).

**Verify**: `npx tsc --noEmit` → exit 0; `pnpm lint` → exit 0.

### Step 3: Add the visual badge on rows

In the transactions table/list row component, render a small badge/icon
(e.g. a muted "📎 sin factura" pill) when `origen_sync` is truthy AND the
attached-file count is zero. Match existing badge styling conventions in
the same file.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Manual check

1. `pnpm dev`, log in, navigate to `/transacciones`.
2. Confirm at least one manually-created transaction shows NO badge (control case).
3. If a bank-synced transaction exists in test data with no attachment,
   confirm the badge appears; attach a file to it and confirm the badge
   disappears on refresh.
4. Toggle the new filter and confirm the list narrows correctly.

If no bank-synced test data exists in the dev environment, note this in
your summary — the manual check for the badge itself can't be completed,
but Step 1-3's typecheck/lint/code-review of the query logic still stands
as partial verification; STOP and report this gap rather than claiming full
verification.

## Test plan

No test runner configured. Step 4 is the verification; record what could
and couldn't be manually confirmed.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] New filter option renders and narrows the list correctly
- [ ] Badge appears only for `origen_sync` rows with zero attachments (confirmed manually, or gap explicitly noted if no synced test data exists)
- [ ] No N+1 query introduced (confirm via a single query with embedded count, not a per-row fetch — check Network tab request count)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- No bank-synced test data exists and there's no way to create any without
  a real Enable Banking connection — implement and typecheck the feature,
  but report the verification gap rather than fabricating a "confirmed
  working" claim.
- Adding the file-count join to the existing movimientos query causes a
  measurable slowdown in manual testing (Network tab response time) or
  breaks pagination — STOP and report instead of shipping a regression.

## Maintenance notes

- This pairs with plan 003 (bulk export) as the natural "triage then
  export" workflow for a treasurer.
- If a future ATM-withdrawal or small-transaction auto-categorization
  feature is added, revisit whether those categories should be excluded
  from the "sin factura" flag by default.
