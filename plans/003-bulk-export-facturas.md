# Plan 003: Bulk export of invoice files (facturas) by delegation and date range

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0bc851b..HEAD -- lib/services/file-service.ts hooks/use-movimiento-archivos.ts app/api`
> Compare against Current state before proceeding; on mismatch, treat as a
> STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/002-fix-broken-invoice-file-access.md (this plan needs working authenticated Storage reads — do not start until 002 is DONE)
- **Category**: direction (feature)
- **Planned at**: commit `0bc851b`, 2026-07-16

## Why this matters

MCM Bank tracks income/expenses for a nonprofit's local delegations and
lets users attach invoice files to individual transactions
(`movimiento_archivo` table, `components/transactions/file-list.tsx`).
There is currently **no way to retrieve more than one invoice at a time** —
confirmed by `grep -rniE "zip|bulk.?download|export.*factur"` across all
`.ts`/`.tsx` files returning zero matches for any batch-download code path.
For a delegation's treasurer preparing an accounting/tax submission for a
quarter, the only option today is opening each transaction one at a time
and downloading files individually — impractical once a delegation has more
than a handful of transactions with attachments. This is the concrete gap
the project owner identified: the facturas feature was bolted onto
individual `movimiento` records without ever getting a bulk-retrieval path.

## Current state

- `movimiento_archivo` table (`lib/types/database.ts:362-395`) — has
  `movimiento_id`, `bucket`, `path_storage`, `nombre_original`, `es_factura`,
  `subido_en`. To find all facturas for a delegation/date range you must
  join through `movimiento` (which has `delegacion_id`/`cuenta_id` and
  `fecha`) — there is currently no query anywhere in `lib/services/` that
  does this join; `hooks/use-movimiento-archivos.ts` only ever queries by a
  single `movimiento_id`.
- `lib/services/database.ts` and `lib/services/server-database.ts` — the
  client/server data-access layer; follow their existing method style (see
  e.g. `getCategoriasByDelegacion` in `database.ts` for the query
  conventions: delegation filtering, error handling shape).
- `lib/supabase/admin.ts` — exports `createAdminClient()`, used elsewhere
  for privileged Storage/DB operations server-side (e.g.
  `app/api/admin/users/route.ts`). This export endpoint should use the
  authenticated server client (`lib/supabase/server.ts`), NOT the admin
  client, and must verify the requesting user has a `membresia` role in the
  target `delegacion_id` before returning anything — follow the pattern
  established in plan 001's `lib/auth/require-admin.ts` if it exists by the
  time you run this plan, adapted to "member of this delegación" rather
  than "gestor_central admin" (read `hooks/use-delegation-role.ts` for the
  membership-check shape to mirror server-side).
- No zip library is currently a dependency — check `package.json` for
  `archiver`, `jszip`, or similar before assuming one needs to be added.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Install   | `pnpm install`       | exit 0               |
| Typecheck | `npx tsc --noEmit`   | exit 0               |
| Lint      | `pnpm lint`          | exit 0               |
| Dev server (manual check) | `pnpm dev` | starts on :3000 |

## Scope

**In scope**:
- New dependency: a zip-streaming library (`archiver` is the standard
  Node.js choice; confirm it's not already present, then
  `pnpm add archiver` and `pnpm add -D @types/archiver` if using TypeScript
  strict mode — this repo has `ignoreBuildErrors: true` currently but still
  benefits from types).
- New API route: `app/api/facturas/export/route.ts`
- New service method(s) in `lib/services/database.ts` (or a new
  `lib/services/export-service.ts` if the query is substantial enough to
  warrant its own file — your call, but match the repo's existing file
  granularity, which favors one service class per domain area).
- New UI trigger: a button near the transaction filters
  (`components/transactions/` — find the existing filters component, likely
  `transaction-filters.tsx` or similar via `ls components/transactions/`)
  or a small new panel component if a natural placement doesn't exist.

**Out of scope**:
- Any change to the individual-file view/download flow from plan 002 — this
  plan builds on top of it, doesn't modify it.
- Export formats other than zip of original files (e.g. a combined PDF, or
  an Excel manifest) — note as a possible future enhancement in your
  summary but do not build it.
- Scheduling/background jobs for very large exports — this plan assumes a
  synchronous request/response within Vercel's function timeout is
  sufficient for a single delegation's typical volume; if you discover
  during testing that a full year of facturas for a busy delegation
  exceeds a few hundred MB or takes longer than ~30s to stream, STOP and
  report rather than trying to build a queued/background version.

## Git workflow

- Branch: `advisor/003-bulk-export-facturas`
- One commit per step, conventional commit style (e.g.
  `feat(facturas): add bulk zip export by delegation and date range`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Add the query to fetch matching `movimiento_archivo` rows

Add a method (e.g. `getFacturasForExport(delegacionId, dateFrom, dateTo)`)
that joins `movimiento_archivo` to `movimiento` filtered by
`delegacion_id`, `fecha BETWEEN dateFrom AND dateTo`, and `es_factura = true`
(confirm this is the right flag vs. including `documentos` bucket files too
— read how `es_factura` is set in `hooks/use-movimiento-archivos.ts` to
confirm it maps 1:1 with the `facturas` bucket). Return at minimum:
`path_storage`, `bucket`, `nombre_original`, `movimiento_id`, and the
parent movimiento's `fecha`/`concepto` (useful for naming files inside the
zip, e.g. `2026-03-15_pago-luz_factura.pdf`).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Build the export API route

`app/api/facturas/export/route.ts`, `GET` handler, query params
`delegacion_id`, `date_from`, `date_to`:

1. Authenticate the requesting user (`createClient().auth.getUser()`).
2. Verify delegation membership for `delegacion_id` (see Current state —
   mirror `use-delegation-role.ts`'s check server-side; if no
   `membresia` row exists for this user+delegación, return 403).
3. Call the Step 1 query.
4. If zero rows, return a `404` or an empty-zip response with a clear
   message — decide based on what's least surprising for a UI that will
   trigger a file download; a `200` with a JSON `{ error: "..." }` body
   before any streaming starts is easiest for the frontend to handle, so
   prefer that over an empty zip.
5. Stream a zip: for each row, use the server Supabase client to download
   the object (`supabase.storage.from(bucket).download(path)`), append it
   to the archive under a collision-safe name (prefix with
   `movimiento_id.slice(0,8)` if two files share the same generated name),
   and pipe the archive to the response.

Use Next.js route handler streaming conventions — return a `Response` with
a `ReadableStream` body (or use `archiver`'s Node stream adapted via
`Readable.toWeb` if targeting the Node runtime; confirm this route needs
`export const runtime = "nodejs"` since `archiver` requires Node APIs not
available in the Edge runtime — Next.js 16 defaults may vary, check an
existing route like `app/api/bank-sync/run/route.ts` for the runtime
declaration convention this repo uses, if any).

Set response headers: `Content-Type: application/zip`,
`Content-Disposition: attachment; filename="facturas-<delegacion>-<date_from>-<date_to>.zip"`.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Add the UI trigger

Find the transactions filter/toolbar component (`ls components/transactions/`
to locate it) and add an "Exportar facturas" button that, given the
currently-selected delegación and date range filters (reuse whatever
filter state the page already has — read how date range filters are
currently read/passed in that component), triggers a navigation to
`/api/facturas/export?delegacion_id=...&date_from=...&date_to=...`
(a simple `<a href>` or `window.location` assignment is sufficient for a
file-download trigger — no need for a fetch+blob dance unless the existing
codebase has a reason to prefer that, e.g. check `lib/utils/export-to-excel.ts`
for the existing Excel-export UX pattern and mirror it if one exists).

**Verify**: `npx tsc --noEmit` → exit 0; `pnpm lint` → exit 0.

### Step 4: Manual end-to-end check

1. `pnpm dev`, log in to an account with at least 2-3 transactions that
   have facturas attached (from Step 4 testing of plan 002, or upload a
   couple of test files first).
2. Trigger the export for a date range covering those transactions.
3. Confirm a `.zip` downloads and contains the expected files, correctly
   named, and opens without corruption.
4. Test the zero-results case (a date range with no facturas) and confirm
   it fails gracefully with a clear message, not a broken/corrupt zip
   download.
5. Test as a user who is NOT a member of the target delegación (if you have
   a second test account) — confirm `403`, not data leakage.

## Test plan

No test runner configured. Step 4 is the verification. Record actual zip
file names/contents observed in your summary.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] Manual export in Step 4 produces a valid, correctly-named zip with the right files
- [ ] Zero-results case handled gracefully (no corrupt download)
- [ ] Non-member access returns 403 (if testable with a second account; otherwise note as unverified)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Plan 002 is not yet DONE — this plan reads Storage objects and needs a
  working, RLS-respecting access path; building on top of the currently
  broken `getPublicUrl` pattern would just add a second broken feature.
- Export size/time in manual testing suggests this needs to be a background
  job rather than a synchronous request — report the observed size/duration
  rather than attempting a queue-based redesign.
- No delegation-membership check pattern can be found/confirmed server-side
  — do not ship an export endpoint that trusts a client-supplied
  `delegacion_id` without verifying membership; STOP and report instead.

## Maintenance notes

- If the app later gets a proper background job runner (mentioned as
  unavailable in `docs/ENABLE_BANKING.md`'s own limitations around Vercel
  timeouts), revisit this as a queued export with an email/notification
  when ready, for delegations with very large histories.
- This is a natural pairing with plan 004 (flagging bank-synced transactions
  missing a factura) — a treasurer would likely want to run the "sin
  factura" triage first, attach the missing receipts, then run this export.
