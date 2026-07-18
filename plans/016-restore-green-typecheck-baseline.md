# Plan 016: Restore a green `tsc --noEmit` baseline and add a `typecheck` script

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0bc851b..HEAD -- app/api/bank-sync/ app/api/admin/users/ lib/types/database.ts lib/enable-banking/ package.json`
> On drift, compare "Current state" excerpts before proceeding; mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: S/M (bounded: the full current error list is enumerated below)
- **Risk**: LOW — type-level changes only; no runtime behavior change intended
- **Depends on**: none (do before or alongside 015; plan 011's Step 1 and plan 019's CI gate depend on this)
- **Category**: bug / dx
- **Planned at**: commit `0bc851b`, 2026-07-17

## Why this matters

`npx tsc --noEmit` currently **fails**, and nobody notices because
`next.config.mjs` sets `typescript.ignoreBuildErrors: true` and
`package.json` has no `typecheck` script. The failures are not noise: the
entire `app/api/bank-sync/*` route family — the code that writes synced
bank transactions — types its Supabase rows as `never`, meaning the
compiler has been fully overruled on the app's newest money-writing
surface. Until this is green, no other plan can use typecheck as a
verification gate.

## Current state

Verified by running `npx tsc --noEmit` at commit `0bc851b` (2026-07-17).
Two error families:

1. **Next.js 16 async route params** — `.next/dev/types/validator.ts`
   rejects `app/api/admin/users/[id]/route.ts`: its `PUT` (and check
   `DELETE`/other verbs in the same file) is declared as
   `(req: Request, { params }: { params: { id: string } })` but Next 16
   requires `context: { params: Promise<{ id: string }> }` (await it in
   the body).
2. **`never`-typed Supabase rows across `app/api/bank-sync/{auth,callback,disconnect,run?}/route.ts`**
   — e.g. `auth/route.ts:51` `Property 'delegacion_id' does not exist on
   type 'never'`, `:64` insert into `"banco_conexion"` rejects the payload;
   `callback/route.ts:49,72-116` same pattern. Diagnose before fixing:
   `lib/types/database.ts` DOES define `banco_conexion` (line 409) and
   `banco_sync_log` (line 462), so the table types exist. Likely causes,
   in order of probability: (a) columns referenced by the routes (e.g.
   `session_id`, `external_account_uid`, `sync_enabled`, `origen` on
   `cuenta`; fields on `banco_conexion`) are missing/misnamed in
   `lib/types/database.ts` relative to `scripts/038_enable_banking_schema.sql`,
   which makes supabase-js collapse the row type to `never`; (b) the
   client construction in those routes (see `lib/supabase/admin.ts`) loses
   the `Database` generic. Read the actual error chain top-down — the
   FIRST missing column named by tsc is usually the root cause.
3. `.next/dev/types/` and `.next/types/` duplicates of family 1 — they
   disappear when the source file is fixed; never edit `.next/`.

Schema source of truth for the missing columns:
`scripts/038_enable_banking_schema.sql` (tables `banco_conexion`,
`banco_sync_log`, plus `ALTER TABLE cuenta ADD COLUMN` statements). Confirm
against the live DB if reachable (Supabase MCP `list_tables`, project
`bnmgfkyfwcdvyhuqbaah`) — the live DB, not the SQL file, wins on conflict.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Typecheck | `npx tsc --noEmit`   | exit 0 at the end of this plan |
| Lint      | `pnpm lint`          | exit 0 |
| Build     | `pnpm build`         | exit 0 |

## Scope

**In scope**:
- `lib/types/database.ts` — add/correct column definitions for
  `banco_conexion`, `banco_sync_log`, and the `cuenta` columns added in
  migration 038 (`banco_conexion_id`, `external_account_uid`,
  `external_account_hash`, `sync_enabled`, `origen`, `iban`, …).
- `app/api/bank-sync/auth/route.ts`, `callback/route.ts`,
  `disconnect/route.ts`, `run/route.ts` (if it errors) — only type-level
  adjustments (awaited params, removing now-unneeded `as any`).
- `app/api/admin/users/[id]/route.ts` — async params signature.
- `package.json` — add `"typecheck": "tsc --noEmit"`.

**Out of scope**:
- Removing `ignoreBuildErrors: true` from `next.config.mjs` — that is plan
  011 Step 1; this plan makes it possible.
- Any runtime/behavioral change to the bank-sync flow. If a type error can
  only be fixed by changing runtime logic, STOP and report.
- The widespread `(supabase as any)` casts in hooks/components — a
  separate cleanup; only touch casts inside the in-scope route files.

## Git workflow

- Branch: `advisor/016-green-typecheck`
- Conventional commits, e.g. `fix(types): add Enable Banking columns to Database types; adopt Next 16 async route params`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Fix the admin route's async params

In `app/api/admin/users/[id]/route.ts`, change every handler to
`async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> })`
and `const { id } = await context.params` at the top. Mirror the existing
error-response style in the file.

**Verify**: `npx tsc --noEmit 2>&1 | grep "admin/users"` → no matches.

### Step 2: Diagnose and fix the `never` family

Run `npx tsc --noEmit 2>&1 | grep "bank-sync" | head -5`, open the first
error, and compare the referenced table's type in `lib/types/database.ts`
column-by-column against `scripts/038_enable_banking_schema.sql` (and the
live DB if reachable). Add every missing column to Row/Insert/Update.
Repeat until the bank-sync family is clean. Remove any `as any`/`as never`
that the fixed types make unnecessary — but do not add new casts to
silence residual errors.

**Verify**: `npx tsc --noEmit 2>&1 | grep -c "bank-sync"` → `0`.

### Step 3: Zero the remaining list, add the script

Fix any remaining errors the full run still shows (there should be none
beyond families 1-2 at plan time; a small number of new ones may have
accrued — bounded STOP condition below). Add
`"typecheck": "tsc --noEmit"` to `package.json` scripts.

**Verify**: `pnpm typecheck` → exit 0. `pnpm build` → exit 0. `pnpm lint` → exit 0.

## Test plan

Type-only change; the gate is `pnpm typecheck` exiting 0 plus a manual
smoke: `pnpm dev`, log in, open `/cuentas` and confirm no new runtime
errors in the console (the bank-sync routes are exercised only with EB
credentials — do not attempt a live sync for this plan).

## Done criteria

- [ ] `pnpm typecheck` exists and exits 0
- [ ] `pnpm build` exits 0
- [ ] No runtime-logic diffs: `git diff` on route files shows only signatures, awaited params, and removed casts
- [ ] `plans/README.md` status row updated

## STOP conditions

- After fixing families 1-2 the full error list still exceeds ~10 errors
  in files this plan doesn't scope — report the list; the maintainer may
  want a dedicated cleanup plan instead of scope creep here.
- A bank-sync error can only be silenced by changing what the code does at
  runtime (e.g. the code writes a column that truly doesn't exist in the
  live DB) — that's a real bug, not a type bug: STOP and report it
  explicitly (table, column, call site).
- `lib/types/database.ts` disagrees with the live DB in a way that implies
  applied-but-uncommitted migrations beyond 038 — report the drift list.

## Maintenance notes

- Plan 011 Step 1 (remove `ignoreBuildErrors`) becomes trivially safe once
  this is green — recommend doing it immediately after.
- Plan 019 adds `pnpm typecheck` to CI so this baseline can't rot again.
- Whenever a migration lands in `scripts/`, `lib/types/database.ts` must be
  updated in the same PR — that's the CLAUDE.md convention this plan
  re-establishes.
