# Plan 015: Establish a Vitest verification baseline with characterization tests on money-critical pure logic

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d759ec9..HEAD -- package.json lib/enable-banking/dedup.ts hooks/use-categorias.ts hooks/use-movimientos.ts`
> On any in-scope drift, compare "Current state" excerpts before proceeding;
> on a mismatch, STOP.

## Status

- **Priority**: P1 — prerequisite: plans 017 and 018 must not start before this lands.
- **Effort**: M
- **Risk**: LOW (purely additive — no production code changes except optional named exports)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `d759ec9`, 2026-07-18

## Why this matters

This repo has **zero tests and no test runner** (`package.json` scripts:
only `build`, `dev`, `lint`, `lint:fix`, `start`; no `*.test.*` files
exist), while `next.config.mjs` sets `typescript.ignoreBuildErrors: true`
— so there is currently no automated signal at all that a change broke
something. That is untenable for a banking ledger app: the functions that
decide whether a synced bank transaction is a duplicate, whether an amount
is income or expense, and which transactions a filter returns are all
pure, cheap to test, and currently unguarded. This plan adds Vitest, a
`test` script, and characterization tests that lock in **current**
behavior (including two known quirks documented below, asserted as-is so
later fix-plans can flip the assertions deliberately).

## Current state

- `package.json` — `"type": "module"`, pnpm, no test infra. Node >= 20.
- `lib/enable-banking/dedup.ts` — two pure exported functions:
  - `resolveExternalId(tx)` (lines 29-69): 3-tier dedupe id —
    `transaction_id` → `tid:` prefix; else `entry_reference` → `eref:`;
    else sha256 over 10 joined fields (booking/value/transaction dates,
    currency, amount, `credit_debit_indicator`, counterparty fallback
    chain, joined `remittance_information`, `reference_number`,
    `bank_transaction_code`) truncated to 32 hex chars with `ch:` prefix.
  - `mapTransactionToMovimiento(tx, ctx)` (lines 75-138): notable current
    behaviors to characterize:
    - line 99: `const isDebit = tx.credit_debit_indicator === "DBIT"` —
      anything else (including `undefined` or `"dbit"`) counts as credit.
    - line 101: non-finite `parseFloat` result → `importe = 0` (silent).
    - line 104: missing all three dates → today's date via `new Date()`.
    - line 127: `concepto` truncated to 500 chars.
  - Types come from `./types` (`EBTransaction`) — build fixtures as plain
    objects cast with `as EBTransaction` if optional fields fight you.
- `hooks/use-categorias.ts:14` — exported? Check: the audit found a
  `sortCategorias` helper at the top of this file plus
  `orden_efectivo`/override resolution around lines 107-118. If the helper
  is module-local, add a named `export` (allowed production change).
- `hooks/use-movimientos.ts:31` — `applyAbsoluteAmountFilter(query, from, to)`,
  already exported; builds PostgREST `.or()` clauses matching absolute
  values of `importe` (both sign ranges). It takes a Supabase query
  builder; test it with a minimal stub object that records `gte`/`lte`/`or`
  calls and returns itself.
- Convention: kebab-case filenames, `@/` imports, 2-space indent, ESLint 9
  flat config at `eslint.config.js` (ignores `.next/`, `node_modules/`,
  `scripts/`).

## Commands you will need

| Purpose   | Command                        | Expected on success |
|-----------|---------------------------------|----------------------|
| Install   | `npx pnpm install`              | exit 0 |
| Add deps  | `npx pnpm add -D vitest`        | exit 0 (pin the resolved version, never `"latest"`) |
| Tests     | `pnpm test`                     | all pass |
| Lint      | `pnpm lint`                     | exit 0 |
| Typecheck | `npx tsc --noEmit`              | error count unchanged vs. before this plan (pre-existing failures are plan 016's job) |

## Scope

**In scope**:
- `package.json` (+ `pnpm-lock.yaml`): add `vitest` devDependency (pinned
  semver, NOT `"latest"`), add `"test": "vitest run"` and
  `"test:watch": "vitest"` scripts.
- `vitest.config.ts` (create): node environment, include
  `lib/**/*.test.ts` and `hooks/**/*.test.ts`, alias `@/` → repo root.
- New test files:
  - `lib/enable-banking/dedup.test.ts`
  - `hooks/use-categorias.sort.test.ts` (tests only the pure sort helper)
  - `hooks/use-movimientos.filter.test.ts` (tests only `applyAbsoluteAmountFilter`)
- `hooks/use-categorias.ts` — ONLY if the sort helper is not exported: add
  `export` to it. No behavior change.
- `eslint.config.js` — only if lint flags the new test files in a way that
  needs a targeted override; prefer conforming the tests instead.

**Out of scope**:
- React Testing Library / component or hook rendering tests — pure
  functions only in this baseline.
- Fixing ANY behavior the tests reveal (the `importe → 0` fallback, the
  missing-indicator-means-credit rule). Characterize, don't fix — fixes
  are plans 017/018 and a future EB-hardening pass.
- CI wiring (plan 019 consumes `pnpm test`).
- `components/transactions/transaction-import-panel.tsx` — its parsing
  logic is not yet importable; plan 018 extracts it and adds its tests.

## Git workflow

- Branch: `advisor/015-vitest-baseline`
- Conventional commits, e.g. `test: add vitest baseline and characterization tests for EB dedupe and money mapping`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Install and configure Vitest

`npx pnpm add -D vitest`, then create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "hooks/**/*.test.ts"],
  },
})
```

