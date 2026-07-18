# Plan 011: Security hardening — response headers, email validation, build-error suppression, error detail leakage

> **Executor instructions**: Follow this plan step by step, run every
> verification command, and stop per STOP conditions rather than
> improvising. Update `plans/README.md`'s status row when done.
>
> **Drift check**: `git diff --stat 0bc851b..HEAD -- next.config.mjs app/api/admin/users/route.ts lib/supabase/middleware.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-protect-admin-and-diagnostic-endpoints.md should land first (this plan edits the same admin route files; sequencing avoids merge conflicts, not a hard technical dependency)
- **Category**: security
- **Planned at**: commit `0bc851b`, 2026-07-16

## Why this matters

This bundles several medium/low-severity findings from the existing
`SECURITY-AUDIT.md` (§4.3, §4.4, §4.5, §4.6, §5.1) that are each small
individually but compound: missing security response headers, a
too-permissive email regex on user creation, TypeScript build errors
silently ignored in production builds, raw Supabase error messages leaked
to API clients, and a middleware fail-open path if env vars are missing.
None require architectural change — each is a small, contained fix.

## Current state

- `next.config.mjs:5` — `typescript: { ignoreBuildErrors: true }`.
- `next.config.mjs` — no `headers()` function currently defined (confirm by
  reading the full file — if one now exists, treat as drift and merge into
  it rather than overwriting).
- `app/api/admin/users/route.ts` — email validation regex:
  ```ts
  const emailRegex = /.+@.+\..+/
  ```
  (find the exact line via `grep -n "emailRegex" app/api/admin/users/route.ts`).
- `app/api/admin/users/route.ts`, `app/api/admin/users/[id]/route.ts`,
  `app/api/supabase-sanity/route.ts` — return `error.message` from Supabase
  directly in JSON responses (e.g. `NextResponse.json({ error: error.message }, { status: 500 })`),
  exposing internal table/constraint names to clients.
- `lib/supabase/middleware.ts:13-17`:
  ```ts
  if (!isSupabaseConfigured) {
    return NextResponse.next({ request })
  }
  ```
  — if Supabase env vars are missing at runtime (deployment misconfiguration),
  the middleware lets every request through unauthenticated instead of
  failing closed.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Typecheck | `npx tsc --noEmit`   | exit 0 — **see Step 1, this is expected to newly surface real errors once `ignoreBuildErrors` is removed; that's the point, not a failure of this plan** |
| Lint      | `pnpm lint`          | exit 0               |
| Build     | `pnpm build`          | exit 0               |

## Scope

**In scope**:
- `next.config.mjs` — remove `ignoreBuildErrors`, add a `headers()` function.
- `app/api/admin/users/route.ts` — email regex fix, error message sanitization.
- `app/api/admin/users/[id]/route.ts` — error message sanitization.
- `app/api/supabase-sanity/route.ts` — error message sanitization (if the
  route still exists after plan 001 — it should, just gated).
- `lib/supabase/middleware.ts` — fail-closed behavior when misconfigured.

**Out of scope**:
- Fixing every TypeScript error that `ignoreBuildErrors: true` may have
  been hiding — see Step 1's STOP condition; that could be a large,
  separate cleanup effort not bounded by this plan's effort estimate.
- Rate limiting (SECURITY-AUDIT.md §5.2) — deferred; needs an infra
  decision (Vercel-native rate limiting vs. a library) better made by the
  maintainer, not silently picked by an executor. Note it in your summary
  as a follow-up recommendation.
- Excessive `console.log` cleanup (§5.4) — a large, low-risk-but-tedious
  sweep across 145+ call sites; out of scope for this plan, worth its own
  dedicated plan if prioritized later.
- Hardcoded email addresses in `lib/actions/auth.ts` (§5.6) — small, but
  unrelated to this plan's "security response surface" theme; not included
  here to keep this plan's diff reviewable as one coherent change.

## Git workflow

- Branch: `advisor/011-security-hardening`
- One commit per step, conventional commits (e.g.
  `fix(security): add response security headers`,
  `fix(security): stricter email validation on user creation`,
  `fix(security): don't leak raw Supabase error messages to clients`,
  `fix(security): fail closed in middleware when Supabase env is missing`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Attempt removing `ignoreBuildErrors` first — this determines the rest of this step's scope

In `next.config.mjs`, temporarily remove:
```js
typescript: {
  ignoreBuildErrors: true,
}
```
Run `npx tsc --noEmit`. **If it reports zero errors**, leave the config
change in place — proceed to Step 2. **If it reports one or more errors**,
this is a STOP condition for this specific sub-change only (not the whole
plan): revert this one edit (put `ignoreBuildErrors: true` back), skip it,
and note in your summary exactly how many type errors exist and in which
files, so the maintainer can decide whether to schedule a dedicated
type-error cleanup plan. Do not attempt to fix arbitrary pre-existing type
errors as part of this plan — that's unbounded scope creep for what should
be a contained security-hardening change. Continue with Steps 2-5
regardless of this sub-decision.

**Verify**: `npx tsc --noEmit` → record actual error count in your summary either way.

### Step 2: Add security response headers

In `next.config.mjs`, add a `headers()` async function to the exported
config object:

```js
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ],
    },
  ]
},
```

