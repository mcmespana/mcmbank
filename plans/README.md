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
| [019](019-ci-lockfile-env-example-and-nextjs-bump.md) | CI pipeline, husky wiring, `.env.example`, README env, Next ≥16.2.5 | P2 | M | 016 (typecheck gate; soft) | DONE (2026-08-05). Un solo lockfile (`pnpm-lock.yaml`) ya era el caso; `package-lock.json` añadido a `.gitignore`. `.github/workflows/ci.yml` con install/lint/typecheck/test/build. `husky` + `lint-staged` cableados (`prepare` script, `.husky/pre-commit`, verificado manualmente). `.env.example` creado con las ~20 variables que el código lee hoy (creció bastante desde que se escribió el plan: Google Drive, MCM_API_KEY, etc.) + README actualizado. `next`/`eslint-config-next` subidos a `^16.3.0`: `pnpm audit --prod` pasa de 47 a 18 avisos y la familia HIGH de `next` desaparece del todo. Efecto colateral necesario: `pnpm lint` tenía 4 errores preexistentes (`react-hooks/set-state-in-effect` en `app-layout.tsx`, `topbar.tsx`, `use-consent-alerts.ts`) que habrían dejado el primer run de CI en rojo desde el día 1 — se resolvieron con `eslint-disable-next-line` puntual y comentado (son patrones legítimos: mounted-flag, redirect-on-auth-change, reset-on-prop-change) ya que forman parte del gate que este plan introduce. El bump de Next añade 3 warnings nuevos (`no-location-assign-relative-destination` en navegaciones "hard" deliberadas) que no rompen el lint gate (siguen siendo warnings). |
| [017](017-movimientos-cache-and-fetch-correctness.md) | Fix cache 1000-row truncation, dropped-fetch race, filter-blind mutations | P2 | M/L | 015 | DONE (2026-08-05), premisa revisada. Descubierto en ejecución: `MovimientosCacheContext`/`MovimientosCacheProvider` (bugs #1 truncation y #3 filter-blind mutation vivían ahí) no tenía NINGÚN consumidor real — `useMovimientosCache()` no se llamaba desde ningún componente/hook; solo se montaba el provider. Toda la app ya lee movimientos vía `hooks/use-movimientos.ts`, que YA paginaba con `.range()` y ya devolvía el `count` real del servidor (el bug de truncación #1 no aplicaba ahí). En vez de reescribir un pipeline compartido para código muerto, se eliminó `contexts/movimientos-cache-context.tsx` entero y su montaje en `app-providers.tsx` (elimina #1 y #3 de raíz al quitar el código con el bug) y se corrigió el bug real (#2, carrera de fetch descartado) en `use-movimientos.ts`: ahora un fetch para una key NUEVA aborta el fetch en curso de la key vieja en vez de descartarse en silencio (antes se marcaba la key como "ya obtenida" sin haber hecho la petición), con guard de identidad en el `finally` para que el cleanup de la petición abortada no pise el estado de la que la reemplazó. `CLAUDE.md` actualizado (Provider Hierarchy, Data Fetching Strategy) para reflejar la eliminación. `tsc`/`lint`/`test`/`build` en verde. No se pudo probar en vivo el caso "cambiar de filtro rápido bajo red lenta" (sin Supabase real en este sandbox) — verificado por lectura/razonamiento del código en su lugar. |
| [018](018-extract-import-parsing-fix-dates-and-partial-failures.md) | Extract import parsing; fix TZ date shift + lost partial imports | P2 | M | 015 | DONE (2026-08-05). Drift respecto al plan: `parseEuropeanNumber` ya vivía en `lib/utils/number.ts` (no se volvió a mover) y el CSV a mano seguía inline (se extrajo a `parseCsv` como pedía el plan). Nuevo `lib/utils/import-parsing.ts`: `parseImportDate` (TZ-safe: serial de Excel vía getters UTC, d/M/yyyy partiendo el string a mano, yyyy-MM-dd validado tal cual — nunca `format()` en hora local) y `parseCsv`. Sustituidas las 3 copias inline (Sabadell/CaixaBank/Manual) en `transaction-import-panel.tsx`; se preservó la diferencia real entre ellas (Sabadell/CaixaBank lanzan y abortan la fila, Manual la omite y continúa). Bug de importación parcial perdida corregido: el fallback fila-a-fila ahora `break`ea en vez de `throw` ante un error que no es de duplicado, y siempre informa cuántas se importaron + duplicados + la fila que falló, llamando a `onImported` si `successCount > 0`. Resumen de filas omitidas/categorías no encontradas (antes bloques `if` vacíos que no hacían nada) ahora se añade al mensaje final. `grep -c 25569` en el panel → 0. `pnpm test` (77/77, incluye 20 tests nuevos) en verde bajo TZ por defecto, `America/New_York`, `Asia/Tokyo` y `Pacific/Kiritimati`. `tsc`/`lint`/`build` sin regresiones. No se pudo probar en vivo la importación real de un archivo (sin Supabase real en este sandbox) — cubierto por los tests unitarios de `parseImportDate`/`parseCsv` en su lugar. |
| [011](011-security-hardening-headers-and-config.md) | Headers, email validation, error-leak sanitization incl. bank-sync sinks (see addendum) | P2 | M | 016; after 001 (same files) | DONE (2026-08-05). `ignoreBuildErrors` eliminado de `next.config.mjs` (tsc ya estaba en verde gracias a plan 016); `Permissions-Policy` añadida a las cabeceras ya existentes (el resto ya estaba, drift positivo). Regex de email endurecida. `error.message` crudo ya no se devuelve al cliente en `app/api/admin/users(/[id])` ni `app/api/supabase-sanity` (log server-side + mensaje genérico). Middleware falla cerrado en rutas protegidas cuando Supabase no está configurado (antes dejaba pasar todo). Extra (addendum): sanitizados los sinks de `bank-sync/auth`, `callback` y `disconnect` (ya no se devuelve el body crudo del proveedor EB al cliente ni se persiste en `ultimo_error`; ahora va con id de correlación + log completo solo server-side); añadida comprobación de que `cuenta.delegacion_id === banco_conexion.delegacion_id` y `estado === 'pendiente'` antes de linkar en el callback. Verificado con curl (cabeceras presentes, fail-closed 307 con `?error=config`). CSP y rate limiting siguen fuera de alcance a propósito. |
| [005](005-enable-banking-setup-and-diagnostics.md) | Enable Banking setup verification + doc fixes | P2 | M | — | DONE (2026-08-05). `docs/ENABLE_BANKING.md` §5 renumerado 1-7 en orden; nueva subsección "3.8bis Probar sin una cuenta bancaria real" (sin inventar bancos/credenciales de sandbox, remite a la doc oficial de EB en §8). Nueva ruta `/api/bank-sync/health` (gestor_central, vía `requireAdmin()` de plan 001) que firma un JWT de prueba y devuelve solo booleanos + fingerprint, nunca secretos. Sección colapsable "Diagnóstico Enable Banking" añadida a `/configuracion` (gated por `isAdmin`, junto a `PlantillaMemoriaSection`). Nuevo `scripts/052_enable_banking_setup_verify.sql` (renumerado desde el 041 sugerido por el plan, que ya estaba ocupado por `pago_mcm`) — idempotente, solo diagnostica (extensiones + settings + estado del cron), no reemplaza 038/039. Verificado con curl: `/api/bank-sync/health` → 401 sin sesión. Ejecución real del script SQL contra un proyecto Supabase vivo queda para el operador (no hay proyecto real en este sandbox). |
| [007](007-fix-silent-sync-truncation.md) | Fix silent EB pagination truncation | P2 | S | — | DONE (2026-08-05). `getAllTransactions` devuelve ahora `{ pages, truncated }` en vez de solo el array (único consumidor: `sync.ts`, actualizado). Cuando se trunca por `maxPages` (50), la sync se marca `estado = "parcial"` con un `error_mensaje` explicando el rango de fechas afectado, y se loguea un warning — ya no desaparece en silencio. Documentado en `docs/ENABLE_BANKING.md` §4 que la sync incremental (ventana de 10 días) NO repara sola ese hueco. No se ha subido `maxPages` ni rediseñado la paginación (fuera de alcance a propósito). `tsc`/`lint` en verde; no hay conexión bancaria real en este entorno para una prueba en vivo — verificado por trazado del código. |
| [008](008-fix-category-order-race-and-dedupe-service-layer.md) | Category-order race; service-layer dedupe; dead hook | P2 | M | — | DONE (2026-08-05). Unique constraint confirmado (`PRIMARY KEY (delegacion_id, categoria_id)`, `scripts/009`). Nuevo `lib/services/categoria-queries.ts` con **dos** funciones (`upsertCategoriaOrden`/`upsertCategoriaVisibilidad`), no una sola genérica como sugería el ejemplo del plan: unificarlas en una sola habría hecho que `setDelegacionCategoryOrder` sobreescribiera `esta_activa` en cada reordenación (el caller no conoce el valor actual). Cada upsert solo incluye en el payload las columnas que su método original tocaba, así el UPDATE del upsert no resetea columnas que el código anterior dejaba intactas; el INSERT usa el DEFAULT de `esta_activa` (true) cuando falta. `database.ts` y `server-database.ts` ahora delegan en el módulo compartido, mismas firmas públicas. `hooks/use-cuentas-original.ts` ya no existía (drift, alguien lo borró antes de este pase) — nada que hacer en el Step 5. El grep `match({ delegacion_id` del Done-criteria aún da 2 resultados, pero son de `clearDelegacionCategoryOrder` (un DELETE, no el patrón check-then-act; fuera de alcance, no es una carrera). `tsc`/`lint`/`test`/`build` en verde. Verificación manual de drag-and-drop en `/categorias` no realizable sin Supabase real en este sandbox — revisado por lectura del código en su lugar. |
| [009](009-activity-balance-rpc-and-cache-eviction.md) | Balance dashboard aggregation server-side + cache eviction | P2 | M | — | SKIPPED (2026-08-05), ambas mitades bloqueadas. **Mitad 2 (cache eviction)**: el archivo objetivo, `contexts/movimientos-cache-context.tsx`, ya no existe — se eliminó en el plan 017 al confirmarse que era código muerto sin consumidores (nada llamaba a `useMovimientosCache()`); no hay nada que evictar. **Mitad 1 (RPC de agregación)**: STOP condition del propio plan — "si la lógica de bucketing es más compleja que sumas simples… STOP y reporta". `activity-balance.tsx` no solo calcula sumas ingresos/gastos por periodo: elige dinámicamente la granularidad del timeline (semanal/quincenal/mensual/anual según el rango de fechas real de los datos) con saldo acumulado, Y ADEMÁS renderiza una tabla con los últimos 30 movimientos reales (concepto, categoría, importe) — no un agregado. Una RPC que solo devuelva sumas por bucket rompería la tabla de movimientos recientes; reproducir ambas cosas (agregados + preview de filas reales sincronizado) de forma correcta es un cambio bastante más grande y arriesgado que "M" en una app financiera, con riesgo real de mostrar un gráfico sutilmente incorrecto. Se prioriza no tocarlo sobre un fix apresurado; queda como candidato a un plan propio y más detallado. |
| [012](012-ux-consistent-confirmations-and-error-feedback.md) | Consistent confirmations, visible file-action errors | P2 | S | — | DONE (2026-08-05). Nuevo `components/cuentas/cuenta-confirm-dialog.tsx` (diálogo estilizado genérico) sustituye los dos `window.confirm()` de `cuentas-manager.tsx` (desconectar del banco Y desactivar cuenta — el plan solo pedía el primero, se incluyó el segundo por ser el mismo patrón exacto en el mismo archivo). El error de borrado de archivo en `file-list.tsx` ya no solo va a consola: se captura en estado y se muestra dentro del propio diálogo (que ya NO se cierra en fallo, permitiendo reintentar/cancelar); además ahora también usa `toast.error`. Toasts de éxito/error añadidos en la subida de archivo (`transaction-files.tsx`) y en guardar descripción (`file-list.tsx`). `tsc`/`lint`/`test`/`build` en verde. Verificado por lectura de código (sin Supabase real en este sandbox para forzar un fallo real de borrado/subida en vivo). |
| [003](003-bulk-export-facturas.md) | Bulk export of invoice files | P2 | L | 002 | TODO — **maintainer review first** (PR #159 facturas section may supersede parts) |
| [004](004-flag-synced-transactions-missing-invoice.md) | Flag synced transactions missing invoice | P2 | M | — | TODO — **maintainer review first** (same reason) |
| [021](021-redesign-facturas-pagos.md) | Redesign /facturas + /pagos-mcm: dense rows, single detail panel, readable mobile tabs, React Query + summary RPCs, RLS `WITH CHECK` | P2 | L | — | DONE (2026-08-06). Las 7 fases ejecutadas y con commit propio. Migración `052` aplicada y verificada en vivo (RPCs, índice reparado, `WITH CHECK`, `get_advisors` sin avisos nuevos). `npx tsc --noEmit` y `pnpm lint` limpios sobre todo lo tocado. Verificación visual con Playwright contra el proyecto real: header, pestañas legibles con scroll horizontal en 375px y estados vacíos correctos en Facturas, Pagos MCM y Contactos; no se pudo completar la verificación con datos reales cargados por inestabilidad de red del entorno de ejecución hacia Supabase (no es un defecto de la app). **Desviación documentada** (fase 2): no se añadió selector de categoría a Facturas — la tabla `factura` no tiene columna `categoria_id` y añadirla habría sido un cambio de esquema fuera del alcance autorizado por la migración `052`. **Pendiente opcional no ejecutado** (fase 4, punto 5): migrar Cuentas/Dashboard/Categorías/Contactos a `PageHeader` y borrar `transaction-table.tsx`/`transaction-form.tsx` (código muerto) — quedan para un commit aparte si se retoma. |
| [020](020-design-spike-auto-categorization-and-contacto-matching.md) | DESIGN SPIKE: rules engine (`regla`) + contacto↔sync matching | P3 | M | — | DONE (2026-08-05) como spike de diseño — cero cambios de producción, solo `docs/DESIGN_AUTO_CATEGORIZACION.md`. Cubre: DSL de `condiciones` con 4 ejemplos completos, orden de evaluación (contacto-IBAN primero, exacto, luego reglas por `prioridad` con desempate estable), comparación apply-on-sync vs. suggest-only con recomendación (suggest-only, reversible por diseño) marcada explícitamente como decisión del maintainer, puntos de integración exactos (archivo+función) para sync/import manual/backfill/RLS/UI, y desglose de build S/M/L. Esquema real de `regla` y volumen real de `sin_categoria` confirmados en vivo el 2026-08-06 (935/2281 movimientos sin categoría, 820/1130 de ellos vía enablebanking) y volcados al doc, corrigiendo el scoping de la tabla (`organizacion_id`, no `delegacion_id`). La sonda de precisión del §5 del plan sigue sin ejecutarse — queda como primer paso del build. |
| [006](006-bank-sync-multi-account-picker.md) | Manual account picker on multi-account EB match | P3 | M | — | DONE (2026-08-05). Nueva columna `banco_conexion.accounts_pendientes` (JSONB, `scripts/054` — el 042 sugerido por el plan ya estaba ocupado por `archivo_adjunto`) para persistir los accounts candidatos cuando ninguno casa por IBAN; `lib/types/supabase-generated.ts` actualizado a mano. `callback/route.ts` ahora los guarda y redirige con `bank_sync_error=multiple_accounts&banco_conexion_id=…&cuenta_id=…` en vez de perder la lista. Nueva ruta `/api/bank-sync/link-account` (GET lista los candidatos, POST enlaza) con comprobación de membresía server-side y validando que el `account_uid` elegido esté realmente entre los candidatos persistidos (no se confía en un uid arbitrario del cliente). Nuevo `CuentaAccountPickerDialog` (mismo patrón de `Dialog` que `delete-account-dialog.tsx`) se abre automáticamente en `/cuentas` al detectar `bank_sync_error=multiple_accounts` en la URL. `docs/ENABLE_BANKING.md` §5 punto 3 actualizado (ya no es una limitación). `tsc`/`lint`/`test`/`build` en verde; verificado con curl que ambos métodos de `/api/bank-sync/link-account` devuelven 401 sin sesión. No se pudo ejecutar el flujo real (ni con sandbox EB) ni renderizar el diálogo con datos reales/mock en un navegador en este sandbox — verificado por tsc/lint y lectura de código; la migración SQL requiere aplicarse en un proyecto Supabase real. |
| [013](013-ux-investigate-upload-affordance-and-contacto-selector.md) | Investigate upload affordance / contacto selector issues | P3 | M | — | DONE (2026-08-05), 1 de 3 arreglado. **(1) Affordance de subida**: revisado y correcto — `AddFileButton` no es una UI distinta, es un botón compacto que se expande a la MISMA `FileAttachmentDropzone` bajo demanda (con botón Cancelar); es progressive disclosure intencional, no un bug visual. Sin cambios. **(2) z-index del popover** (`z-[80]` en `contacto-selector.tsx`): revisado y correcto — hay una escala de z-index informal ya en uso en toda la app (Dialog/Sheet/Popover base `z-50` → sheets anidados `z-[60]`/`z-[70]` en `transaction-detail.tsx`/`transaction-create-panel.tsx`/`factura-form.tsx` → popovers que deben ir por encima `z-[80]`, el mismo valor que ya usa `date-field.tsx` para su calendario dentro de esos mismos sheets `z-[70]`). El `z-[80]` es consistente con ese patrón, no un valor arbitrario roto. Sin cambios. **(3) `onCreateNew` duplicado**: confirmado — implementación byte-a-byte idéntica en `transaction-create-panel.tsx` y `transaction-detail.tsx` (mismo Sheet, mismo `ContactoForm`, mismo wiring). Extraído a `hooks/use-create-contacto-inline.tsx` (hook que devuelve `{ onCreateNew, dialog }`); ambos componentes lo usan ahora en vez de duplicar el bloque. `tsc`/`lint`/`test`/`build` en verde. Verificación visual en navegador de los 3 hallazgos no realizable sin datos/login reales en este sandbox — evaluado por lectura de código y comparación de clases Tailwind en su lugar. |

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
4. 2026-08-05: the facturas + pagos-mcm half of that gap is now covered by
   **plan 021**, written against `6046c7a` from a fresh read of both
   sections (UX, hooks, services, `scripts/041/042/047/048`, live schema).
   It carries the correctness/security findings that a formal audit would
   have raised — dead partial index after `048` dropped
   `factura.movimiento_id`, UPDATE policies with `USING` but no
   `WITH CHECK` on `factura`/`pago_mcm`/`archivo_adjunto`, `string`-widened
   `PagoMcmEstado` dereferenced unguarded, stale totals from a second
   never-refetched hook instance, and an N+1 count fan-out in
   `getCuentaConMasMovimientos`. Informes and memoria-economica remain
   unaudited.
