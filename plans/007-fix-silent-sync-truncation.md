# Plan 007: Stop silent transaction-history truncation in Enable Banking pagination

> **Executor instructions**: Follow this plan step by step, run every
> verification command, and stop per STOP conditions rather than
> improvising. Update `plans/README.md`'s status row when done.
>
> **Drift check**: `git diff --stat 0bc851b..HEAD -- lib/enable-banking/client.ts lib/enable-banking/sync.ts lib/types/database.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `0bc851b`, 2026-07-16

## Why this matters

`lib/enable-banking/client.ts:127-143` (`getAllTransactions`) paginates
through a bank's transaction feed via `continuation_key`, but caps at
`maxPages` (default 50) and **silently stops** if the bank still has more
pages after that — no error, no warning, no flag returned. `sync.ts` only
logs per-page progress and never checks whether the loop exited due to
exhausting `maxPages` versus genuinely reaching the end
(`page.continuation_key` becoming falsy). Since `last_sync_at` still
advances after a truncated sync, and incremental syncs only re-fetch the
last 10 days (per `docs/ENABLE_BANKING.md` §2), **transactions beyond page
50 can be permanently lost** with no record anywhere that it happened —
money movements missing from the books with zero indication why. This is a
correctness issue in a financial application and should be fixed before
this integration is trusted with real bank connections.

## Current state

- `lib/enable-banking/client.ts:122-143`:
  ```ts
  async getAllTransactions(
    accountUid: string,
    params: { date_from?: string; date_to?: string; transaction_status?: "BOOK" | "PDNG" | "INFO" } = {},
    opts: { maxPages?: number; onPage?: (page: EBTransactionsResponse, index: number) => void } = {},
  ): Promise<EBTransactionsResponse[]> {
    const maxPages = opts.maxPages ?? 50
    const pages: EBTransactionsResponse[] = []
    let continuation_key: string | undefined
    for (let i = 0; i < maxPages; i++) {
      const page = await this.getTransactions(accountUid, { ...params, continuation_key })
      pages.push(page)
      opts.onPage?.(page, i)
      if (!page.continuation_key) break
      continuation_key = page.continuation_key
    }
    return pages
  }
  ```
- `lib/enable-banking/sync.ts` — the caller of `getAllTransactions`, around
  lines 199-242 per the audit that found this (read the actual current
  lines before editing — this file may have shifted). It calls
  `onPage` for logging but does not inspect the return value for
  truncation.
- `banco_sync_log` table (`scripts/038_enable_banking_schema.sql`) — has
  columns for counts and a JSONB verbose log (per `docs/ENABLE_BANKING.md`
  §2 "Tablas nuevas"); confirm the exact column list by reading the
  migration file, since you'll add a new boolean/status value here.
- `cuenta.last_sync_status` / `last_sync_error` — read
  `docs/ENABLE_BANKING.md` §2 "Campos añadidos" and the actual
  `scripts/038_*.sql` for the exact enum/string values already in use for
  `last_sync_status` (e.g. `'ok'`, `'error'`) — you'll add a `'parcial'` (or
  similarly-named) state consistent with existing naming.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Typecheck | `npx tsc --noEmit`   | exit 0               |
| Lint      | `pnpm lint`          | exit 0               |

No live bank connection is available in this environment to run a real
sync — verification here is code-level (typecheck, lint, and a careful
manual trace of the new logic), plus a note for the human operator to
confirm on the next real sync run (see Test plan).

## Scope

**In scope**:
- `lib/enable-banking/client.ts` — `getAllTransactions` return shape.
- `lib/enable-banking/sync.ts` — the caller, to check the new truncation
  flag and act on it.
- `lib/enable-banking/types.ts` — if `SyncCuentaResult` (or equivalent) is
  defined there, add the new field to its type.
- `docs/ENABLE_BANKING.md` — document the new `parcial`/truncated state
  briefly in §2 and §4 (operational monitoring section).

**Out of scope**:
- Raising `maxPages` or redesigning pagination to loop until fully
  exhausted with a time budget — that's a valid alternative fix but a
  larger behavior change with its own risk (could make a sync run much
  longer); this plan's job is to make truncation *visible and non-silent*,
  not to eliminate the cap. Note the alternative in Maintenance notes for
  a human to decide later.
- Any change to the dedup/mapping logic in `dedup.ts` — unaffected by this
  plan.

## Git workflow

- Branch: `advisor/007-fix-sync-truncation`
- Conventional commits (e.g. `fix(banking): surface truncated transaction pagination instead of silently dropping it`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Change `getAllTransactions` to report truncation

Modify the return type from `Promise<EBTransactionsResponse[]>` to
`Promise<{ pages: EBTransactionsResponse[]; truncated: boolean }>`:

```ts
async getAllTransactions(
  accountUid: string,
  params: { date_from?: string; date_to?: string; transaction_status?: "BOOK" | "PDNG" | "INFO" } = {},
  opts: { maxPages?: number; onPage?: (page: EBTransactionsResponse, index: number) => void } = {},
): Promise<{ pages: EBTransactionsResponse[]; truncated: boolean }> {
  const maxPages = opts.maxPages ?? 50
  const pages: EBTransactionsResponse[] = []
  let continuation_key: string | undefined
  let truncated = false
  for (let i = 0; i < maxPages; i++) {
    const page = await this.getTransactions(accountUid, { ...params, continuation_key })
    pages.push(page)
    opts.onPage?.(page, i)
    if (!page.continuation_key) {
      continuation_key = undefined
      break
    }
    continuation_key = page.continuation_key
    if (i === maxPages - 1) truncated = true
  }
  return { pages, truncated }
}
```

Find every other call site of `getAllTransactions` (`grep -rn
"getAllTransactions" lib/ app/`) before making this change — there may be
more than one caller, and all must be updated to destructure the new
return shape in the same commit so the build doesn't break between steps.

**Verify**: `npx tsc --noEmit` → exit 0 (this will fail until Step 2 updates the caller — that's expected; both steps land in one commit if the file is small enough, or verify after both).

### Step 2: Handle truncation in `sync.ts`

At the call site in `lib/enable-banking/sync.ts`, after destructuring
`{ pages, truncated }`:

- If `truncated` is `true`:
  - Log a clear warning via whatever the file's existing verbose-log
    mechanism is (read the surrounding code for the logging pattern used
    elsewhere in this function — likely a `steps.push(...)` or similar
    array that becomes the `banco_sync_log` verbose JSONB).
  - Set the sync result's status to a new `'parcial'` state (matching
    whatever string convention `last_sync_status`/`banco_sync_log.estado`
    already use — check the exact values, e.g. lowercase Spanish strings
    like `'ok'`/`'error'`) instead of `'ok'`.
  - Do NOT advance `cuenta.last_sync_at` past the point covered by the
    successfully-fetched pages if doing so would cause the next
    incremental sync to skip the untruncated remainder — read how
    `last_sync_at` is currently set to confirm whether this requires any
    change, or whether the existing 10-day-overlap incremental design
    already provides enough safety margin for a *later* successful full
    sync to eventually catch up. If you determine the incremental design
    does NOT naturally recover truncated history (i.e. a truncated initial
    sync's gap is never revisited), note this explicitly in your summary
    as a follow-up risk — do not attempt to design a full backfill-retry
    mechanism as part of this plan (out of scope, larger effort).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Persist the truncation flag for operational visibility

Add a `truncated` (or `parcial`) indicator to whatever `SyncCuentaResult`
type/object is written into `banco_sync_log` and used to set
`cuenta.last_sync_status`. Confirm the exact insert/update call in
`sync.ts` and add the field there, matching existing column types (a
boolean column if `banco_sync_log` supports adding one via a small
migration, or reuse the existing `estado` string column with a new value —
prefer reusing `estado` if it's already a free-text/enum column, to avoid
a schema migration for this fix).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Update the operational docs

In `docs/ENABLE_BANKING.md` §4 ("Gestión operativa diaria"), add a note
under "Monitorear una cuenta concreta" explaining what `last_sync_status =
'parcial'` (or whatever value you chose) means and what action to take
(re-run manual sync with an adjusted date range, or investigate raising
`maxPages`).

## Test plan

No test runner is configured and no live bank connection is available in
this environment. Verification is: typecheck passes, the logic trace in
Steps 1-3 is internally consistent (read it back once complete and confirm
`truncated` propagates end-to-end from `client.ts` to the persisted sync
log), and the doc update is accurate. Flag in your summary that a real
sync run against an account with >50 pages of history (or a temporarily
lowered `maxPages` for testing, e.g. pass `{ maxPages: 1 }` in a manual
test call against a real sandbox account if one is available per plan 005)
is needed to fully confirm this in a live environment — that's a follow-up
for the human operator, not something achievable in this session.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `getAllTransactions` returns `{ pages, truncated }`, all call sites updated
- [ ] `sync.ts` logs a warning and sets a non-`'ok'` status when `truncated` is true
- [ ] `docs/ENABLE_BANKING.md` §4 documents the new status value
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- More than one call site of `getAllTransactions` exists and updating all
  of them changes behavior in a way you're not confident about (e.g. a
  caller that doesn't have an equivalent `banco_sync_log` write to attach
  the flag to) — STOP and report rather than partially wiring the fix.
- The `last_sync_at` interaction in Step 2 turns out to be more complex
  than described (e.g. it's computed in a third file not mentioned here) —
  trace it fully before changing anything; if genuinely unclear, report the
  ambiguity rather than guessing.

## Maintenance notes

- Consider (as a separate future plan, not this one) redesigning pagination
  to loop until genuinely exhausted with a wall-clock time budget instead
  of a fixed page cap, if `maxPages: 50` proves insufficient for real
  delegation accounts in practice.
- If plan 005's health-check UI lands, consider surfacing "last sync was
  partial" as a visible banner in `/cuentas`, not just a log field — that's
  a natural follow-up but is out of scope here.
