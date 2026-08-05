# Implementation Plans — MCM Bank

Two audit generations live here:

- **Plans 001–013**: generated 2026-07-16 at commit `0bc851b` (4 parallel
  category audits + integration of `SECURITY-AUDIT.md`).
- **Plans 014–020** and the addenda inside 002/010/011: generated
  2026-07-17/18 by a deeper re-audit (fresh 4-agent pass on
  correctness/security/perf-tests/DX-docs-direction **plus live Supabase
  verification** — security advisors, `pg_policies`, function sources —
  which the first pass couldn't do). Findings were verified by direct
  reads and live SQL before planning.

**Important context on drift**: the repo moved from `0bc851b` to `d759ec9`
(18 PRs, +4,675 lines in audited files — new facturas section, informes,
React Query adoption, Vitest harness, regenerated DB types) *while the
second audit was being written*. Plans 014–020 were re-verified and
re-stamped at `d759ec9`. Plans 001–013 remain stamped `0bc851b` — their
drift checks will fire; executors must re-locate excerpts by content, and
002/010/011 carry dated addenda that update their premises. **Plans 003
and 004 (facturas features) need a maintainer review before execution**:
PR #159 shipped a facturas inbox + movimiento reconciliation
(`scripts/047`, `048`) that may partially supersede them.

Each executor: read the plan fully before starting, honor its STOP
conditions, and update your row when done.

## Key live-security facts (from the 2026-07-17 Supabase verification)

- RLS **is enabled with delegation-scoped policies** on `cuenta`,
  `movimiento`, `delegacion`, `membresia`, `organizacion` — but those
  policies exist only in the live DB, not in `scripts/` (reproducibility
  gap, noted in plan 014's maintenance notes).
- ~~RLS disabled on `categoria` / `categoria_orden_delegacion`~~ — FIXED
  2026-07-18 (`scripts/050`): RLS enabled with a new delegation-scoped
  write policy for tesoreros; fully tested live.
- ~~The 3 dashboard aggregation RPCs anon-executable without membership
  check~~ — FIXED 2026-07-18 (`scripts/049`): membership guard + revoke
  anon, tested live with real tesorero/gestor/anon identities.
- Storage buckets `facturas` / `documentos` are **public and listable** —
  plan 002 (see its addendum; premise changed from "broken" to "exposed").
- Ops (dashboard-only): Postgres has pending security patches;
  leaked-password protection off; `pg_net` in `public` schema.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| [014](014-lock-down-aggregation-rpcs-and-categoria-rls.md) | Lock down anon-callable aggregation RPCs; enable RLS on categoria tables | P1 | S | — | DONE (2026-07-18). Parte 1: RPCs con guard de membresía + revoke anon, verificado en vivo (`scripts/049`). Parte 2: RLS ACTIVADO en categoria y categoria_orden_delegacion tras añadir la política que faltaba para tesoreros (locales de su delegación); batería completa de pruebas simulando tesorero/gestor/anon en verde (`scripts/050`). Rollback documentado en el propio script. |
| [002](002-fix-broken-invoice-file-access.md) | Signed URLs for invoice/document files (+ operator bucket flip — see 2026-07-18 addendum) | P1 | M | — | DONE (2026-08-05, código); pendiente flip de buckets `facturas`/`documentos` a privado + políticas RLS de `storage.objects` por el operador |
| [001](001-protect-admin-and-diagnostic-endpoints.md) | Protect admin API routes, diagnostic endpoint, middleware coverage | P1 | M | — | DONE (2026-08-05). `requireAdmin()` guarda `/api/admin/users(/[id])` y `/api/supabase-sanity`; middleware añade `/configuracion` y `/propuestas` (no se añadieron rutas `/api/*` al middleware: no distingue páginas de API, ver nota en el código). `app/diagnostico` no existe, no se tocó. Verificado con curl (401 en API, 307 en páginas); no se pudo probar el positive-path (login real `gestor_central`) por falta de credenciales Supabase en este entorno. |
| [016](016-restore-green-typecheck-baseline.md) | Green `tsc --noEmit` baseline + `typecheck` script | P1 | S/M | — | DONE (2026-08-05). Inventario ya había bajado de 56 a 2 errores desde que se escribió el plan. Fix 1: `category-quick-create-sheet.tsx` enviaba un campo `activa` heredado que `scripts/046` ya eliminó de la tabla `categoria` (drop legacy). Fix 2: `transaction-list.tsx` pasaba `onRequestCreateCategory` a `TransactionListRow`, que nunca la declaró ni la usó (prop muerta; sigue viva en `TransactionDetail`, que sí la usa). Añadido `"typecheck": "tsc --noEmit"` a `package.json`. `pnpm typecheck`/`pnpm test`/`pnpm build` (con env vars) en verde. `pnpm lint` tiene 4 errores preexistentes de `react-hooks/set-state-in-effect` en archivos no tocados por este plan (fuera de alcance; no se tocan aquí). |
| [015](015-test-baseline-vitest-characterization.md) | Characterization tests: EB dedupe/money mapping, category sort | P1 | S | — | DONE (2026-08-05). `lib/enable-banking/dedup.test.ts` (19 tests) y `hooks/use-categorias.sort.test.ts` (5 tests) añadidos; `sortCategorias` ahora exportada. `vitest.config.ts` gana `test.env` con URL/anon-key dummy porque importar `hooks/use-categorias.ts` construye el cliente Supabase a nivel de módulo y fallaba sin env vars (este sandbox no tiene `.env.local`); no afecta producción. `pnpm test`: 65/65 verdes (37 baseline + 28 nuevos). `pnpm lint`/`tsc` sin nuevos errores (los 4 de `react-hooks/set-state-in-effect` son preexistentes, fuera de alcance). |
| [010](010-pin-latest-dependencies.md) | Pin 27 `"latest"` deps; REMOVE npm `path`/`url` (see addendum) | P1 | S | — | DONE (2026-08-05). Los 27 `"latest"` pineados a su versión ya resuelta (`pnpm ls`); `path`/`url` (npm packages que sombreaban builtins de Node) eliminados de `package.json`. `next`/`xlsx` sin tocar (ya estaban fijados). `tsc`/`test`/`build` en verde; lockfile diff solo quita las entradas de `path`/`url`. `pnpm audit --prod`: 47 avisos (23 high). La mayoría de los high trazan a `next` (fuera de alcance, lo cubre plan 019) y a transitivos (`minimatch`, `picomatch`, `ws`, `brace-expansion`, `sharp`, `postcss`) que pinear directos no mueve — quedan para una futura pasada de upgrades deliberados. |
| [019](019-ci-lockfile-env-example-and-nextjs-bump.md) | CI pipeline, husky wiring, `.env.example`, README env, Next ≥16.2.5 | P2 | M | 016 (typecheck gate; soft) | TODO |
| [017](017-movimientos-cache-and-fetch-correctness.md) | Fix cache 1000-row truncation, dropped-fetch race, filter-blind mutations | P2 | M/L | 015 | TODO |
| [018](018-extract-import-parsing-fix-dates-and-partial-failures.md) | Extract import parsing; fix TZ date shift + lost partial imports | P2 | M | 015 | TODO |
| [011](011-security-hardening-headers-and-config.md) | Headers, email validation, error-leak sanitization incl. bank-sync sinks (see addendum) | P2 | M | 016; after 001 (same files) | TODO |
| [005](005-enable-banking-setup-and-diagnostics.md) | Enable Banking setup verification + doc fixes | P2 | M | — | TODO |
| [007](007-fix-silent-sync-truncation.md) | Fix silent EB pagination truncation | P2 | S | — | TODO |
| [008](008-fix-category-order-race-and-dedupe-service-layer.md) | Category-order race; service-layer dedupe; dead hook | P2 | M | — | TODO |
| [009](009-activity-balance-rpc-and-cache-eviction.md) | Balance dashboard aggregation server-side + cache eviction | P2 | M | — | TODO (re-verify: React Query adoption may change approach) |
| [012](012-ux-consistent-confirmations-and-error-feedback.md) | Consistent confirmations, visible file-action errors | P2 | S | — | TODO |
| [003](003-bulk-export-facturas.md) | Bulk export of invoice files | P2 | L | 002 | TODO — **maintainer review first** (PR #159 facturas section may supersede parts) |
| [004](004-flag-synced-transactions-missing-invoice.md) | Flag synced transactions missing invoice | P2 | M | — | TODO — **maintainer review first** (same reason) |
| [020](020-design-spike-auto-categorization-and-contacto-matching.md) | DESIGN SPIKE: rules engine (`regla`) + contacto↔sync matching | P3 | M | — | TODO |
| [006](006-bank-sync-multi-account-picker.md) | Manual account picker on multi-account EB match | P3 | M | — | TODO |
| [013](013-ux-investigate-upload-affordance-and-contacto-selector.md) | Investigate upload affordance / contacto selector issues | P3 | M | — | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (reason) | REJECTED (rationale)

## Suggested execution order

1. **014 first** (live unauthenticated exposure, S effort), then **002**
   (code now, operator flips buckets after) and **001**.
2. **016 + 015** (cheap gates that everything else verifies against),
   **010** in parallel.
3. **019** (CI locks the gates in), then **017, 018, 011**.
4. Remaining 0bc851b-era plans (005, 007, 008, 009, 012) — each executor
   must treat the fired drift check as "re-locate by content", and 009
   should be re-validated against the React Query migration now underway.
5. **003/004 only after maintainer review** vs. the shipped facturas
   section; **020, 006, 013** last.

## Dependency notes

- 017 and 018 hard-require 015 (characterization safety net).
- 011 wants 016 first (removes the `ignoreBuildErrors` STOP) and 001
  first (same files, merge-conflict avoidance only).
- 019's CI typecheck step needs 016; wire CI without it if 016 lags.
- 003 requires 002 (working authorized file-access path).

## Findings considered and rejected / deferred (2026-07-18 pass)

- **Dashboard focus-revalidation storm + duplicate summary RPC calls**
  (verified: ~12 uncached queries per window focus; `useFinancialSummary`
  mounted twice) — real but deferred: the in-flight React Query migration
  (`contexts/query-provider.tsx`, `use-cuentas` et al. already migrated)
  is the correct fix vehicle; hand-rolling a dedupe cache now would be
  discarded. Fold into the migration when movimientos/summary hooks move.
- **Transaction table unvirtualized, unbounded row accumulation** — MED
  confidence; revisit if users report sluggishness on large delegations.
- **Movimiento list over-fetch (embedded relations per row, `count:
  "exact"` per page)** — defer with the same React Query/migration logic.
- **EB `credit_debit_indicator` missing → treated as credit; unparseable
  amount → 0** — LOW confidence, needs real ASPSP payload evidence; plan
  015 characterizes both so any change is deliberate.
- **`creado_por: ""` on imports when session expired; sentinel UUID for
  cron** — investigate when touching the import panel (plan 018 area).
- **`SECURITY-AUDIT.md` is stale in both directions** — plan 014's
  maintenance note adds a pointer; full regeneration not planned.
- **`docs/SUMMARY.md` omits Enable Banking / contactos / propuestas /
  facturas chapters** — S-effort docs task; fold into the next docs pass.
- **Console-log cleanup (145+ sites)** — still deferred (as in the first
  audit); plan 018 Step 4 surfaces the import-panel summaries as UI.
- **Rate limiting; CSP** — still deferred (maintainer infra decisions).
- **Direction not selected for planning**: org-level consolidated
  dashboard for `gestor_central` (schema + RPCs make it cheap; access
  design is the open question); proposal-board status notifications via
  Resend (email plumbing exists). Both grounded — revisit next pass.
- **Backfill live RLS policies into `scripts/`** — recommended in plan
  014's maintenance notes; not separately planned.

## How this index was assembled

1. 2026-07-16 audit (plans 001–013) — see git history of this file for
   its full provenance notes.
2. 2026-07-17/18 re-audit: four parallel read-only agents (correctness+
   tech-debt, security+deps, performance+tests, DX+docs+direction), plus
   direct `tsc`/`pnpm audit` runs, plus live Supabase checks (security
   advisors, `pg_tables.rowsecurity`, `pg_policies`, `pg_proc` function
   sources). Every planned finding was re-verified by reading the cited
   file or querying the live DB; plans 014–020 re-verified again at
   `d759ec9` after the 18-PR drift landed mid-session.
3. Not audited in this pass: the new facturas/informes/memoria-economica
   code merged in `0bc851b..d759ec9` (shipped after the audit sweep —
   **this is now the largest unaudited surface and the top candidate for
   the next `improve branch` run**), mobile testing, the propuestas
   Kanban, Excel-import edge cases beyond the date/partial-failure bugs.
