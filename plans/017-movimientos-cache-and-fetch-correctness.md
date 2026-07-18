# Plan 017: Fix movimientos cache truncation, stale-fetch race, and filter-blind cache mutations

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d759ec9..HEAD -- contexts/movimientos-cache-context.tsx hooks/use-movimientos.ts lib/services/`
> On drift, compare "Current state" excerpts before proceeding; mismatch = STOP.

## Status

- **Priority**: P2 (high impact, but needs the plan 015 test baseline first)
- **Effort**: M/L
- **Risk**: MED — touches the two hottest data paths in the app
- **Depends on**: plans/015-test-baseline-vitest-characterization.md (DONE required)
- **Category**: bug
- **Planned at**: commit `d759ec9`, 2026-07-18

## Why this matters

Three verified bugs in the transaction data layer:

1. **Silent truncation**: the movimientos cache queries with no
   `.range()`/`.limit()`, so PostgREST's server-side max-rows cap (default
   1000) silently truncates results, and the code then reports
   `totalCount: data.length` while ignoring the exact `count` it asked
   for. A delegation with >1000 movements sees an incomplete ledger with
   no error.
2. **Dropped fetches**: `useMovimientos` bails out of a new fetch while a
   previous one is in flight — so changing filters (or delegation) during
   a slow fetch leaves the list permanently showing the *previous*
   filter's data until an unrelated event refetches.
3. **Filter-blind cache mutation**: after create/edit, the cache prepends/
   patches the row into **every** cached view of that delegation
   regardless of whether the row matches that view's filters — filtered
   lists show rows that don't belong, and counts drift.

Root enabler: the ~90-line select/filter pipeline is duplicated between
`hooks/use-movimientos.ts` and `contexts/movimientos-cache-context.tsx`
and has already diverged (the hook paginates; the cache doesn't).

## Current state

- `contexts/movimientos-cache-context.tsx`:
  - lines 140-233: builds the query — full select string with embedded
    `cuenta`/`categoria`/`contacto`, `{ count: "exact" }` (line 191),
    filters, `.order(...)`, then `await query.abortSignal(ac.signal)`
    with **no `.range()`**.
  - line 247: `return { data: movimientosData, totalCount: movimientosData.length }`
    — the destructuring at line 233 is `const { data, error } = ...`; the
    `count` field is never read.
  - lines 302-312 `updateMovimiento`: patches matching ids in ALL cache
    entries, no filter re-evaluation, no re-sort.
  - lines 314-326 `addMovimiento`: prepends to every entry whose key
    starts with `${movimiento.delegacion_id}|`.
  - lines 282-300 `invalidateCache(delegacionId?)`: already exists and
    correctly deletes entries by delegation prefix — the fix for (3)
    builds on this.
- `hooks/use-movimientos.ts`:
  - lines 122-126: early return `if (fetchingRef.current)` sits BEFORE the
    abort-previous-request logic (lines 129-135); combined with the main
    effect (lines 320-333) which sets `lastFetchKeyRef.current = fetchKey`
    *before* calling `fetchMovimientosRef.current(0, false)`, a fetch
    issued while one is in flight is silently skipped AND the key is
    marked as fetched — so it never retries for that key.
  - lines 351-359 `revalidate`: skips while fetching (acceptable for
    focus revalidation; do not change).
  - The hook's own query pipeline (lines ~155-267) duplicates the cache's.
- Conventions: services layer in `lib/services/database.ts`
  (`DatabaseService` static methods, client-side); `@/` imports; Spanish
  domain names (`movimiento`, `delegacion`).

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Tests     | `pnpm test`          | all pass (baseline from plan 015 + new ones) |
| Typecheck | `pnpm typecheck` (or `npx tsc --noEmit` if plan 016 hasn't landed) | exit 0 / unchanged count |
| Lint      | `pnpm lint`          | exit 0 |
| Dev       | `pnpm dev`           | :3000 |

## Scope

**In scope**:
- New file `lib/services/movimientos-query.ts` — the single shared query
  builder (select string + filter application + contacto-id resolution),
  pure/injectable enough to unit-test filter application with a stub
  builder (same technique as `hooks/use-movimientos.filter.test.ts` from
  plan 015).
- `contexts/movimientos-cache-context.tsx` — consume the shared builder;
  add an explicit `.range()`; read `count`; replace filter-blind mutation.
- `hooks/use-movimientos.ts` — consume the shared builder; fix the
  dropped-fetch race.
- New tests: `lib/services/movimientos-query.test.ts`.

**Out of scope**:
- `useRevalidateOnFocusJitter` cadence / focus-revalidation dedupe (perf
  finding, deferred — see plans/README.md rejected list).
- Virtualizing the transaction table; payload slimming (id-only selects).
- `lib/services/database.ts` vs `server-database.ts` categoria dedupe —
  that's plan 008.
- Any server/SQL change.

## Git workflow

- Branch: `advisor/017-movimientos-cache-correctness`
- One commit per step, conventional commits (e.g.
  `fix(movimientos): paginate cache query and propagate real count`).
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Extract the shared query builder

Create `lib/services/movimientos-query.ts` exporting:

- `MOVIMIENTO_SELECT` — the select string currently duplicated (take the
  cache's version, `contexts/movimientos-cache-context.tsx:143-190`; diff
  it against the hook's version first and reconcile any field difference
  explicitly in the commit message).
- `applyMovimientoFilters(query, filters, contactoIdsExtra)` — the filter
  chain (fecha range, categoriaIds, cuentaId, contactoIds, contactoTipos
  incl. the `00000000-...` sentinel, busqueda `.or()` escaping, absolute
  amount via the existing `applyAbsoluteAmountFilter` from
  `hooks/use-movimientos.ts:31` — move that function here and re-export it
  from the hook for compatibility), `uncategorized`.
- `resolveContactoIdsExtra(supabase, filters, signal)` — the contacto
  name/tipo lookup currently duplicated.

Switch BOTH `use-movimientos.ts` and the cache context to these. Behavior
must be identical — this step is pure extraction.

**Verify**: `pnpm test` (plan 015's filter tests still pass — update their
import path), `pnpm typecheck` / unchanged tsc count, `pnpm lint`.

### Step 2: Fix truncation in the cache

In the cache's fetch: add `.range(0, MAX_CACHE_ROWS - 1)` with
`const MAX_CACHE_ROWS = 1000` (explicit, commented: PostgREST caps
responses anyway; this makes the cap visible), destructure
`const { data, error, count } = await query...`, store `count` in the
cache entry, and return `totalCount: count ?? movimientosData.length`.
When `count` exceeds `data.length`, the entry must carry a `truncated: true`
flag so consumers can render a "showing first N of M" notice — find the
cache's consumer (grep `useMovimientosCache` / the context's consumer hook)
and surface the flag to it; if no consumer renders counts today, exposing
the flag on the context value is sufficient (note it in your summary).

**Verify**: `pnpm typecheck`; manual: `pnpm dev`, open `/transacciones`,
confirm list loads and (if any view uses the cache path) the total shown
matches the real count for a small delegation.

### Step 3: Fix the dropped-fetch race in `use-movimientos.ts`

Reorder so a new fetch for a NEW key aborts the in-flight one instead of
bailing: move the `if (fetchingRef.current) return` guard so it applies
only to same-key duplicate calls (e.g. pass the triggering `fetchKey` into
`fetchMovimientos` and compare, or track `inFlightKeyRef`). The abort
logic at lines 129-135 already exists — the fix is to reach it. Preserve:
the Strict-Mode cleanup behavior (lines 335-347), the revalidate guard
(line 353), `loadMore`'s guard (line 364).

**Verify**: manual — `pnpm dev`, `/transacciones`, rapidly toggle two
category filters while throttling network in devtools ("Slow 3G"): final
list must match the final filter selection. `pnpm test` still green.

### Step 4: Make cache mutations filter-safe

Replace the bodies of `addMovimiento` and `updateMovimiento` in the cache
context with invalidation-based behavior: keep an optimistic patch ONLY
for the exact cache entry whose filters the row is known to satisfy if
that's cheaply determinable; otherwise call the existing
`invalidateCache(movimiento.delegacion_id)` so views refetch. Simplest
correct version (acceptable): both mutators just delegate to
`invalidateCache(delegacion_id)` — measure UX in the manual check; if the
post-create refresh visibly regresses (list flashes empty), keep the
prepend for the *unfiltered* cache key only (the key built from
`getCacheKey(delegacionId, undefined)` — read `getCacheKey` to construct
it) and invalidate the rest.

**Verify**: manual — create a movement dated outside an active date
filter: it must NOT appear in the filtered list, and must appear when the
filter is cleared. Edit a movement's category while filtering by a
different category: it must disappear from that filtered view (after
refetch).

## Test plan

- `lib/services/movimientos-query.test.ts` (model after plan 015's
  `hooks/use-movimientos.filter.test.ts` stub-builder pattern):
  - each filter branch calls the expected builder method with expected args
  - busqueda escaping of `%` and `,`
  - contactoTipos sentinel uuid when no contacts match
  - absolute-amount branches (reuse/extend the moved tests)
- Manual checks embedded in steps 2-4.
- `pnpm test` → all pass.

## Done criteria

- [ ] `grep -c "from(\"movimiento\")" hooks/use-movimientos.ts contexts/movimientos-cache-context.tsx` — each builds via the shared module (select string defined exactly once: `grep -rn "adjunto_principal_url" --include='*.ts*' hooks contexts lib | wc -l` → 1 definition site)
- [ ] Cache fetch has explicit `.range()` and returns server `count`
- [ ] Rapid filter-change manual test shows final filter's data
- [ ] Filtered views no longer show non-matching created/edited rows
- [ ] `pnpm test`, `pnpm lint` exit 0; typecheck baseline not worsened
- [ ] `plans/README.md` status row updated

## STOP conditions

- The two select strings differ in a field whose reconciliation would
  change rendered data (e.g. one embeds a relation the other lacks and a
  component depends on its absence) — report the diff instead of picking.
- Step 3's reorder causes a fetch loop (repeated aborted requests in the
  Network tab) — revert Step 3, report, keep Steps 1-2-4.
- Plan 015 is not DONE in `plans/README.md` — stop before starting.

## Maintenance notes

- Reviewers: scrutinize Step 4 — the failure mode is over-invalidation
  (excess refetches) vs. under-invalidation (stale rows); we chose
  correctness over chattiness.
- The deferred focus-revalidation dedupe (see index) becomes easier after
  this: the shared builder gives one place to key a request-dedupe map.
- If real pagination is later added to the cache path, `MAX_CACHE_ROWS`
  and the `truncated` flag are the seams to extend.
