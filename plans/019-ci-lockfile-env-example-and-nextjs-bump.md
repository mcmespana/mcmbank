# Plan 019: CI pipeline, single lockfile, pre-commit hooks, `.env.example`, README env docs, and Next.js security bump

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d759ec9..HEAD -- package.json pnpm-lock.yaml package-lock.json README.md .github/ .husky/`
> On drift, compare "Current state" before proceeding; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M (five small, independent sub-changes — do them as separate commits)
- **Risk**: LOW-MED (the Next.js bump is the only behavioral change; gated by build+smoke)
- **Depends on**: plans/016-restore-green-typecheck-baseline.md (for the CI typecheck gate; if 016 isn't DONE, wire CI without the typecheck step and note it). Best after plan 010 (pinning) to avoid lockfile churn — sequencing only.
- **Category**: dx / dependencies / docs
- **Planned at**: commit `d759ec9`, 2026-07-18

## Why this matters

The repo has an active PR-based workflow (PRs #138-#141 merged recently)
but **no CI** — nothing runs lint, typecheck, tests, or build before
merge. Meanwhile: **two lockfiles** are committed (`package-lock.json` AND
`pnpm-lock.yaml`) though the documented workflow is pnpm; `husky` +
`lint-staged` are installed but wired to nothing (no `.husky/`, no
`prepare` script, no lint-staged config); there is **no `.env.example`**
and the README documents only 4 of the ~14 env vars the code reads — a
fresh clone has broken bank-sync/cron/email with no explanation. Finally,
`pnpm audit` (2026-07-17) reports a **HIGH** advisory in `next`
(GHSA-vfv6-92ff-j949 family output; patched in `>= 16.2.5`; repo is on
`^16.1.6` — the caret does not cross 16.2.x automatically because the
lockfile pins the resolved version).

## Current state

- No `.github/` directory (verified). No `.husky/`. No `.env.example`.
- `package.json`: scripts `build/dev/lint/lint:fix/start` (+ `typecheck`
  and `test` if plans 015/016 landed); devDeps include `husky ^9.1.7`,
  `lint-staged ^16.1.6`; no `packageManager` field; `pnpm.overrides`
  block exists (so pnpm is the intended manager); `next: ^16.1.6`.
- Tracked lockfiles: both `package-lock.json` and `pnpm-lock.yaml`
  (`git ls-files | grep lock`).
- Env vars read by code (grep `process.env` across `app lib scripts`):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`,
  `NEXT_PUBLIC_SKIP_PROFILE_CREATION`, `SUPABASE_SERVICE_ROLE_KEY`,
  `CRON_SECRET`, `RESEND_API_KEY`, `ENABLE_BANKING_APP_ID`,
  `ENABLE_BANKING_PRIVATE_KEY`, `ENABLE_BANKING_PSU_IP`,
  `ENABLE_BANKING_PSU_UA`, `ENABLE_BANKING_REDIRECT_URL` — re-run the grep
  when you start; this list may have grown.
- `README.md` "Variables de entorno" section lists only the 4
  `NEXT_PUBLIC_*` vars.
- `docs/ENABLE_BANKING.md` documents the EB-specific vars — link, don't
  duplicate.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Install   | `npx pnpm install`   | exit 0 |
| Lint      | `pnpm lint`          | exit 0 |
| Typecheck | `pnpm typecheck`     | exit 0 (if plan 016 landed) |
| Tests     | `pnpm test`          | exit 0 (if plan 015 landed) |
| Build     | `pnpm build`         | exit 0 |
| Audit     | `npx pnpm audit --prod` | `next` HIGH advisory gone after Step 5 |

## Scope

**In scope**:
- `.github/workflows/ci.yml` (create)
- Delete `package-lock.json`; add it to `.gitignore`; add
  `"packageManager": "pnpm@<installed major.minor.patch>"` to `package.json`
  (get the version from `npx pnpm --version`).
- `"prepare": "husky"` script; `.husky/pre-commit` running
  `npx lint-staged`; a `lint-staged` key in `package.json` running
  `eslint --fix` on staged `*.{ts,tsx}`.
- `.env.example` (create — variable NAMES and placeholder comments ONLY;
  never a real value).
- `README.md` — expand the env section; point to `.env.example` and
  `docs/ENABLE_BANKING.md`.
- `package.json` + `pnpm-lock.yaml` — bump `next` to the latest 16.x
  (`^16.2.5` or later) and `eslint-config-next` to match.

