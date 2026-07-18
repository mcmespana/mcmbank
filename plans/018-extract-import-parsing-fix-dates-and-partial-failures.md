# Plan 018: Extract Excel/CSV import parsing to a testable module; fix timezone date shifts and lost partial-import results

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d759ec9..HEAD -- components/transactions/transaction-import-panel.tsx lib/utils/`
> On drift, compare "Current state" excerpts before proceeding; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — changes money-import behavior (dates); mitigated by extraction-first + tests
- **Depends on**: plans/015-test-baseline-vitest-characterization.md (DONE required)
- **Category**: bug / tech-debt
- **Planned at**: commit `d759ec9`, 2026-07-18

## Why this matters

`components/transactions/transaction-import-panel.tsx` is a 985-line
client component that inlines all Excel/CSV parsing for manual imports —
number parsing, three bank-specific row parsers, a hand-rolled CSV
splitter, dedupe handling — making the money-critical logic untestable.
Two confirmed bugs live in it:

1. **±1-day date shift**: Excel serial dates are converted with
   `new Date((serial - 25569) * 86400 * 1000)` — a **UTC-midnight**
   instant — and bare ISO strings with `new Date(dateString)` (also UTC),
   but the result is then formatted with local-timezone `format(date,
   "yyyy-MM-dd")`. Any browser west of UTC stores every imported
   transaction one day early. (`d/M/yyyy` strings via `date-fns/parse` are
   local and unaffected — the bug is the mixed conventions.)
2. **Lost partial imports**: in the row-by-row fallback (entered on bulk
   unique-violation), a non-duplicate error is thrown mid-loop; the outer
   catch shows only the error — the N rows already inserted this run are
   never reported and `onImported` is never called, so the UI neither
   refreshes nor tells the user those movements now exist. Re-running the
   import is the natural user response, which the dedupe index only
   partially defuses.

## Current state

- `components/transactions/transaction-import-panel.tsx` (985 lines):
  - Date parsing appears in **three near-identical copies** at lines
    ~228-248, ~288-308, ~358-378 (per bank format). Each does:
    ```ts
    if (typeof dateStr === 'number') {
      date = new Date((dateStr - 25569) * 86400 * 1000)        // UTC instant
    } else {
      const dateString = String(dateStr).trim()
      if (dateString.includes('/')) {
        date = parse(dateString, dateString.length <= 9 ? "d/M/yyyy" : "dd/MM/yyyy", new Date(), { locale: es })  // local
      } else {
        date = new Date(dateString)                             // UTC for ISO strings
      }
    }
    ```
    then downstream `format(date, "yyyy-MM-dd")` (locate with
    `grep -n 'format(' components/transactions/transaction-import-panel.tsx`).
  - Row-by-row fallback at lines 560-627: on bulk insert error code
    `23505` (`ux_mov_dedupe`), loops inserting one-by-one; line 601-604:
    a different `singleError` → `throw singleError`; outer catch at
    642-646 sets error state only; `successCount` (line 561) is lost;
    `onImported` (line 620) is only reached on the happy path.
  - `parseEuropeanNumber`, hand-rolled CSV split (~lines 466-489), and a
    skipped-rows/unmatched-categories summary emitted only via
    `console.log` (~437-445).
- Conventions: pure utilities live in `lib/utils/` (see
  `lib/utils/format.ts`, `lib/utils/date-input.ts` — read `date-input.ts`
  first; if it already has TZ-safe date helpers, reuse them instead of
  writing new ones); kebab-case; `@/` imports.
- Test infra from plan 015: Vitest, `pnpm test`, stub/fixture patterns in
  `lib/enable-banking/dedup.test.ts`.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Tests     | `pnpm test`          | all pass |
| Typecheck | `pnpm typecheck` (or `npx tsc --noEmit`) | exit 0 / baseline unchanged |
| Lint      | `pnpm lint`          | exit 0 |
| TZ-forced tests | `TZ=America/New_York pnpm test` and `TZ=Asia/Tokyo pnpm test` | all pass — this is the actual regression gate for the date fix |

## Scope

**In scope**:
- New file `lib/utils/import-parsing.ts` — pure functions:
  `parseImportDate(raw: string | number): string` (returns `yyyy-MM-dd` or
  throws typed error), `parseEuropeanNumber`, `parseCsv(text: string):
  string[][]`, and the per-bank row-mapping helpers.
- New file `lib/utils/import-parsing.test.ts`.
- `components/transactions/transaction-import-panel.tsx` — replace the
  three inline copies with the shared functions; fix the partial-failure
  reporting path.

**Out of scope**:
- UI redesign of the import panel; the column-mapping UX.
- The Enable Banking sync path (`lib/enable-banking/`) — different code.
- Replacing the CSV parser with a library — extract the current one; note
  its quoted-newline limitation in a comment and in your summary.
- `handleForceDuplicate` (line 652+) and dedupe semantics.

## Git workflow

- Branch: `advisor/018-import-parsing`
- One commit per step, conventional commits (e.g.
  `fix(import): timezone-safe date parsing for Excel serials and ISO strings`).
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Extract parsing into `lib/utils/import-parsing.ts` (no behavior change yet)

Move the logic verbatim (including the buggy date behavior) and switch the
component's three copies to call it. If the three copies differ, reconcile
to the superset and note differences in the commit message.

**Verify**: `pnpm typecheck` baseline unchanged; `pnpm lint`; app still
imports a sample file from `ejemplos_importacion/` correctly (`pnpm dev`,
`/transacciones` → import panel).

### Step 2: Characterize, then fix `parseImportDate`

Write tests FIRST asserting the desired TZ-independent behavior, run them
under both `TZ=` values (they should fail pre-fix for at least one TZ),
then fix:

- Excel serial `n` → compute the calendar date arithmetically in UTC and
  emit the string directly:
  `const d = new Date(Math.round((n - 25569)) * 86400 * 1000)` then use
  `d.getUTCFullYear()/getUTCMonth()/getUTCDate()` to build `yyyy-MM-dd` —
  never local `format()`. (Round to guard fractional serials/time parts.)
- `d/M/yyyy` and `dd/MM/yyyy` strings → split on `/` and build the string
  directly (no `Date` object needed).
- Bare `yyyy-MM-dd` strings → validate shape and return as-is.
- Anything else that currently parsed via `new Date(dateString)` →
  parse, but derive the output from UTC getters, matching the input's
  intent; invalid → throw the same `INVALID_DATE`-coded error the panel
  expects (see lines 244-248: `err.row`, `err.code`).

**Verify**: `TZ=America/New_York pnpm test` AND `TZ=Asia/Tokyo pnpm test`
→ all pass, including: serial for 2026-03-15 → `"2026-03-15"` in both TZs;
`"15/3/2026"` → `"2026-03-15"`; `"2026-03-15"` → unchanged.

### Step 3: Report partial-import success

In the row-by-row fallback: wrap the per-row insert so a non-duplicate
`singleError` **breaks the loop** instead of throwing past the
bookkeeping; after the loop (success or break), always: set the message to
include `successCount` imported / `duplicates` duplicates / failed row
number if any, set the error state for the failing row, and call
`onImported(successCount)` whenever `successCount > 0` (mirror the
existing happy-path call at lines 619-623 with its 500 ms `setTimeout`).
The bulk-path catch (642-646) must also call `onImported` when the
fallback loop had partial success — pass the count out rather than relying
on closure state if needed.

**Verify**: manual — craft a small XLSX/CSV where row 3 violates a
constraint other than the dedupe index (e.g. temporarily import with an
invalid categoria mapping if achievable; otherwise simulate by
disconnecting network mid-import): UI must state how many rows DID import,
and the list must refresh to show them.

### Step 4: Surface the console-only summaries

The skipped-rows and unmatched-categories summaries currently logged at
~437-445 must be included in the success message/state shown to the user
(the panel already has `setMessage`; append e.g. "N filas omitidas
(vacías/inválidas)"). Keep the console.logs or remove them — either is
fine; do not add new ones.

**Verify**: import a file with an intentionally blank row → the UI message
mentions the skipped row.

## Test plan

`lib/utils/import-parsing.test.ts` (model after
`lib/enable-banking/dedup.test.ts`):
- `parseImportDate`: the cases in Step 2 plus fractional serial, invalid
  string (throws with `code: "INVALID_DATE"`).
- `parseEuropeanNumber`: `"1.234,56"` → 1234.56; `"-1.234,56"`; `"1234.56"`
  (already-dotted); currency-symbol stripping as currently implemented.
- `parseCsv`: comma rows, quoted field containing comma; add a
  characterization test documenting the known quoted-newline limitation
  (asserting current wrong-but-stable output, commented as such).
- Run matrix: default TZ + the two forced TZs (done via the commands
  table; CI in plan 019 can add one forced-TZ job later).

## Done criteria

- [ ] `grep -c "25569" components/transactions/transaction-import-panel.tsx` → 0 (all date logic in `lib/utils/import-parsing.ts`)
- [ ] `TZ=America/New_York pnpm test` and `TZ=Asia/Tokyo pnpm test` exit 0
- [ ] Partial-failure manual check shows count + refresh
- [ ] `pnpm lint` exit 0; typecheck baseline not worsened
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The three inline parser copies turn out to be *deliberately* different
  per bank in the date logic (not just drift) — report the semantic
  difference before unifying.
- `lib/utils/date-input.ts` already contains a TZ-safe parser the panel
  ignores — use it, and note the duplication instead of writing a new one;
  if its behavior conflicts with Step 2's spec, STOP and report.
- Fixing Step 3 requires restructuring the surrounding 200-line handler
  beyond the fallback loop — report rather than refactor wholesale.

## Maintenance notes

- Existing rows imported before this fix may carry ±1-day `fecha` values.
  A data-repair backfill is NOT part of this plan (it's not detectable
  post-hoc which rows are wrong without the source files) — flag to the
  maintainer that pre-fix imports done from non-UTC browsers are suspect.
- Future: plan 020's contacto/rules matching will want these extracted
  parsers; keep them pure (no Supabase imports in `import-parsing.ts`).
- Reviewers: diff Step 1 carefully — it must be move-only; the behavior
  change is isolated to Steps 2-4.
