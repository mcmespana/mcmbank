# Plan 015: Characterization tests for Enable Banking dedupe/money mapping and category ordering

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d759ec9..HEAD -- package.json lib/enable-banking/dedup.ts hooks/use-categorias.ts vitest.config.*`
> On any in-scope drift, compare "Current state" excerpts before proceeding;
> on a mismatch, STOP.

## Status

- **Priority**: P1 — prerequisite: plans 017 and 018 must not start before this lands.
- **Effort**: S (rescoped 2026-07-18: the Vitest harness now already exists in the repo)
- **Risk**: LOW (purely additive — no production code changes except one named export)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `d759ec9`, 2026-07-18

## Why this matters

As of `d759ec9` the repo has Vitest (`vitest ^4.1.8`, script
`"test": "vitest run"`) and four test files (`lib/utils/date-input.test.ts`,
`lib/utils/format.test.ts`, `lib/utils/category-permissions.test.ts`,
`lib/db/amount-filter.test.ts`) — but the **money-critical Enable Banking
logic has zero tests**: the function that decides whether a synced bank
transaction is a duplicate (`resolveExternalId`) and the one that decides
its sign and date (`mapTransactionToMovimiento`) are unguarded. So is the
category-ordering helper (`sortCategorias`). A regression in any of these
silently corrupts the ledger or the UI ordering. These are pure functions
— the cheapest, highest-value tests in the codebase. This plan adds
characterization tests that lock in **current** behavior, including two
known quirks asserted as-is so later fix-plans can flip the assertions
deliberately.

## Current state

- Test infra exists: run `pnpm test` first and record the passing
  baseline; open `lib/db/amount-filter.test.ts` and one of the
  `lib/utils/*.test.ts` files and **match their structure and style**
  (describe/it naming, fixture style, import conventions).
- `lib/enable-banking/dedup.ts` (unchanged between 0bc851b and d759ec9;
  re-verify via the drift check) — two pure exported functions:
  - `resolveExternalId(tx)` (lines 29-69): 3-tier dedupe id —
    `transaction_id` → `tid:` prefix; else `entry_reference` → `eref:`;
    else sha256 over 10 joined fields (booking/value/transaction dates,
    currency, amount, `credit_debit_indicator`, counterparty fallback
    chain iban→bban→`other.identification`→name, joined
    `remittance_information`, `reference_number`, `bank_transaction_code`)
    truncated to 32 hex chars with `ch:` prefix.
  - `mapTransactionToMovimiento(tx, ctx)` (lines 75-138): behaviors to
    characterize:
    - line 99: `const isDebit = tx.credit_debit_indicator === "DBIT"` —
      anything else (including `undefined` or `"dbit"`) counts as credit.
    - line 101: non-finite `parseFloat` result → `importe = 0` (silent).
    - line 104: missing all three dates → today's date via `new Date()`
      (in tests, always pass at least one date to avoid clock dependence).
    - line 127: `concepto` truncated to 500 chars; fallback chain
      remittance[0] → creditor.name → debtor.name → reference_number →
      `"Movimiento bancario"`.
  - Types from `./types` (`EBTransaction`) — build fixtures as plain
    objects cast `as EBTransaction` if optional fields fight you.
- `hooks/use-categorias.ts:14` — `sortCategorias` is a module-local
  `const`; export it (named export, no behavior change) to test it. Read
  the surrounding orden-efectivo/override resolution before writing
  expectations.
- Note: `applyAbsoluteAmountFilter` already lives in
  `lib/db/amount-filter.ts` **with tests** — do NOT duplicate them.

## Commands you will need

| Purpose   | Command                        | Expected on success |
|-----------|---------------------------------|----------------------|
| Tests     | `pnpm test`                     | all pass (existing baseline + new) |
| Lint      | `pnpm lint`                     | exit 0 |
| Typecheck | `npx tsc --noEmit`              | error count unchanged vs. before this plan (a failing baseline is plan 016's job) |

## Scope

**In scope**:
- New test files: `lib/enable-banking/dedup.test.ts`,
  `hooks/use-categorias.sort.test.ts`.
- `hooks/use-categorias.ts` — ONLY adding `export` to `sortCategorias`.
- `vitest.config.*` — only if `hooks/**` is excluded from test discovery
  and needs adding to the include globs.

**Out of scope**:
- Component/hook rendering tests; React Testing Library.
- Fixing ANY behavior the tests reveal (the `importe → 0` fallback, the
  missing-indicator-means-credit rule). Characterize, don't fix.
- The existing four test files.
- `components/transactions/transaction-import-panel.tsx` (plan 018 covers
  its parsing).

## Git workflow

- Branch: `advisor/015-eb-characterization-tests`
- Conventional commits, e.g. `test: characterize EB dedupe id resolution and money mapping`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Record the baseline

Run `pnpm test` and note the current pass count. Open the existing test
files listed above and note the structural conventions to copy.

**Verify**: `pnpm test` → exit 0 (record N passing).

### Step 2: `lib/enable-banking/dedup.test.ts` — `resolveExternalId`

Table-driven cases:
1. `transaction_id` present → `tid:<id>`, source `transaction_id`
   (whitespace-only id falls through to the next tier).
2. No `transaction_id`, `entry_reference` present → `eref:` / `entry_reference`.
3. Neither → `ch:` prefix, 32 hex chars, source `composite_hash`.
4. Determinism: same input twice → identical id.
5. Sensitivity: two same-day/same-amount transactions differing only in
   `creditor_account.iban` OR only in `remittance_information` →
   **different** hashes (the documented "5 identical monthly payments"
   case, comment block at `dedup.ts:11-28`).
6. Counterparty priority: changing a higher-priority field (iban) changes
   the hash even when a lower one (name) is constant.

### Step 3: same file — `mapTransactionToMovimiento`

1. `"DBIT"` + `"100.50"` → `importe === -100.5`.
2. `"CRDT"` + `"100.50"` → `+100.5`; `"CRDT"` + `"-100.50"` → `+100.5`.
3. Missing indicator → positive (characterization of a suspected bug —
   comment it `// characterization: see plans/README.md deferred list`).
4. Unparseable amount `"abc"` → `0` (same characterization comment).
5. `fecha` preference: booking_date → value_date → transaction_date.
6. `concepto` fallback chain and 500-char truncation.
7. `descripcion` = remittance lines 2+ joined with `\n`; `null` when none.

### Step 4: `hooks/use-categorias.sort.test.ts`

Export `sortCategorias`, then cover (after reading the implementation):
effective-order precedence (override beats base), alphabetical tiebreak,
and whatever inactive/visibility handling the function actually implements
— assert current behavior.

**Verify (2-4)**: `pnpm test` → all pass (baseline N + ≥ 15 new).

## Test plan

This plan IS the test plan. Final: `pnpm test` green, `pnpm lint` green,
tsc error count unchanged.

## Done criteria

- [ ] `pnpm test` exits 0 with ≥ 15 new passing tests in the 2 new files
- [ ] Production-code diff is exactly one added `export` keyword (`git diff --stat` shows only `hooks/use-categorias.ts` ±1 line outside tests/config)
- [ ] `pnpm lint` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- `lib/enable-banking/dedup.ts` no longer matches the excerpts (drifted
  since d759ec9) — re-read and re-derive expectations from the current
  code; if the functions were removed/renamed, STOP and report.
- `sortCategorias` turns out not to be pure — skip that file, note it,
  finish the dedup tests.
- Any test you write fails against current behavior — your expectation is
  wrong, not the code: characterization tests encode what the code DOES.
  If you cannot reconcile, report the input/output pair instead of
  "fixing" production code.

## Maintenance notes

- Plans 017/018 depend on this baseline. Plan 019's CI runs `pnpm test`.
- The two characterized quirks (missing indicator → credit; unparseable
  amount → 0) are candidate real bugs pending verification against live
  Enable Banking payloads — when fixed, flip those assertions in the same
  commit as the fix.
- Reviewers: fixtures must be synthetic — no real bank data.
