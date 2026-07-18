# Plan 006: Manual account picker when Enable Banking returns multiple accounts with no IBAN match

> **Executor instructions**: Follow this plan step by step, run every
> verification command, and stop per STOP conditions rather than
> improvising. Update `plans/README.md`'s status row when done.
>
> **Drift check**: `git diff --stat 0bc851b..HEAD -- app/api/bank-sync/callback/route.ts components/cuentas`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `0bc851b`, 2026-07-16

## Why this matters

When a user authorizes a bank connection and the bank returns multiple
accounts, `app/api/bank-sync/callback/route.ts` tries to match one to the
`cuenta` row by IBAN. If none match (common when the `cuenta` in MCM Bank
was created without an IBAN, or the bank's IBAN formatting differs), the
code's own comment admits the intended fix was never built:

```ts
// Varios accounts y ninguno casa → dejamos la conexión autorizada pero
// la cuenta sin linkar. El frontend debería mostrar un selector manual
// posteriormente. De momento marcamos error parcial.
```

`docs/ENABLE_BANKING.md` §5 point 3 documents this as a known limitation
("Mejora futura: UI para elegir cuenta manualmente"). Today, the only
recovery is editing the IBAN and re-authorizing from scratch — burning a
second SCA/consent cycle with the bank and leaving the first
`banco_conexion` row as a dangling authorized-but-unlinked session. This is
a real reason someone trying to set this up "never got it working": a
mismatched IBAN format on the first attempt forces a full do-over rather
than a two-click fix.

## Current state

- `app/api/bank-sync/callback/route.ts:74-87` — the no-match branch
  (excerpt above), redirects with `bank_sync_error=<message>` and does
  **not** persist `session.accounts` anywhere — that data is lost once the
  redirect happens, since `match` is only used transiently in this request.
- `banco_conexion` table schema (`scripts/038_enable_banking_schema.sql`) —
  read this to find its exact columns; you'll likely need to add a nullable
  JSONB column (e.g. `accounts_pendientes`) to persist the candidate
  accounts list for the picker UI to read, since there is currently nowhere
  to store it.
- `components/cuentas/` — no account-picker component exists yet
  (`ls components/cuentas` at plan-writing time: `cuenta-connect-dialog.tsx`,
  `cuenta-edit-form.tsx`, `cuenta-sync-dialog.tsx`, `cuentas-manager.tsx`,
  `delete-account-dialog.tsx` — none of these is a picker).
- `cuentas-manager.tsx` — reads `bank_sync_error`/`bank_sync_ok` query
  params after the OAuth redirect completes (confirm exact param-reading
  logic by searching for `bank_sync_error` in this file) — this is where a
  new "choose which account" dialog would be triggered when the error
  indicates the multi-account case specifically (vs. other error types).

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Typecheck | `npx tsc --noEmit`   | exit 0               |
| Lint      | `pnpm lint`          | exit 0               |
| Dev server (manual) | `pnpm dev`  | starts on :3000      |

## Scope

**In scope**:
- New migration: `scripts/042_banco_conexion_accounts_pendientes.sql` —
  adds a nullable JSONB column to `banco_conexion` to hold the candidate
  accounts list when no auto-match occurs.
- `app/api/bank-sync/callback/route.ts` — persist `session.accounts` to
  the new column in the no-match branch, and change the redirect param to
  something structured the frontend can key off (e.g.
  `bank_sync_error=multiple_accounts&banco_conexion_id=<id>` instead of a
  free-text message, while keeping a human-readable fallback message too).
- New component: `components/cuentas/cuenta-account-picker-dialog.tsx`.
- New route: `app/api/bank-sync/link-account/route.ts` — `POST` that takes
  `banco_conexion_id`, `cuenta_id`, and the chosen account's `uid`, and
  performs the same `cuenta` update the auto-match path does today
  (mirror `app/api/bank-sync/callback/route.ts:88-98`).
- `components/cuentas/cuentas-manager.tsx` — wire up opening the new picker
  dialog when the multi-account error param is present.

**Out of scope**:
- Any change to the auto-match (IBAN) logic itself — that path is correct
  and unaffected by this plan; only the failure branch changes.
- Cleaning up already-dangling `banco_conexion` rows created by past
  failed attempts before this plan — that's a one-off manual data-cleanup
  task for the operator, not something to script here.

## Git workflow

- Branch: `advisor/006-bank-sync-account-picker`
- Conventional commits (e.g. `feat(banking): let user pick account manually when IBAN match fails`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Add the migration

`scripts/042_banco_conexion_accounts_pendientes.sql`:

```sql
alter table public.banco_conexion
  add column if not exists accounts_pendientes jsonb;

comment on column public.banco_conexion.accounts_pendientes is
  'Lista de accounts devueltos por Enable Banking cuando ninguno hizo match automático por IBAN. Se limpia tras el linkado manual.';
```

Read `scripts/038_enable_banking_schema.sql` first to confirm the exact
table/column naming conventions used elsewhere (snake_case confirmed by
existing columns like `consent_valid_until`) and match them.

**Verify**: read the script back for syntax; note in your summary that live
execution against Supabase requires the human operator (same caveat as
plan 005 Step 4).

### Step 2: Persist candidate accounts on no-match

In `app/api/bank-sync/callback/route.ts`, in the no-match branch, before
the redirect, add:

```ts
await admin
  .from("banco_conexion")
  .update({ accounts_pendientes: session.accounts })
  .eq("id", conexionId)

return NextResponse.redirect(
  `${redirectBase}?bank_sync_error=multiple_accounts&banco_conexion_id=${conexionId}&cuenta_id=${cuentaId}`,
)
```

Keep enough of the original human-readable message available too — either
as an additional query param (`&bank_sync_message=...`) or by having the
frontend derive the message from the account count once it fetches the
pending accounts list. Read the full surrounding function first to use the
correct variable names (`conexionId`, `cuentaId`, `redirectBase` — confirm
these match what's already in scope at that point in the function).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Build the account picker dialog

`components/cuentas/cuenta-account-picker-dialog.tsx` — a `Dialog` (match
the styling/structure of `components/cuentas/delete-account-dialog.tsx` as
the closest existing exemplar) that:

1. On open, is given `banco_conexion_id` and `cuenta_id` as props.
2. Fetches the pending accounts — either via a new small `GET` on the
   `link-account` route (`?banco_conexion_id=...`) or by having
   `cuentas-manager.tsx` pass the list down directly if it already fetched
   the `banco_conexion` row for other reasons (check first before adding a
   redundant fetch).
3. Renders each candidate account (IBAN, name/description fields from the
   Enable Banking account object — read `lib/enable-banking/types.ts` for
   the `Account` shape) as a selectable row.
4. On confirm, `POST`s to `/api/bank-sync/link-account` with the chosen
   account's `uid`, then closes and triggers a refresh of the accounts list
   in `cuentas-manager.tsx`.

**Verify**: `npx tsc --noEmit` → exit 0; `pnpm lint` → exit 0.

### Step 4: Build the link-account route

`app/api/bank-sync/link-account/route.ts`, `POST` handler:

1. Auth check (`createClient().auth.getUser()` — 401 if absent).
2. Verify the requesting user has a `membresia` role in the `cuenta`'s
   delegación (mirror the membership-check pattern from plan 001/003 if
   already implemented, or write it inline here following
   `hooks/use-delegation-role.ts`'s logic).
3. Look up `banco_conexion.accounts_pendientes`, find the matching account
   by `uid` from the request body, and confirm it's actually present in
   the pending list (don't trust an arbitrary client-supplied `uid` blindly
   — this prevents linking a `cuenta` to an account the user was never
   actually authorized to connect).
4. Perform the same `cuenta` update as the auto-match path in
   `callback/route.ts` (mirror lines 88-98 exactly for consistency —
   `banco_conexion_id`, `external_account_uid`, `external_account_hash`,
   `sync_enabled: true`, `origen: "conectada"`, `iban`).
5. Clear `banco_conexion.accounts_pendientes` back to `null` after a
   successful link.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 5: Wire up the trigger in `cuentas-manager.tsx`

Find where this component currently reads `bank_sync_error` from the URL
(search the file). Add a branch: if the error value is
`multiple_accounts`, open the new picker dialog with the `banco_conexion_id`
and `cuenta_id` from the other query params, instead of just showing the
generic error toast/banner used for other error types.

**Verify**: `npx tsc --noEmit` → exit 0; `pnpm lint` → exit 0.

### Step 6: Manual check (requires a real or sandbox Enable Banking flow)

This step cannot be fully exercised without an actual multi-account bank
connection (real or sandbox). Do what you can:

1. Confirm the code compiles and the dialog renders correctly against
   mocked/hardcoded sample data (temporarily stub the fetch response while
   testing the UI, then remove the stub).
2. If a sandbox ASPSP with multiple accounts is available (see plan 005's
   sandbox-testing doc addition, if it has landed), run the real flow.
3. If neither is possible, note this explicitly as an unverified path in
   your summary — do not claim end-to-end verification you couldn't
   perform.

## Test plan

No test runner configured. Step 6 covers what manual verification is
possible; the gap where real multi-account testing isn't available must be
stated plainly.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] Migration script created and reviewed for syntax (live execution flagged as a manual follow-up)
- [ ] Picker dialog renders correctly against sample/mocked data
- [ ] `link-account` route validates the chosen `uid` against the persisted pending list (not a blind trust of client input)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- You cannot confirm the exact `banco_conexion` and `cuenta` column names
  used in the update at callback time — read the live file, don't guess.
- The `link-account` route's ownership/membership check pattern can't be
  established with confidence — STOP and ask rather than shipping an
  endpoint that lets any authenticated user link any account.
- No way exists to test the dialog against realistic data at all (not even
  mocked) — report this rather than shipping unverified UI code.

## Maintenance notes

- If plan 005's health-check/sandbox-testing doc lands first, this plan's
  Step 6 should reference it directly for how to trigger a sandbox
  multi-account scenario.
- Once this ships, update `docs/ENABLE_BANKING.md` §5 to remove point 3
  (the "no manual picker" limitation) since it will no longer be true.
