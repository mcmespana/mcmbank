# Plan 005: Make Enable Banking setup verifiable — unified SQL script, config health-check, doc fixes

> **Executor instructions**: Follow this plan step by step, run every
> verification command, and stop per STOP conditions rather than
> improvising. Update `plans/README.md`'s status row when done.
>
> **Drift check**: `git diff --stat 0bc851b..HEAD -- docs/ENABLE_BANKING.md scripts/038_enable_banking_schema.sql scripts/039_enable_banking_cron.sql lib/enable-banking app/api/bank-sync`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `0bc851b`, 2026-07-16

## Why this matters

The project owner set up the Enable Banking (PSD2 open-banking) integration
following `docs/ENABLE_BANKING.md` and **never got it working end-to-end**.
Reading the doc and code confirms three concrete, fixable causes:

1. Setup requires 4 manual, order-dependent steps split across two systems
   (Supabase SQL editor + Vercel env vars), including hand-copying the same
   secret (`CRON_SECRET`) into two places with no way to verify they match
   until the nightly cron either works or silently fails — the doc's own
   troubleshooting section (§6) admits this mismatch is the #1 failure mode.
2. There is no "check my config" tool anywhere — `lib/enable-banking/jwt.ts`
   already has a `privateKeyFingerprint()` export (line 54) that nobody
   calls (`grep -rn "privateKeyFingerprint" lib app` returns only the
   definition, no call sites) — a diagnostic surface exists in the code but
   isn't wired up.
3. `docs/ENABLE_BANKING.md` §5's numbered list (1,2,3,4,5,7,6) is
   internally inconsistent, signaling the doc was hand-edited without a
   final read-through — a small thing, but it erodes trust in the rest of
   the doc's accuracy right when someone is debugging under stress.

This plan fixes all three so a future agent or human — with or without a
real bank account — has a fast, mechanical way to confirm each piece of the
setup independently instead of only finding out something's wrong when the
full OAuth+SCA flow fails at the end.

## Current state

- `docs/ENABLE_BANKING.md` §3.3–3.6 — the 4-step manual setup (schema SQL,
  enable extensions, `ALTER DATABASE SET`, cron SQL).
- `docs/ENABLE_BANKING.md` §5 "Limitaciones conocidas" — numbered 1,2,3,4,5,7,6 (broken order).
- `docs/ENABLE_BANKING.md` §6 "El cron no se ejecuta" — already documents
  the secret-mismatch failure mode but offers no proactive check.
- `lib/enable-banking/jwt.ts:54-63` — `privateKeyFingerprint()`, unused:
  ```ts
  export function privateKeyFingerprint(): string {
    // returns a short hash of the configured private key for comparison
    // without exposing the key itself
  }
  ```
  (Read the actual implementation before reusing it — the exact return
  shape/format matters for Step 2.)
- `app/api/bank-sync/aspsps/route.ts` — already an authenticated route that
  exercises JWT signing indirectly (calling Enable Banking's `/aspsps`
  requires a valid signed JWT) — this is the closest thing to an existing
  health-check today, but it's not labeled or surfaced as one.
- `scripts/038_enable_banking_schema.sql` and `scripts/039_enable_banking_cron.sql`
  — the two SQL scripts run manually today.
- No `components/diagnostics/` directory currently exists in this repo
  (verified `find . -iname "*diagnostic*"` at plan-writing time — `CLAUDE.md`
  references a diagnostic center that has since been removed; do not assume
  it exists). This means there is no existing diagnostics page to hook a
  health-check card into — Step 3 below creates a minimal one.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Typecheck | `npx tsc --noEmit`   | exit 0               |
| Lint      | `pnpm lint`          | exit 0               |
| Dev server (manual) | `pnpm dev`  | starts on :3000      |

## Scope

**In scope**:
- `docs/ENABLE_BANKING.md` — fix §5 numbering; add a "Verificar
  configuración sin banco real" subsection.
- New file: `scripts/041_enable_banking_setup_verify.sql` — a single
  idempotent script combining schema + extensions + cron setup with a
  final verification `SELECT`.