**Out of scope**:
- Fixing any lint/type/test failure CI reveals beyond what the bump itself
  introduces — report them.
- Renovate/Dependabot setup (recommend in summary).
- The remaining `"latest"` pins (plan 010) and `path`/`url` removal (plan
  010 addendum).
- Vercel deployment config.

## Git workflow

- Branch: `advisor/019-ci-and-dx`
- One commit per step (5 commits), conventional commits:
  `chore(ci): add GitHub Actions pipeline`, `chore: standardize on pnpm lockfile`,
  `chore: wire husky + lint-staged pre-commit`, `docs: add .env.example and complete README env vars`,
  `fix(deps): bump next to 16.2.x (security)`.
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Single lockfile + packageManager

Delete `package-lock.json`, append `package-lock.json` to `.gitignore`,
add the `packageManager` field. Run `npx pnpm install`.

**Verify**: `git ls-files | grep -c package-lock.json` → 0; `npx pnpm install` exit 0 with no lockfile diff.

### Step 2: CI workflow

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck   # omit + note in summary if plan 016 not DONE
      - run: pnpm test        # omit + note in summary if plan 015 not DONE
      - run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co"
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder"
          NEXT_PUBLIC_SITE_URL: "http://localhost:3000"
```

If `pnpm build` fails in CI solely due to missing env values beyond these
placeholders, add further PLACEHOLDER values (never secrets) env-by-env
until green — record which were needed.

**Verify**: locally run the same sequence (`pnpm install --frozen-lockfile && pnpm lint && pnpm build` with the placeholder envs) → exit 0. (You cannot run Actions itself; local parity is the gate.)

### Step 3: Pre-commit hooks

Add `prepare` script, run `npx pnpm install` (installs hooks), create
`.husky/pre-commit` with `npx lint-staged`, add to `package.json`:

```json
"lint-staged": { "*.{ts,tsx}": "eslint --fix" }
```

**Verify**: `git commit` on a staged `.ts` file with a lint-fixable issue
auto-fixes it (test with a scratch change, then restore).

### Step 4: `.env.example` + README

Create `.env.example` with every var from "Current state" (fresh grep),
grouped Public / Server / Enable Banking, each with a one-line Spanish
comment matching the repo's documentation language. Update `README.md`'s
env section to the full list, pointing at `.env.example` and
`docs/ENABLE_BANKING.md`.

**Verify**: `grep -c "=" .env.example` ≥ 13; no value after any `=` is a
real credential (placeholders like `xxx` only); README section lists the
same names.

### Step 5: Bump Next.js

`npx pnpm add next@^16.2.5 eslint-config-next@^16.2.5` (or current latest
16.x — check `npm view next dist-tags.latest`; stay on major 16).

**Verify**: `pnpm build` exit 0; `pnpm dev` + login + `/transacciones`
renders; `npx pnpm audit --prod 2>&1 | grep -i "next"` no longer shows the
HIGH `next` advisory.

## Test plan

Existing suites (if present) must stay green: `pnpm test`. The CI file is
verified by local command parity (Step 2) and, once pushed by the
operator, by the first PR run — note in your summary that the operator
should watch the first Actions run.

## Done criteria

- [ ] `.github/workflows/ci.yml` committed; local parity sequence exits 0
- [ ] Exactly one lockfile tracked (`pnpm-lock.yaml`); `packageManager` set
- [ ] `.husky/pre-commit` runs lint-staged (demonstrated once)
- [ ] `.env.example` exists, ≥ 13 vars, zero real values
- [ ] README env section complete
- [ ] `next` ≥ 16.2.5; HIGH advisory gone from `pnpm audit --prod`
- [ ] `pnpm build` exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- The Next 16.2.x bump breaks the build or a page render in the smoke
  check — revert Step 5 only, report the exact error (the rest of the plan
  stands).
- Deleting `package-lock.json` changes resolved versions on
  `pnpm install` in a way that breaks the build — restore, report.
- `pnpm audit` shows a NEW high/critical advisory introduced by the bump —
  report before committing.

## Maintenance notes

- Recommend Renovate/Dependabot next (not configured here) — with CI in
  place, automated bump PRs become safe to review.
- `pnpm audit` (2026-07-17) also reported 10 other HIGH advisories in
  transitive deps — most resolve via plan 010's pinning + this bump;
  re-run and triage the residue after both land.
- When plans 015/016 land after this one, add their `pnpm test` /
  `pnpm typecheck` lines to `ci.yml` if they were omitted.
