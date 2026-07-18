# Plan 014: Lock down anon-callable aggregation RPCs and enable RLS on the categoria tables

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d759ec9..HEAD -- scripts/ lib/services/database.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 — live, unauthenticated data exposure. Do this first.
- **Effort**: S
- **Risk**: LOW (SQL-only, additive checks; the one behavioral risk is called out in Step 3)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `d759ec9`, 2026-07-18

## Why this matters

Verified against the **live** Supabase project (`bnmgfkyfwcdvyhuqbaah`) on
2026-07-17, not just the repo:

1. The three dashboard aggregation functions `get_financial_summary`,
   `get_monthly_trend`, `get_category_breakdown` are `SECURITY DEFINER`,
   contain **no membership check**, and are **executable by the `anon`
   role**. Anyone holding the public anon key (it ships in the client
   bundle) can call e.g. `supabase.rpc("get_financial_summary", { p_delegacion_id: <any uuid>, ... })`
   without logging in and read any delegation's income/expense/balance
   totals. The comment in `scripts/037_aggregation_functions.sql:8-9`
   claims the functions "respetan RLS del usuario llamante" — that is
   false: `SECURITY DEFINER` runs as the function owner and bypasses RLS.
2. RLS is **disabled** on `categoria` and `categoria_orden_delegacion`
   (Supabase security advisor reports this at ERROR level:
   `policy_exists_rls_disabled` / `rls_disabled_in_public`). Policies named
   "Ver categoria" / "Gestionar categoria" exist on `categoria` but are
   inert while `rowsecurity=false` — so any anon-key holder can read and
   write all categories and per-delegation ordering overrides.
3. The other core tables (`cuenta`, `movimiento`, `delegacion`,
   `membresia`, `organizacion`) DO have RLS enabled with delegation-scoped
   policies — but those policies exist **only in the live DB**, not in any
   `scripts/*.sql` migration. The deployed function bodies also differ
   from `scripts/037_aggregation_functions.sql` (deployed versions join
   `cuenta` and filter `cu.activa = true`; the repo file does not). The
   repo is not the source of truth for the security model, which is how
   items 1 and 2 went unnoticed.

This plan fixes 1 and 2 with one new migration, and closes the
repo-vs-live drift for the objects it touches.

## Current state

- `scripts/037_aggregation_functions.sql:17-44` — `get_financial_summary`
  definition: `SECURITY DEFINER`, `WHERE delegacion_id = p_delegacion_id`
  and date range only; no `auth.uid()` / membership check. Same pattern for
  `get_monthly_trend` (lines 51-76) and `get_category_breakdown` (84-120).
- Live DB (verified via SQL over `pg_proc`/`pg_policies`/`pg_tables`):
  - all three functions `prosecdef = true`, executable by `anon` and
    `authenticated` (advisor lints `anon_security_definer_function_executable`).
  - `categoria` and `categoria_orden_delegacion`: `rowsecurity = false`;
    `categoria` has policies `Ver categoria` (SELECT, `auth.role() = 'authenticated'`)
    and `Gestionar categoria` (ALL, `is_gestor_central()`).
  - a live helper `is_gestor_central()` exists (SECURITY DEFINER):
    returns true when `membresia` has a row for `auth.uid()` with
    `rol = 'gestor_central'`.
- Client call sites of the RPCs (must keep working for logged-in members):
  - `lib/services/database.ts:401` — `client.rpc("get_financial_summary", {...})`
  - `lib/services/database.ts:427` — `get_monthly_trend`
  - `lib/services/database.ts:449` — `get_category_breakdown`
  These run in the browser with the *authenticated* user session
  (hooks `use-financial-summary.ts`, `use-monthly-trend-data.ts`,
  `use-category-breakdown.ts`).
- Migration convention: numbered SQL files in `scripts/`, next free number
  is `041` (highest existing is `040_create_contacto.sql`). Migrations are
  applied by hand / via the Supabase SQL editor or MCP `apply_migration` —
  there is no automated migration runner in the repo.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Lint (untouched by SQL, run to prove no code drift) | `pnpm lint` | exit 0 |
| Typecheck | `npx tsc --noEmit` | same error count as before this plan (a pre-existing failing baseline is being fixed by plan 016 — this plan must not change it) |