- New route: `app/api/bank-sync/health/route.ts` — authenticated GET that
  reports JWT-signing success + key fingerprint + cron secret fingerprint,
  without ever returning the actual secret values.
- Minimal new page/section to surface the health check — either a small
  addition to `/configuracion` (if that page has a natural "system status"
  area — check `components/configuracion/config-page.tsx` first) or a new
  minimal `/configuracion/banking-health` sub-view. Prefer the smallest
  addition that makes the health check reachable from the UI, not a new
  full diagnostics page (that's a larger, separate feature).

**Out of scope**:
- Rebuilding the removed diagnostic center — not this plan.
- Any change to the actual sync logic (`lib/enable-banking/sync.ts`,
  `dedup.ts`) — covered by plan 007.
- The multi-account-picker gap — covered by plan 006.

## Git workflow

- Branch: `advisor/005-enable-banking-setup-verify`
- Conventional commits (e.g. `docs(banking): fix limitations numbering`,
  `feat(banking): add config health-check route`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Fix the doc numbering and add a "test without a real bank" note

In `docs/ENABLE_BANKING.md` §5, renumber the list 1–7 in the order the
items actually appear (currently reads 1,2,3,4,5,7,6 — just fix the two
misnumbered items in place, don't reorder content).

Also read `app/api/bank-sync/aspsps/route.ts` — it already returns a
`sandbox`/`beta` boolean per ASPSP from Enable Banking's own API, and
`components/cuentas/cuenta-connect-dialog.tsx` already surfaces these flags
in the bank-selection dropdown (confirm by reading that component — search
for `sandbox` or `beta`). Add a new subsection to `docs/ENABLE_BANKING.md`
section 3 (after §3.8) titled "3.8bis Probar sin una cuenta bancaria real"
explaining: Enable Banking's sandbox ASPSPs are already visible in the
existing bank dropdown (marked via the `sandbox`/`beta` flags returned by
`/api/bank-sync/aspsps`), and that these can be used to exercise the full
auth→callback→sync flow without a production bank account. **Do not
fabricate specific sandbox bank names or test credentials you have not
verified** — if you cannot find Enable Banking's sandbox documentation
via `docs/ENABLE_BANKING.md`'s existing "Referencias" links, write the
subsection to point the reader at Enable Banking's own sandbox docs
(already linked in §8) rather than inventing specifics.

**Verify**: read the edited file back; confirm §5 numbering is 1-7 in order and no content was lost.

### Step 2: Add the config health-check route

Create `app/api/bank-sync/health/route.ts`:

```ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateEnableBankingJWT, privateKeyFingerprint } from "@/lib/enable-banking/jwt"

export const runtime = "nodejs"

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const result: Record<string, unknown> = {
    appIdConfigured: !!process.env.ENABLE_BANKING_APP_ID,
    privateKeyConfigured: !!process.env.ENABLE_BANKING_PRIVATE_KEY,
    redirectUrlConfigured: !!process.env.ENABLE_BANKING_REDIRECT_URL,
    cronSecretConfigured: !!process.env.CRON_SECRET,
  }

  try {
    await generateEnableBankingJWT()
    result.jwtSigning = "ok"
    result.privateKeyFingerprint = privateKeyFingerprint()
  } catch (err) {
    result.jwtSigning = "failed"
    result.jwtError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(result)
}
```

Read `lib/enable-banking/jwt.ts` first to confirm the actual exported
function name for JWT generation (it may not be exactly
`generateEnableBankingJWT` — match whatever `app/api/bank-sync/auth/route.ts`
imports and calls) and `privateKeyFingerprint`'s real signature before
writing this. **Never include the raw private key, APP_ID, or CRON_SECRET
value in the response** — only booleans and the fingerprint helper's
already-safe output.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Surface the health check minimally in the UI

Read `components/configuracion/config-page.tsx`. If it has a natural place
for system/integration status (e.g. an existing "Estado del sistema"
section), add a small card there that fetches `/api/bank-sync/health` on
mount (only for `gestor_central` users — reuse whatever admin-check pattern
that page already uses) and renders the JSON as a simple key/value list
with ✅/❌ per boolean field. If no natural section exists, add a small
collapsible "Diagnóstico Enable Banking" block at the bottom of the page
rather than building a new route/page for this alone.

**Verify**: `npx tsc --noEmit` → exit 0; `pnpm lint` → exit 0.

### Step 4: Write the unified setup-verification SQL script

Create `scripts/041_enable_banking_setup_verify.sql`. Read
`scripts/038_enable_banking_schema.sql` and `scripts/039_enable_banking_cron.sql`
in full first — do not guess their contents. This new script should:

1. Contain `CREATE EXTENSION IF NOT EXISTS pg_cron;` and
   `CREATE EXTENSION IF NOT EXISTS pg_net;` (idempotent).
2. Reference (via a comment, not a re-run) that 038/039 must have already
   been applied — this script is a verification companion, not a
   replacement, since re-running schema-creation scripts against an
   already-migrated database could error on `CREATE TABLE` without
   `IF NOT EXISTS` guards (check whether 038 already uses those guards; if
   it does, it's safe to note this script can be run standalone).
3. End with a `SELECT` that reports: whether `app.mcmbank_url` and
   `app.mcmbank_cron_key` are set (existence only — for `mcmbank_cron_key`,
   report a fingerprint/prefix like `substring(current_setting('app.mcmbank_cron_key'), 1, 6) || '...'`,
   never the full value in a real script that might get pasted into a
   shared doc or support ticket), and whether the
   `mcmbank_bank_sync_daily` cron job exists (`SELECT * FROM cron.job WHERE jobname = 'mcmbank_bank_sync_daily'`).

Add a short section to `docs/ENABLE_BANKING.md` §3 pointing at this new
script as the "run this to confirm everything's wired correctly" step,
placed after §3.6.

**Verify**: read the script back for syntax sanity (you cannot execute SQL
against a live Supabase project from this environment — do not attempt to
connect to any database; this is a static-correctness check only). Note in
your summary that live execution against a real Supabase project is
required before trusting this script fully, and that's expected — flag it
as a manual follow-up for the human operator, not something you can verify
yourself in this environment.

## Test plan

No test runner applies to SQL scripts or docs. Verification is: typecheck
+ lint for the two new route/UI changes, and a careful read-through of the
SQL script and doc edits. The SQL script's actual correctness against a
live database is explicitly out of this plan's ability to verify — say so.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `docs/ENABLE_BANKING.md` §5 numbered 1-7 correctly
- [ ] New "probar sin banco real" subsection added, with no fabricated credentials/bank names
- [ ] `/api/bank-sync/health` route exists, requires auth, never returns raw secrets
- [ ] Health check reachable from some UI surface (documented in your summary where)
- [ ] `scripts/041_enable_banking_setup_verify.sql` created and referenced from the doc
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- You cannot find the actual JWT-generation function name/signature in
  `lib/enable-banking/jwt.ts` matching what Step 2 assumes — read the real
  file and adapt; don't guess an API that doesn't exist.
- You're tempted to invent specific sandbox bank names/credentials for
  Step 1's doc addition without a verifiable source — don't; link to
  Enable Banking's own docs instead.
- `config-page.tsx` has no admin-check pattern you can find to gate the new
  health-check UI to `gestor_central` users only — STOP and ask rather than
  shipping it ungated (it reveals whether env vars are configured, which is
  low-sensitivity but should still be admin-only per this repo's existing
  conventions).

## Maintenance notes

- If plan 001 (admin route protection) lands first, reuse its
  `lib/auth/require-admin.ts` helper in Step 2's route instead of the
  inline check shown above.
- This plan intentionally does NOT solve the underlying "two systems, one
  secret, no verification until failure" architecture — it makes the
  mismatch *detectable*, not impossible. A more thorough fix (e.g. Supabase
  reading `CRON_SECRET` directly via Vercel integration rather than a
  manually-copied `ALTER DATABASE SET`) is a larger infra change outside
  this plan's scope.