Add scripts `"test": "vitest run"`, `"test:watch": "vitest"`.

**Verify**: `pnpm test` → exit 0 with "no test files found" (or 0 tests) —
runner works.

### Step 2: Characterization tests for `resolveExternalId`

In `lib/enable-banking/dedup.test.ts`, table-driven cases:

1. `transaction_id` present → `tid:<id>`, source `transaction_id`
   (whitespace-only `transaction_id` falls through).
2. No `transaction_id`, `entry_reference` present → `eref:` / `entry_reference`.
3. Neither → `ch:` prefix, 32-hex-char hash, source `composite_hash`.
4. Determinism: same input twice → identical id.
5. Sensitivity: two same-day/same-amount transactions differing only in
   `creditor_account.iban` OR in `remittance_information` produce
   **different** hashes (the documented "5 identical monthly payments"
   case, see the comment block at `dedup.ts:11-28`).
6. Counterparty fallback order: iban beats bban beats
   `other.identification` beats `creditor.name` (assert via hash
   inequality when higher-priority field changes).

### Step 3: Characterization tests for `mapTransactionToMovimiento`

Cases (assert CURRENT behavior, with a `// characterization:` comment on
the two quirks):

1. `credit_debit_indicator: "DBIT"`, amount `"100.50"` → `importe === -100.5`.
2. `"CRDT"`, `"100.50"` → `+100.5`; negative raw string `"-100.50"` with
   `"CRDT"` → `+100.5` (Math.abs behavior).
3. Missing indicator → treated as credit (positive) — characterization of
   the known LOW-confidence risk; do not "fix".
4. Unparseable amount (`"abc"`) → `importe === 0` — characterization.
5. `fecha` prefers `booking_date`, then `value_date`, then
   `transaction_date` (pass all three, then progressively omit).
6. `concepto` = first remittance line; falls back to creditor name, debtor
   name, reference_number, then literal `"Movimiento bancario"`; truncated
   at 500 chars.
7. `descripcion` = remittance lines 2+ joined by `\n`, `null` when none.

### Step 4: Tests for the category sort helper and `applyAbsoluteAmountFilter`

- `hooks/use-categorias.sort.test.ts`: read `hooks/use-categorias.ts`
  first; export the pure sort/orden-efectivo helper if needed. Cover:
  override order beats base order; equal effective order falls back to
  alphabetical; inactive/visibility override handling as implemented.
- `hooks/use-movimientos.filter.test.ts`: stub builder
  `{ calls: [], gte(...a){this.calls.push(["gte",...a]);return this}, lte(...){...}, or(...){...} }`.
  Cover: no bounds → untouched; from-only; to-only; both bounds — assert
  the exact clause strings produced for each branch (read the
  implementation at `hooks/use-movimientos.ts:31` and lock in its current
  output, including the single-level `.or()` PostgREST workaround noted in
  commit 60b6fd8).

**Verify (steps 2-4)**: `pnpm test` → all tests pass (expect ~20+).

## Test plan

This plan IS the test plan. Final: `pnpm test` green, `pnpm lint` green,
`npx tsc --noEmit` unchanged error count.

## Done criteria

- [ ] `pnpm test` exits 0 with ≥ 20 passing tests across 3 files
- [ ] `grep -n '"test"' package.json` shows the vitest script
- [ ] `grep -c '"latest"' package.json` did not increase
- [ ] Production-code diff is empty except (optionally) one added `export` keyword in `hooks/use-categorias.ts`
- [ ] `pnpm lint` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- `vitest` cannot resolve the `@/` alias or ESM setup after two config
  attempts — report the exact error rather than restructuring source files.
- The sort helper in `hooks/use-categorias.ts` turns out not to be pure
  (touches React state or Supabase) — skip that test file, note it, and
  finish the other two.
- Any test you write fails against current behavior — your expectation is
  wrong, not the code: re-read the implementation. Characterization tests
  must encode what the code DOES today. If you cannot reconcile, report
  the input/output pair instead of "fixing" production code.

## Maintenance notes

- Plans 017/018 depend on this baseline and will extend it. Plan 019 wires
  `pnpm test` into CI.
- The two characterized quirks (missing `credit_debit_indicator` → credit;
  unparseable amount → 0) are candidate real bugs pending verification
  against live Enable Banking payloads — when fixed, flip those specific
  assertions in the same commit as the fix.
- Reviewers: check no fixture contains real bank data — fixtures must be
  synthetic.