SQL is applied to the live project. If you have Supabase MCP tools, use
`apply_migration` with the migration content; otherwise print the SQL and
ask the operator to run it in the Supabase SQL editor. **Never apply DDL
with plain `execute_sql`.**

## Scope

**In scope**:
- New file `scripts/041_secure_aggregation_rpcs_and_categoria_rls.sql`
- `scripts/037_aggregation_functions.sql` — append a header comment noting
  it is superseded by 041 (do not rewrite its body; history stays).
- Applying 041 to the live project (with operator confirmation).

**Out of scope**:
- Any TypeScript/React change. The RPC signatures do not change.
- Backfilling the other live-only RLS policies (`cuenta`, `movimiento`, …)
  into a migration — valuable reproducibility work, but a separate,
  larger dump-and-review task; note it in your summary.
- Storage bucket visibility (plan 002 handles the facturas/documentos
  exposure).
- The `regla` table (RLS enabled, no policies — it has no code using it;
  covered by the plan 020 design spike).

## Git workflow

- Branch: `advisor/014-secure-rpcs-and-categoria-rls`
- One commit: `fix(security): require membership in aggregation RPCs, enable RLS on categoria tables`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Write migration `scripts/041_secure_aggregation_rpcs_and_categoria_rls.sql`

The migration must do exactly this:

```sql
-- 041: Cerrar exposición de datos: RPCs de agregación y RLS de categoria
-- (1) Las RPCs SECURITY DEFINER no comprobaban pertenencia y eran
--     ejecutables por anon → cualquier poseedor de la anon key podía leer
--     los totales financieros de cualquier delegación.
-- (2) categoria y categoria_orden_delegacion tenían políticas creadas pero
--     RLS deshabilitado (advisor ERROR policy_exists_rls_disabled).

-- ---------- (1) Membership check dentro de cada RPC ----------
CREATE OR REPLACE FUNCTION public.assert_delegacion_member(p_delegacion_id uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (
    is_gestor_central()
    OR EXISTS (
      SELECT 1 FROM membresia m
      WHERE m.delegacion_id = p_delegacion_id
        AND m.usuario_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'not a member of this delegation' USING ERRCODE = '42501';
  END IF;
END;
$$;
```

Then re-create each of the three functions **from the live definition**
(fetch it first — see STOP conditions; the live bodies join `cuenta cu ON
cu.id = m.cuenta_id AND cu.activa = true`, unlike the repo file), adding
`PERFORM`-style guard as the first statement. Because they are `LANGUAGE
sql`, either convert to `plpgsql` with the guard, or keep `sql` and embed
the check, e.g. for `get_financial_summary`:

```sql
CREATE OR REPLACE FUNCTION public.get_financial_summary(
  p_delegacion_id uuid, p_desde date, p_hasta date)
RETURNS TABLE (ingresos numeric, gastos numeric, balance numeric,
               total_movimientos bigint, sin_categoria bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ... -- live body unchanged
  FROM movimiento m
  JOIN cuenta cu ON cu.id = m.cuenta_id
  WHERE assert_delegacion_member(p_delegacion_id) IS NOT DISTINCT FROM NULL
    AND m.delegacion_id = p_delegacion_id
    AND m.ignorado = false AND cu.activa = true
    AND m.fecha BETWEEN p_desde AND p_hasta;
$$;
```

(The `assert_delegacion_member(...) IS NOT DISTINCT FROM NULL` term forces
the check to run and raises for non-members; the plpgsql-conversion
variant is equally acceptable and clearer — pick one and use it for all
three functions consistently.)

Finally revoke anon execution:

```sql
REVOKE EXECUTE ON FUNCTION public.get_financial_summary(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_monthly_trend(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_category_breakdown(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assert_delegacion_member(uuid) FROM anon;

-- ---------- (2) Habilitar RLS en las tablas de categorías ----------
ALTER TABLE public.categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categoria_orden_delegacion ENABLE ROW LEVEL SECURITY;
```

