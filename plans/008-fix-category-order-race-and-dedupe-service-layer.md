# Plan 008: Fix category-order upsert race condition, deduplicate client/server service layer, remove dead hook

> **Executor instructions**: Follow this plan step by step, run every
> verification command, and stop per STOP conditions rather than
> improvising. Update `plans/README.md`'s status row when done.
>
> **Drift check**: `git diff --stat 0bc851b..HEAD -- lib/services/database.ts lib/services/server-database.ts hooks/use-cuentas-original.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug / tech-debt
- **Planned at**: commit `0bc851b`, 2026-07-16

## Why this matters

Three related, independently small issues in the data-service layer:

1. **Race condition**: `setDelegacionCategoryOrder` and
   `setDelegacionCategoryVisibility` in `lib/services/database.ts` (and
   duplicated verbatim in `lib/services/server-database.ts`) use a
   check-then-act pattern — `UPDATE ... WHERE match`, check if zero rows
   changed, then `INSERT` — instead of an atomic upsert. Two near-
   simultaneous requests for the same category (e.g. rapid drag-and-drop
   reordering, or two admins editing at once) can both see zero matched
   rows and both attempt `INSERT`, throwing an unhandled unique-constraint
   error to the UI.
2. **Duplication**: The exact same query/mapping logic for categories is
   implemented twice — once in `DatabaseService` (client) and once in
   `ServerDatabaseService` (server) — meaning this race-condition fix (and
   any future fix) has to be applied in two places, and they can silently
   drift apart.
3. **Dead code**: `hooks/use-cuentas-original.ts` is unused (confirmed via
   `grep -rl "use-cuentas-original"` returning only the file itself) and
   left over from a past migration to `hooks/use-cuentas.ts` — noise for
   anyone auditing account-fetching logic.

## Current state

- `lib/services/database.ts:153-207` — `setDelegacionCategoryOrder` and
  `setDelegacionCategoryVisibility`, the check-then-act pattern:
  ```ts
  const { data, error } = await supabase
    .from("categoria_orden_delegacion")
    .update({ orden, actualizado_en: now } as any)
    .match({ delegacion_id: delegacionId, categoria_id: categoriaId })
    .select("categoria_id")
  if (error) throw error
  if (!data || data.length === 0) {
    const { error: insertError } = await supabase.from("categoria_orden_delegacion").insert({...})
    if (insertError) throw insertError
  }
  ```
- `lib/services/server-database.ts:230-285` — the identical duplicate.
- `categoria_orden_delegacion` table — need its unique constraint columns
  to write the correct `onConflict` target for `upsert`. Check
  `lib/types/database.ts`'s type definition and/or the migration script
  that created this table (`grep -rl "categoria_orden_delegacion" scripts/`)
  for the actual unique constraint (almost certainly
  `(delegacion_id, categoria_id)` given the query pattern, but confirm —
  don't assume).
- `hooks/use-cuentas-original.ts` — 51 lines, zero importers.
- `hooks/use-cuentas.ts` — the active 195-line replacement, confirmed wired
  up throughout the app.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Typecheck | `npx tsc --noEmit`   | exit 0               |
| Lint      | `pnpm lint`          | exit 0               |
| Dev server (manual) | `pnpm dev`  | starts on :3000      |

## Scope

**In scope**:
- `lib/services/database.ts` — the two methods above, plus extraction of
  shared category-order logic (see Step 2).
- `lib/services/server-database.ts` — same.
- New file: `lib/services/categoria-queries.ts` (shared client-agnostic
  query functions).
- Delete: `hooks/use-cuentas-original.ts`.

**Out of scope**:
- Any other pair of duplicated methods between `database.ts` and
  `server-database.ts` beyond the two named here — a full audit/dedup of
  the entire service layer is a larger effort; this plan fixes the specific
  race-prone methods and establishes the pattern (`categoria-queries.ts`)
  another pass could extend later.
- `hooks/use-transacciones-original.ts` and `hooks/use-delegaciones-original.ts`
  if they exist (the original SECURITY-AUDIT.md's Semgrep findings mention
  them) — check with `grep -rl` whether they're similarly dead; if so, note
  it in your summary as a follow-up finding for a future plan, but do not
  delete them here without the same zero-importers confirmation this plan
  did for `use-cuentas-original.ts` — that verification is this plan's
  scope only for the one file named above.

## Git workflow

- Branch: `advisor/008-fix-category-race-dedupe-service`
- One commit per step, conventional commits (e.g.
  `fix(categorias): use atomic upsert to eliminate order/visibility race`,
  `refactor(categorias): extract shared query logic between client and server services`,
  `chore: remove dead use-cuentas-original hook`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Confirm the unique constraint

Run `grep -rn "categoria_orden_delegacion" scripts/*.sql` and read the
`CREATE TABLE`/`CREATE UNIQUE INDEX` statement for this table. Confirm the
exact unique constraint columns (expected: `(delegacion_id, categoria_id)`,
but verify). **STOP and report if no unique constraint exists on this
column pair** — `upsert` with `onConflict` requires one to exist in the
database, and adding one is a schema migration outside this plan's
directly-scoped changes (though you may propose the migration in your
summary as a prerequisite).

### Step 2: Extract shared upsert logic into `categoria-queries.ts`

Create `lib/services/categoria-queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types/database"

export async function upsertCategoriaOrdenDelegacion(
  supabase: SupabaseClient<Database>,
  params: { delegacionId: string; categoriaId: string; orden: number; estaActiva: boolean },
): Promise<void> {
  const { error } = await supabase
    .from("categoria_orden_delegacion")
    .upsert(
      {
        delegacion_id: params.delegacionId,
        categoria_id: params.categoriaId,
        orden: params.orden,
        esta_activa: params.estaActiva,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "delegacion_id,categoria_id" },
    )

  if (error) throw error
}
```

Adjust the `onConflict` string to match whatever Step 1 confirmed. Read
`lib/services/database.ts`'s existing imports/types (`getClient()`'s return
type) to make sure the `SupabaseClient<Database>` typing lines up with
what both `DatabaseService` and `ServerDatabaseService` actually use —
match their existing type patterns rather than introducing a new one that
conflicts.

**Verify**: `npx tsc --noEmit` → exit 0 (standalone file, not yet called).

### Step 3: Replace both methods in both service files

In `lib/services/database.ts`, replace the bodies of
`setDelegacionCategoryOrder` and `setDelegacionCategoryVisibility` with
calls to `upsertCategoriaOrdenDelegacion(this.getClient(), {...})`,
preserving each method's existing public signature (parameters and return
type) so callers (`hooks/use-categorias.ts` and any others —
`grep -rn "setDelegacionCategoryOrder\|setDelegacionCategoryVisibility"`
first) don't need to change.

Do the same in `lib/services/server-database.ts` using its server client
accessor.

**Verify**: `npx tsc --noEmit` → exit 0; `grep -rn "setDelegacionCategoryOrder\|setDelegacionCategoryVisibility" hooks/ components/` still resolves to the same call sites with unchanged signatures.

### Step 4: Manual race-condition sanity check

Since a true concurrency test isn't practical to script without a test
runner, do a functional sanity check instead:
1. `pnpm dev`, log in, go to `/categorias`.
2. Reorder a category (drag-and-drop or whatever UI exists) several times
   rapidly.
3. Confirm no unhandled error/toast appears and the final order persists
   correctly on page reload.
4. Toggle a category's visibility on/off rapidly a few times; confirm the
   final state is correct and no error appears.

### Step 5: Delete the dead hook

```bash
grep -rl "use-cuentas-original" app components hooks contexts
```
Confirm zero results (excluding the file itself), then:
```bash
git rm hooks/use-cuentas-original.ts
```

**Verify**: `npx tsc --noEmit` → exit 0 (nothing should have imported it).

## Test plan

No test runner configured. Steps 4 (manual functional check) and the
typecheck/grep commands throughout are the verification. Record the actual
grep output confirming zero remaining references to the deleted file and
to the old duplicated logic.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `grep -rn "match({ delegacion_id" lib/services/` returns no matches (old check-then-act pattern fully removed)
- [ ] Both `database.ts` and `server-database.ts` call the shared `categoria-queries.ts` functions
- [ ] Manual reorder/visibility-toggle check in Step 4 shows no errors and correct final state
- [ ] `hooks/use-cuentas-original.ts` deleted, `npx tsc --noEmit` still passes
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- No unique constraint exists on `(delegacion_id, categoria_id)` (or
  whatever Step 1 finds) in the actual database schema — upsert's
  `onConflict` won't work without one; report this as a prerequisite
  migration rather than shipping a broken upsert.
- Any other caller of the two methods being changed has a signature
  expectation not accounted for here — trace all call sites before
  changing the public method signatures, and if any expects the old
  "insert if update matched zero rows" *return value* (neither method
  currently returns anything meaningful, so this is unlikely, but verify).

## Maintenance notes

- `categoria-queries.ts` establishes a pattern: future category-query
  duplication between the client/server services should be extracted here
  too, not re-duplicated. A larger follow-up plan could apply this pattern
  to `getCategoriasByDelegacion` and other duplicated methods identified in
  the audit but out of this plan's scope.
- If `hooks/use-transacciones-original.ts` / `use-delegaciones-original.ts`
  are confirmed dead in a future pass, delete them the same way Step 5
  did here.
