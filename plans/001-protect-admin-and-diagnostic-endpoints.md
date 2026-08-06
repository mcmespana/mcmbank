# Plan 001: Protect admin API routes, diagnostic endpoint, and expand middleware route protection

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0bc851b..HEAD -- app/api/admin app/api/supabase-sanity lib/supabase/middleware.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `0bc851b`, 2026-07-16

## Why this matters

`app/api/admin/users/route.ts` and `app/api/admin/users/[id]/route.ts` use
`createAdminClient()` — a Supabase client authenticated with the
`service_role_key`, which bypasses Row Level Security entirely — and perform
**zero identity or role checks** before listing all users, creating users
with any role, changing passwords, or deleting accounts. Any unauthenticated
HTTP request to these routes today can fully take over user administration
for the whole app. `app/api/supabase-sanity/route.ts` similarly requires no
auth and returns table names, row counts, and sample rows from the database.
Separately, `lib/supabase/middleware.ts` only server-side-protects five
routes, leaving `/configuracion` (the admin UI that calls the above APIs),
`/diagnostico`, `/propuestas`, and `/api/admin/*` reachable without a
session at the page-routing layer (client-side checks can be bypassed by
calling the API directly, which is exactly how routes above are already
exploitable). This is the single highest-severity item in the existing
`SECURITY-AUDIT.md` (§3.1–3.3) and must land before any other work in this
delegation.

## Current state

- `app/api/admin/users/route.ts` — `GET` (list all users) and `POST` (create
  user with arbitrary role) handlers, no auth check:
  ```ts
  export async function GET() {
    try {
      const supabase = createAdminClient()
      const { data, error } = await supabase.auth.admin.listUsers()
      // ... no identity/role check before this point
  ```
- `app/api/admin/users/[id]/route.ts` — `PUT` (change password/role) and
  `DELETE` (delete user) handlers, same pattern, no auth check.
- `app/api/supabase-sanity/route.ts` (lines ~28-52) — returns table names,
  row counts, and 3 sample rows per table, no auth check.
- `lib/supabase/middleware.ts:57-58`:
  ```ts
  const protectedRoutes = ["/transacciones", "/categorias", "/cuentas", "/delegaciones", "/movimientos"]
  const isProtectedRoute = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route))
  ```
- `hooks/use-is-admin.ts` and `hooks/use-delegation-role.ts` already contain
  the client-side logic for checking `membresia.rol`; the pattern for a
  membership check against `gestor_central` is established there — read
  `hooks/use-is-admin.ts` in full before writing the server-side check so
  the role string values match exactly (this repo uses `gestor_central` /
  `tesorero` as role enum values — confirm by reading
  `lib/types/database.ts` for the `membresia.rol` type).
- Server-side Supabase client for reading the current session: `lib/supabase/server.ts`
  exports `createClient()` — this is what other server code uses to read
  `auth.getUser()`. Do NOT use `createAdminClient()` for the identity check —
  only for the privileged operation once identity+role are confirmed.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|-----------------------------------|----------------------|
| Install   | `pnpm install`                    | exit 0               |
| Typecheck | `npx tsc --noEmit`                | exit 0, no errors    |
| Lint      | `pnpm lint`                       | exit 0               |
| Dev server (manual check) | `pnpm dev`        | starts on :3000       |

(No test runner is configured in this repo — see plan `010` if a test
baseline is prioritized. Verification here is typecheck + lint + manual
curl checks below.)

## Scope

**In scope**:
- `app/api/admin/users/route.ts`
- `app/api/admin/users/[id]/route.ts`
- `app/api/supabase-sanity/route.ts`
- `lib/supabase/middleware.ts`
- New file: `lib/auth/require-admin.ts` (shared helper, see Step 1)

**Out of scope**:
- `app/api/bank-sync/*` routes — covered by their own plan (008), and they
  already have separate auth handling (Bearer CRON_SECRET or user session)
  that this plan must not touch.
- Client-side role-check hooks (`use-is-admin.ts`, `use-delegation-role.ts`)
  — those are UX conveniences, not the security boundary; leave them as-is.
- RLS policies on Supabase tables — out of scope; this plan is about the
  Next.js layer only.

## Git workflow