Before enabling RLS on `categoria_orden_delegacion`, list its existing
policies (`select policyname, cmd from pg_policies where tablename='categoria_orden_delegacion'`).
If it has **no** policies, enabling RLS alone would block ALL client
access (deny-by-default) — in that case the migration must also add
policies mirroring the app's real access pattern: authenticated members of
the delegation can SELECT/INSERT/UPDATE/DELETE rows whose
`delegacion_id` matches a `membresia` row for `auth.uid()` (copy the
`EXISTS (SELECT 1 FROM membresia m WHERE m.delegacion_id = <t>.delegacion_id AND m.usuario_id = auth.uid())`
shape from the live `Gestionar cuenta` policy quoted in "Current state" of
this plan).

**Verify**: file exists; `git status` shows only in-scope files.

### Step 2: Apply to the live project and test as a member

Apply migration 041 to project `bnmgfkyfwcdvyhuqbaah` via
`apply_migration` (or hand to the operator). Then verify:

1. `select rowsecurity from pg_tables where tablename in ('categoria','categoria_orden_delegacion');`
   → both `true`.
2. As `anon` (no auth): calling `get_financial_summary` must fail. From
   SQL you can simulate: `set role anon; select * from get_financial_summary('00000000-0000-0000-0000-000000000000','2026-01-01','2026-12-31');`
   → permission denied for function. `reset role;` afterwards.
3. In the running app (`pnpm dev`, log in as the demo user
   `admin@movimientoconsolacion.com`), open the dashboard `/` — the
   summary, trend, and category cards must still load with data, and the
   `/categorias` page must still list categories.

**Verify**: all three checks pass.

### Step 3: Mark 037 superseded and record advisor re-check

Append to the top of `scripts/037_aggregation_functions.sql`:
`-- SUPERSEDIDO por 041_secure_aggregation_rpcs_and_categoria_rls.sql (membership check + revoke anon).`

Re-run the Supabase security advisors (MCP `get_advisors`, type
`security`) and record in your summary that
`policy_exists_rls_disabled`/`rls_disabled_in_public` for the two
categoria tables and the `anon_security_definer_function_executable` lints
for the three aggregation functions are gone.

**Verify**: advisor output no longer contains those lints for those objects.

## Test plan

No JS test runner needed — the verification is SQL-level (Step 2) plus the
manual dashboard check. If plan 015 (Vitest baseline) has already landed,
no new JS tests are required by this plan.

## Done criteria

- [ ] `scripts/041_secure_aggregation_rpcs_and_categoria_rls.sql` committed
- [ ] Live: `rowsecurity = true` on `categoria` and `categoria_orden_delegacion`
- [ ] Live: `anon` cannot execute the three aggregation functions; a non-member authenticated user calling them for a foreign delegation gets an error, a member gets data
- [ ] Dashboard `/` and `/categorias` still render data for a logged-in member
- [ ] `npx tsc --noEmit` error count unchanged; `pnpm lint` exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- You cannot fetch the **live** function bodies (via
  `select prosrc from pg_proc where proname='get_financial_summary'` or
  the Supabase dashboard). Do NOT recreate the functions from
  `scripts/037_aggregation_functions.sql` alone — the repo file is known to
  be stale (missing the `cuenta`/`activa` join); recreating from it would
  silently change dashboard numbers to include inactive accounts.
- Enabling RLS on either categoria table makes `/categorias` or the
  dashboard category card empty for a logged-in member — the policy set is
  incomplete for the app's real queries; report which query fails instead
  of loosening the policy to `true`.
- The live DB shows the functions already contain a membership check
  (someone fixed it out-of-band) — report and reduce this plan to the
  RLS-enable + migration-backfill portion.

## Maintenance notes

- **Ops items for the maintainer (dashboard, not code)** — surfaced by the
  same live advisor run, out of executor scope: (a) Postgres version has
  pending security patches (`vulnerable_postgres_version`) — schedule an
  upgrade from the Supabase dashboard; (b) leaked-password protection is
  disabled in Auth settings; (c) `pg_net` extension installed in `public`.
- The core-table RLS policies still live only in the DB. Recommend a
  follow-up: dump all `storage`/`public` policies into a
  `scripts/000_baseline_policies.sql` so audits can run against the repo.
- `SECURITY-AUDIT.md` (repo root) is stale in both directions (claims
  fixed CVEs are open, missed this RPC hole). After this plan lands, add a
  dated note at its top pointing to `plans/README.md` as the current
  security tracker.
- Any future RPC that takes a `delegacion_id` parameter must call
  `assert_delegacion_member` — this is now the convention.
