# Plan 009: Aggregate the Balance dashboard server-side; add cache eviction to the movimientos cache

> **Executor instructions**: Follow this plan step by step, run every
> verification command, and stop per STOP conditions rather than
> improvising. Update `plans/README.md`'s status row when done.
>
> **Drift check**: `git diff --stat 0bc851b..HEAD -- components/dashboard/activity-balance.tsx hooks/use-financial-summary.ts contexts/movimientos-cache-context.tsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `0bc851b`, 2026-07-16

## Why this matters

`components/dashboard/activity-balance.tsx:67-75` calls `useMovimientos`
with `{ pageSize: 0 }`, which per `hooks/use-movimientos.ts` skips
`.range()` entirely and loads **every** filtered movimiento (with joined
`cuenta`/`categoria`/`contacto` relations) client-side to compute
weekly/monthly/yearly balance buckets in the browser. This is the same
class of problem `docs/FUTURE_DEVELOPMENTS.md` already documented and fixed
for `FinancialSummary` — that component now calls a `get_financial_summary`
Postgres RPC (`lib/services/database.ts:401`) instead of fetching raw rows.
`ActivityBalanceDashboard` was never migrated to the same pattern and is
now the worse offender since it also carries joined relation data. For a
delegation with a large transaction history, every visit to the Balance
tab downloads the entire filtered dataset.

Separately, `contexts/movimientos-cache-context.tsx` caches fetched
movimiento pages keyed by delegation+filters, but **never evicts entries**
— only an explicit `invalidateCache()` call removes anything. The
`CACHE_TTL` constant only controls whether a *stale* entry is refetched, not
whether memory is ever reclaimed, so long sessions with many distinct
filter/search/date-range combinations accumulate an ever-growing map of
full transaction datasets for the lifetime of the tab.

## Current state

- `components/dashboard/activity-balance.tsx:67-75`:
  ```ts
  const { movimientos } = useMovimientos(
    selectedDelegation,
    { fechaDesde, fechaHasta, categoriaIds },
    { pageSize: 0 } // Disable pagination to load ALL movements
  )
  ```
  and lines ~115-120 do the client-side weekly/monthly/yearly bucketing —
  read this section in full before designing the RPC's return shape so the
  aggregation buckets match exactly what the RPC should produce.
- `lib/services/database.ts:394-408` — the existing `get_financial_summary`
  RPC call, the pattern to mirror:
  ```ts
  let query = client.rpc("get_financial_summary", {
    // ... read the full call for the exact param shape
  })
  ```
- `hooks/use-financial-summary.ts` — the hook wrapping the RPC call; use as
  the structural pattern for a new `use-activity-balance.ts` hook (or
  extend the existing one if the buckets it already returns are a superset
  of what `ActivityBalanceDashboard` needs — read both before deciding
  whether to extend vs. create new).
- `scripts/037_aggregation_functions.sql` — very likely where
  `get_financial_summary` (and possibly other aggregation RPCs) are
  defined; read this file in full to learn this repo's SQL RPC conventions
  (parameter naming, return type shape, delegation-scoping via RLS or
  explicit `delegacion_id` param) before writing a new one.
- `contexts/movimientos-cache-context.tsx:44-63` — `CACHE_TTL = 30000`,
  `cacheRef` as a plain `Map`, `getCacheKey`/`serializeFilters` producing a
  distinct key per unique filter combination; `:282-300` — the only
  eviction path is explicit `invalidateCache()`.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Typecheck | `npx tsc --noEmit`   | exit 0               |
| Lint      | `pnpm lint`          | exit 0               |
| Dev server (manual) | `pnpm dev`  | starts on :3000      |

## Scope

**In scope**:
- New SQL migration: `scripts/043_activity_balance_rpc.sql`
- `lib/services/database.ts` — new method calling the new RPC.
- New hook: `hooks/use-activity-balance.ts` (or extend
  `use-financial-summary.ts` if Step 1's investigation shows they should
  share one RPC — your judgment call, document the reasoning in your
  summary either way).
- `components/dashboard/activity-balance.tsx` — swap `useMovimientos({ pageSize: 0 })` for the new hook.
- `contexts/movimientos-cache-context.tsx` — add eviction.

**Out of scope**:
- Any other component still doing full-dataset client-side aggregation
  beyond `ActivityBalanceDashboard` — if you find more during this work,
  note them in your summary as follow-up findings, don't fix them here.
- Changing `CACHE_TTL`'s value or the cache-key/filter-serialization logic
  — only add eviction on top of the existing design.

## Git workflow

- Branch: `advisor/009-activity-balance-rpc-cache-eviction`
- Conventional commits (e.g.
  `perf(dashboard): aggregate activity balance server-side via RPC`,
  `perf(cache): evict stale movimientos cache entries`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Read the existing aggregation RPC pattern and the balance component's bucketing logic

Read `scripts/037_aggregation_functions.sql` in full and
`components/dashboard/activity-balance.tsx`'s bucketing code (the part
after the `pageSize: 0` fetch) in full. Determine the exact buckets needed:
likely income/expense/balance per week, per month, and per year, filtered
by `delegacion_id`, date range, and optional `categoriaIds`. Write down
(in your own working notes, not committed) the precise output shape before
writing SQL — this determines the RPC's return columns.

### Step 2: Write the new RPC migration

`scripts/043_activity_balance_rpc.sql` — a `CREATE OR REPLACE FUNCTION`
following the exact style of `get_financial_summary` in
`scripts/037_aggregation_functions.sql` (same SECURITY DEFINER/INVOKER
choice, same parameter naming convention, same RLS-respecting approach).
Return a set of rows (bucket label/date, income sum, expense sum) rather
than a single aggregate, since the dashboard needs a time series.

**Verify**: read the script back for syntax; note that live execution
against Supabase requires the human operator (same caveat as other plans
in this batch touching SQL) — you cannot execute this yourself in this
environment.

### Step 3: Add the service method and hook

In `lib/services/database.ts`, add a method (e.g. `getActivityBalance`)
calling the new RPC, mirroring `get_financial_summary`'s call shape exactly
(same client accessor, same error handling).

Create `hooks/use-activity-balance.ts` mirroring
`hooks/use-financial-summary.ts`'s structure (loading/error states, TTL
caching if that hook has any — match it).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Wire the new hook into `ActivityBalanceDashboard`

Replace the `useMovimientos(..., { pageSize: 0 })` call and the client-side
bucketing logic with the new hook's pre-aggregated data. Keep the
component's rendering/chart code as unchanged as possible — only the data
source and the bucketing computation should change.

**Verify**: `npx tsc --noEmit` → exit 0; `pnpm lint` → exit 0.

### Step 5: Manual check

1. `pnpm dev`, log in, navigate to the dashboard's Balance/Activity tab.
2. Confirm the chart renders with correct-looking data (compare a known
   period's totals against the Transactions page's filtered totals for the
   same period, as a sanity cross-check).
3. Open Network tab, confirm the request is now a single RPC call (small
   payload), not a full movimientos fetch.

### Step 6: Add cache eviction

In `contexts/movimientos-cache-context.tsx`, in `fetchMovimientos` (or
wherever entries are written to `cacheRef`), add a sweep that removes
entries older than a bounded age before/after each write:

```ts
const MAX_CACHE_AGE = CACHE_TTL * 10 // e.g. 5 minutes if TTL is 30s

