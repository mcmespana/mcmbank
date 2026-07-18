# Plan 016: Restore a green `tsc --noEmit` baseline and add a `typecheck` script

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d759ec9..HEAD -- package.json lib/types/database.ts app/ components/`
> The error inventory below was taken at `d759ec9` (2026-07-18); your first
> action is to regenerate it (Step 1) — the inventory drifts fast in this
> repo, the method below does not.

## Status

- **Priority**: P1
- **Effort**: S/M
- **Risk**: LOW — type-level changes only; no runtime behavior change intended
- **Depends on**: none (plan 011's Step 1 and plan 019's CI typecheck gate depend on THIS)
- **Category**: bug / dx
- **Planned at**: commit `d759ec9`, 2026-07-18

## Why this matters

`npx tsc --noEmit` currently **fails**, and nobody notices because
`next.config.mjs` sets `typescript.ignoreBuildErrors: true` and
`package.json` has no `typecheck` script. History shows why this rots:
between commits `0bc851b` and `d759ec9` (one day, 18 merged PRs) an entire
family of `never`-typed Supabase queries in `app/api/bank-sync/*` appeared
and was fixed again without the gate ever existing — and a NEW batch of
errors (missing module + implicit-any parameters in the new
facturas/cuentas code) shipped in its place. Until `tsc --noEmit` is green
and scripted, no plan in this directory can use typechecking as a
verification gate, and every merge can silently regress types on
money-handling code.

## Current state

Inventory at `d759ec9` — `npx tsc --noEmit` prints 56 error lines, two
families (regenerate before trusting):

1. `app/layout.tsx(5,31): error TS2307: Cannot find module
   '@vercel/speed-insights/next'` — the dep IS in `package.json`
   (`@vercel/speed-insights ^2.0.0`); most likely `node_modules` is stale.
   `npx pnpm install` first; only if the error survives a fresh install is
   there a real problem.
2. `TS7006` implicit-`any` parameters clustered in recently merged
   feature code: `components/cuentas/cuentas-manager.tsx` (~10 sites:
   callbacks like `(item)`, `(cuenta)`, `(a, b)` in sorts/maps),
   `components/dashboard/category-analysis.tsx` (`(row)`, `(sum, r)`
   reducers), and possibly siblings — get the full list from the fresh
   run. These are annotation-only fixes: give each callback parameter the
   type of the array element it iterates (the arrays are typed a few lines
   up; hover/inspect the source collection).

Also missing: a `"typecheck"` script in `package.json` (verify — scripts
at `d759ec9`: `build/dev/lint/lint:fix/start/test`).

Note: `eslint.config.js` sets `@typescript-eslint/no-explicit-any: off` —
adding `any` annotations would "fix" tsc but is forbidden here: use real
element types.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Install   | `npx pnpm install`   | exit 0 |
| Typecheck | `npx tsc --noEmit`   | exit 0 at the end of this plan |
| Lint      | `pnpm lint`          | exit 0 |
| Tests     | `pnpm test`          | all pass |
| Build     | `pnpm build`         | exit 0 |

## Scope

**In scope**:
- Type annotations in the files the fresh inventory names (at plan time:
  `components/cuentas/cuentas-manager.tsx`,
  `components/dashboard/category-analysis.tsx`, `app/layout.tsx` only if
  the module error survives reinstall).
- `package.json` — add `"typecheck": "tsc --noEmit"`.
- `lib/types/database.ts` — only if an error traces to a genuinely missing
  column vs. the live schema (see STOP conditions).

**Out of scope**:
- Removing `ignoreBuildErrors: true` from `next.config.mjs` — plan 011
  Step 1; this plan makes it possible.
- Any runtime/behavioral change. If a type error can only be fixed by
  changing what the code does, STOP and report.
- Sweeping the codebase for `(supabase as any)` casts or other latent
  type debt not surfaced by `tsc --noEmit`.

## Git workflow

- Branch: `advisor/016-green-typecheck`
- Conventional commits, e.g. `fix(types): annotate implicit-any callbacks in cuentas/dashboard; add typecheck script`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Fresh install + fresh inventory

`npx pnpm install`, then `npx tsc --noEmit 2>&1 | tee /tmp/tsc-baseline.txt`.
Group the errors by file. If the `@vercel/speed-insights` TS2307 is gone
after install, note that and move on.

**Verify**: inventory file exists; error count recorded.

### Step 2: Annotate implicit-any parameters file by file

For each TS7006 site, derive the element type from the collection being
iterated (e.g. if the array is `CuentaConDelegacion[]`, annotate
`(cuenta: CuentaConDelegacion)`); prefer importing existing types from
`lib/types/database.ts` / local interfaces over inventing new ones, and
NEVER use `any`. Re-run tsc after each file.

**Verify**: `npx tsc --noEmit 2>&1 | grep -c TS7006` → `0`.

### Step 3: Zero the remainder, add the script

Fix any residual errors (bounded per STOP conditions). Add
`"typecheck": "tsc --noEmit"` to `package.json` scripts.

**Verify**: `pnpm typecheck` → exit 0. `pnpm build` → exit 0. `pnpm lint`
→ exit 0. `pnpm test` → all pass.

## Test plan

Type-only change; gates are the commands above plus a manual smoke:
`pnpm dev`, log in, open `/cuentas` and the dashboard `/` — no new console
errors, both render.

## Done criteria

- [ ] `pnpm typecheck` exists and exits 0
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` exit 0
- [ ] `git diff` shows only type annotations / imports / the script line — no runtime-logic changes
- [ ] No `any` added anywhere (`git diff | grep '^+' | grep -c ': any'` → 0)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The fresh inventory exceeds ~30 errors or spans files far beyond the
  two named components — report the grouped list; the maintainer may want
  it split into a dedicated cleanup plan.
- An error traces to a column/table genuinely absent from
  `lib/types/database.ts` vs. the live DB (schema drift) — report table +
  column + call site; updating `database.ts` is in scope only when you can
  confirm the live schema (Supabase MCP `list_tables`, project
  `bnmgfkyfwcdvyhuqbaah`); never guess a column into the types.
- The `@vercel/speed-insights` error survives a fresh `pnpm install` —
  check whether `app/layout.tsx`'s import path matches the package's
  exports for the installed v2; if the fix isn't an obvious import-path
  correction, STOP and report.

## Maintenance notes

- Plan 011 Step 1 (remove `ignoreBuildErrors`) should follow immediately —
  and plan 019 wires `pnpm typecheck` into CI so this can't rot a third
  time.
- Whenever a migration lands in `scripts/`, `lib/types/database.ts` must
  be updated in the same PR (CLAUDE.md convention).