- Branch: `advisor/001-protect-admin-endpoints`
- One commit per step, conventional commit style matching `git log`
  (e.g. `fix(security): require admin role on /api/admin/* routes`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Create a shared server-side admin-check helper

Create `lib/auth/require-admin.ts`:

```ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function requireAdmin() {
  // NOTE: createClient() in lib/supabase/server.ts is SYNCHRONOUS (confirmed
  // at plan-writing time) — do not `await` it. If you find it has since
  // become async, adjust this line, but verify by reading the file first.
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) }
  }

  const { data: membership, error: memErr } = await supabase
    .from("membresia")
    .select("rol")
    .eq("usuario_id", user.id)
    .eq("rol", "gestor_central")
    .maybeSingle()

  if (memErr || !membership) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) }
  }

  return { user }
}
```

`createClient()` in `lib/supabase/server.ts` is synchronous — confirmed by
reading the file at plan-writing time. If it has changed since, adjust the
helper accordingly (see STOP conditions).

**Verify**: `npx tsc --noEmit` → exit 0 (file compiles standalone; it isn't
called anywhere yet).

### Step 2: Guard `app/api/admin/users/route.ts`

At the top of both `GET` and `POST` handlers, before any `createAdminClient()`
call, add:

```ts
const { error, user } = await requireAdmin()
if (error) return error
```

Import `requireAdmin` from `@/lib/auth/require-admin`. Do not remove or
change the existing `createAdminClient()` usage below the check — it's still
needed for the privileged operation itself.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Guard `app/api/admin/users/[id]/route.ts`

Same pattern for `PUT` and `DELETE` handlers.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Protect or remove `app/api/supabase-sanity/route.ts`

Add the same `requireAdmin()` guard at the top of the `GET` handler. Do not
delete the route — it's referenced from `docs/07-diagnostico.md` /
`components/diagnostics/`; check `grep -rn "supabase-sanity" app components`
first and if it's wired into the diagnostic center UI, keep it and just gate
it. If nothing references it client-side, note that in your summary but
still gate it (removing a route is riskier than gating it — leave removal
to a human decision).

**Verify**: `npx tsc --noEmit` → exit 0; `grep -rn "supabase-sanity" app components` output recorded in your summary.

### Step 5: Expand middleware `protectedRoutes`

In `lib/supabase/middleware.ts`, change:

```ts
const protectedRoutes = ["/transacciones", "/categorias", "/cuentas", "/delegaciones", "/movimientos"]
```

to:

```ts
const protectedRoutes = [
  "/transacciones", "/categorias", "/cuentas", "/delegaciones",
  "/movimientos", "/configuracion", "/propuestas",
  "/api/admin", "/api/supabase-sanity",
]
```

**Note**: `SECURITY-AUDIT.md` (§3.3) and `CLAUDE.md` also mention a
`/diagnostico` route and `components/diagnostics/diagnostic-center.tsx`.
As of this plan's writing (`0bc851b`), **neither exists** —
`find app -maxdepth 1 -type d` shows no `app/diagnostico`, and
`components/diagnostics/` is absent. This means `CLAUDE.md`'s route table
and `SECURITY-AUDIT.md`'s §3.3 are stale (the feature was apparently
removed at some point without updating either doc). Do NOT add
`/diagnostico` to `protectedRoutes` — there's nothing there to protect.
Do NOT try to recreate the diagnostic page — out of scope for this plan.
If you find `app/diagnostico` DOES exist when you actually run this (repo
may have changed since planning), treat that as drift: re-add it to the
list above and proceed normally.

Read the full middleware file first — confirm the redirect behavior for
unauthenticated users on a matched route is what you expect (redirect to
`/auth/login`, not a raw 401) since `/api/admin` and `/api/supabase-sanity`
are API routes, not pages — a redirect response on an API route is wrong.
**STOP and report** if the middleware's existing redirect logic doesn't
distinguish page routes from API routes; in that case, exclude the two
`/api/*` entries from the middleware list (they're already covered by
`requireAdmin()` in Steps 2-4, which is the more correct fix for API routes
anyway — the middleware addition is for `/configuracion`, `/diagnostico`,
`/propuestas` specifically) and note the decision in your plan summary.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 6: Manual verification with the dev server

Run `pnpm dev`, then in a separate terminal (do not use a browser session
with an existing login):

```bash
curl -i http://localhost:3000/api/admin/users
```

Expected: `401` with `{"error":"No autenticado"}`, not a user list.

```bash
curl -i http://localhost:3000/api/supabase-sanity
```

Expected: `401`, not table data.

```bash
curl -i http://localhost:3000/configuracion
```

Expected: a redirect (`307`/`302`) to `/auth/login`, not a `200` with the
configuración page HTML.

## Test plan

No test runner is configured (see `plans/010-*` if introduced later). The
manual `curl` checks in Step 6 are the verification for this plan. Record
their actual output (status code + body) in your final summary for the
reviewer.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `curl -i http://localhost:3000/api/admin/users` (no auth cookie) returns 401
- [ ] `curl -i http://localhost:3000/api/admin/users/<any-id>` PUT/DELETE (no auth cookie) returns 401
- [ ] `curl -i http://localhost:3000/api/supabase-sanity` (no auth cookie) returns 401
- [ ] `curl -i http://localhost:3000/configuracion` (no auth cookie) redirects to `/auth/login`
- [ ] A logged-in `gestor_central` user can still successfully load `/configuracion` and use the admin user list (manual check in browser — ask the user to log in with a `gestor_central` account — credentials are not stored in this repo)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The demo user credentials in `CLAUDE.md` don't have `gestor_central` role
  and no other test account is available — you cannot verify the positive
  (authorized) path without one; report and ask rather than skip
  verification.
- `lib/supabase/server.ts`'s `createClient()` signature doesn't match what
  Step 1 assumes (sync vs async) — fix the helper to match, don't guess.
- The `membresia` table's `rol` column values don't match `gestor_central`
  exactly (check `lib/types/database.ts` and/or query the enum) — use the
  real value, don't invent one.
- Any step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Any future admin-only API route must call `requireAdmin()` — mention this
  convention in a comment at the top of `lib/auth/require-admin.ts`.
- `SECURITY-AUDIT.md` should be updated (or a note added) once this plan
  lands, marking §3.1–3.3 as resolved, so future audits don't re-flag it.
- This plan does NOT address §4.2 of `SECURITY-AUDIT.md` (delegation
  isolation depending entirely on RLS) — that requires a database-level
  review outside this plan's scope; flag it to the maintainer as a
  follow-up if not already tracked elsewhere in `plans/`.