function evictStaleEntries(cache: Map<string, { timestamp: number; /* ... */ }>) {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > MAX_CACHE_AGE) {
      cache.delete(key)
    }
  }
}
```

Read the actual cached-entry shape in the file first (the field storing
the fetch timestamp may have a different name) and call this sweep at a
sensible point — e.g. at the start of every `fetchMovimientos` call, which
naturally runs periodically as the user interacts with filters, without
needing a separate `setInterval`.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 7: Manual cache check

1. `pnpm dev`, log in, go to `/transacciones`.
2. Apply several distinct filter combinations (different date ranges,
   search terms) to populate multiple cache entries.
3. Confirm the app still behaves correctly (no stale/wrong data shown) —
   the eviction logic must not remove entries that are still being
   actively read.

## Test plan

No test runner configured. Steps 5 and 7 are the verification; record
actual Network tab payload sizes/request counts observed before/after in
your summary as evidence of the improvement.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `grep -n "pageSize: 0" components/dashboard/activity-balance.tsx` returns no matches
- [ ] Balance dashboard renders correct-looking data via the new RPC (manually cross-checked)
- [ ] Network tab confirms a single small RPC response instead of a full movimientos fetch
- [ ] Cache eviction sweep added and does not break normal filter-switching behavior
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `scripts/037_aggregation_functions.sql` doesn't exist or `get_financial_summary`
  isn't defined the way expected — read whatever aggregation RPCs do exist
  and adapt the pattern; if none exist at all, this becomes a much larger
  task (writing the first aggregation RPC from scratch) — report and confirm
  scope before proceeding rather than assuming.
- The exact bucketing logic in `activity-balance.tsx` is more complex than
  simple week/month/year sums (e.g. running balance carried from account
  opening balances) — if the RPC can't cleanly reproduce it, STOP and
  report the discrepancy rather than shipping a subtly-wrong chart in a
  financial app.

## Maintenance notes

- If further dashboard widgets are found doing similar full-dataset
  client-side aggregation, they should follow this same RPC pattern.
- The cache eviction sweep's `MAX_CACHE_AGE` is a judgment call (10× TTL
  suggested) — if memory pressure is still reported after this fix, an
  LRU-based cap (max N entries) would be the next escalation, not
  implemented here.