Do not add a `Content-Security-Policy` header in this plan — a correct CSP
for a Supabase + Next.js app with dynamic script/style needs (Radix,
Recharts, etc.) requires careful tuning against actual runtime behavior to
avoid breaking the app, and a wrong CSP is worse than none; that's worth
its own follow-up plan with dedicated manual QA across every page, not a
bundled item here.

**Verify**: `npx tsc --noEmit` → exit 0; start `pnpm dev`, `curl -I http://localhost:3000/` and confirm the new headers appear in the response.

### Step 3: Fix email validation regex

In `app/api/admin/users/route.ts`, replace:
```ts
const emailRegex = /.+@.+\..+/
```
with:
```ts
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

**Verify**: `npx tsc --noEmit` → exit 0. Manual check: with `pnpm dev` running and logged in as an admin, attempt creating a user with an obviously-invalid email like `@.a` via the `/configuracion` UI (or a direct authenticated `curl` to the endpoint) and confirm it's now rejected with a clear validation error, while a normal email like `test@example.com` is still accepted.

### Step 4: Stop leaking raw Supabase error messages

In each of the three files listed in Scope, find every
`NextResponse.json({ error: error.message }, ...)` (or similar) pattern
returning a Supabase-originated error directly. Replace with a generic
message for the client, while still logging the real error server-side for
debugging:

```ts
console.error("Admin users API error:", error)
return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 500 })
```

Do this for every such call site in the three files — search each file for
`error.message` to find them all.

**Verify**: `npx tsc --noEmit` → exit 0; `grep -n "error.message" app/api/admin/users/route.ts app/api/admin/users/\[id\]/route.ts app/api/supabase-sanity/route.ts` — review remaining matches to confirm none are still returned directly in a client-facing `NextResponse.json` (some may legitimately remain in `console.error` calls, which is fine and expected).

### Step 5: Fail closed in middleware when Supabase isn't configured

In `lib/supabase/middleware.ts`, read the surrounding context of:
```ts
if (!isSupabaseConfigured) {
  return NextResponse.next({ request })
}
```
first — confirm what `isSupabaseConfigured` checks and why this early
return exists (it may be intentionally permissive for a specific local-dev
scenario without env vars — read any comment above it and check
`CLAUDE.md`'s "Environment Variables" section for context). If it's purely
a defensive fallback for misconfigured deployments (not an intentional
local-dev convenience), change it to fail closed for protected routes only
— i.e. still allow public/auth pages to render (so the misconfiguration is
at least visible/debuggable rather than a blank error page), but redirect
protected-route requests to a clear error state instead of letting them
through unauthenticated:

```ts
if (!isSupabaseConfigured) {
  if (isProtectedRoute) {
    return NextResponse.redirect(new URL("/auth/login?error=config", request.url))
  }
  return NextResponse.next({ request })
}
```

Note this requires `isProtectedRoute` to be computed before this check —
read the function's control flow order and adjust if the check currently
happens before `protectedRoutes` is evaluated; reorder as needed.
**If you determine this early-return is actually load-bearing for a
legitimate local-dev-without-env-vars workflow that this change would
break, STOP and report instead of changing it** — confirm by checking
whether `CLAUDE.md` or `README.md` describe running the app without
Supabase configured as a supported mode.

**Verify**: `npx tsc --noEmit` → exit 0. Manual check: temporarily unset (in a scratch `.env.local` copy, not the real one — do not touch the actual `.env.local`) the Supabase env vars, run `pnpm dev`, confirm `/transacciones` now redirects to `/auth/login?error=config` instead of rendering. Restore the real env afterward.

## Test plan

No test runner configured. Each step's manual verification above is the
test plan. Record actual `curl -I` header output and the manual UI checks'
results in your summary.

## Done criteria

- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] Response headers present on `curl -I http://localhost:3000/` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Strict-Transport-Security)
- [ ] Invalid email `@.a` rejected by the user-creation endpoint; valid email still accepted
- [ ] No `error.message` passed directly into a client-facing `NextResponse.json` in the three admin/sanity route files
- [ ] Middleware fails closed on protected routes when Supabase is misconfigured (manually verified with scratch env, real `.env.local` restored afterward)
- [ ] `ignoreBuildErrors` either removed (if zero pre-existing type errors) or left in place with the error count documented in your summary
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Removing `ignoreBuildErrors` surfaces pre-existing type errors — revert
  just that sub-change (see Step 1), don't fix unrelated type errors.
- The `isSupabaseConfigured` early-return in middleware turns out to be an
  intentional, documented local-dev convenience — don't change it; report
  instead.
- Any manual verification step fails twice after a reasonable fix attempt.
- You find yourself about to touch the real `.env.local` file for the
  middleware test in Step 5 — don't; use a scratch copy or a temporary
  environment override instead, and make sure the real file is untouched
  when you're done (`git status` won't catch `.env.local` since it's
  gitignored — double-check manually).

## Maintenance notes

- Rate limiting (SECURITY-AUDIT.md §5.2) and the `console.log` cleanup
  (§5.4) remain open — recommend the maintainer schedule them as separate
  plans given their different risk/effort shape from this bundle.
- A proper CSP header is a valuable follow-up but needs dedicated QA across
  every page before shipping — don't add a token/placeholder CSP as part of
  a future quick pass; it needs to be done right or not at all.
