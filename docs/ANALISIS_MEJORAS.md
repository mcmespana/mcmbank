# Análisis de mejoras de la aplicación

> **Lista única de trabajo pendiente.** Análisis completo realizado el 12/06/2026
> sobre seguridad, rendimiento, bugs funcionales, interfaz y nuevas funcionalidades.
> **Revisado y verificado contra código + BBDD en vivo el 06/08/2026** — varios
> puntos que seguían como pendientes ya estaban resueltos; se han marcado `[x]`
> y se han añadido los hallazgos nuevos de esa revisión (bugs de backend y una
> pasada completa de UI/UX en móvil). Marca con `[x]` las mejoras que se vayan
> completando.
>
> Consolida y sustituye a los antiguos `OPTIMIZACIONES_PENDIENTES.md`,
> `FUTURE_DEVELOPMENTS.md` y `plan.md`. El registro de lo ya hecho vive en
> `OPTIMIZACIONES_REALIZADAS.md`.

## Ya completado (no volver a abrir)

Optimizaciones que figuraban como pendientes en docs antiguos pero **ya están en `main`** (verificadas en código y BBDD el 15/06/2026):

- ✅ Lazy loading de archivos: sin JOIN a `movimiento_archivo` en `use-movimientos.ts` / `movimientos-cache-context.tsx`; carga bajo demanda con `use-movimiento-archivos.ts`.
- ✅ Retry de `runQuery` valida `abort` antes y después de `refreshSession` (`lib/db/query.ts`).
- ✅ Debounce de filtros de categorías en el dashboard (`useDebouncedCategoryFilter`).
- ✅ Agregados del dashboard vía RPC: `get_financial_summary`, `get_category_breakdown`, `get_monthly_trend` (`scripts/037_aggregation_functions.sql`).
- ✅ Skeletons de carga, `error.tsx` y `global-error.tsx` por ruta.
- ✅ Editor de fechas reutilizable `DateField`; piloto de TanStack Query en `useCategoryBreakdown`; tests de utilidades con Vitest.

---

## 🔐 A. Seguridad

### Críticas (arreglar ya)

- [x] **1. API de admin sin autenticación (GET)** — resuelto: `requireAdmin()` guarda GET/POST/PUT/DELETE en `app/api/admin/users/route.ts` y `[id]/route.ts` (`lib/auth/require-admin.ts`).
- [x] **2. API de admin sin autenticación (POST/PUT/DELETE)** — mismo fix que el punto 1.
- [x] **3. Endpoint de diagnóstico público** — resuelto: `app/api/supabase-sanity/route.ts` exige `requireAdmin()`. (La ruta de página `app/supabase-sanity/` ya no existe.)
- [ ] **4. Rutas sin proteger en el middleware** — `lib/supabase/middleware.ts`: `protectedRoutes` ya cubre `/configuracion`, `/propuestas`, `/contactos`, `/pagos-mcm`, `/facturas`, `/transacciones`, `/categorias`, `/cuentas`, `/delegaciones`, `/movimientos`. Sigue faltando el dashboard `/`. *Fix: añadirlo a la lista blanca o documentar por qué se deja fuera a propósito.*

### Altas

- [x] **5. Ficheros adjuntos con URL pública (IDOR)** — resuelto: `lib/services/file-service.ts` ya usa `createSignedUrl` (vía `app/api/files/signed-url/route.ts`, 300s), no `getPublicUrl`.
- [ ] **6. Validación de ficheros permisiva** — pendiente de reverificar en detalle: revisar lista blanca de extensiones y límite de tamaño en `file-service.ts`.
- [x] **7. Funciones RPC `SECURITY DEFINER` sin comprobar pertenencia** — resuelto: `scripts/049_secure_aggregation_rpcs.sql` añade `assert_delegacion_member()` a las 3 RPCs de agregación + `REVOKE EXECUTE FROM anon`. Aplicado en producción el 2026-07-18.
- [ ] **8. Dependencia `xlsx` desde CDN y desactualizada** — sigue así: `package.json` instala `xlsx` desde `https://cdn.sheetjs.com/...`, versión 0.20.3. *Fix: mover a npm/registro propio y actualizar.*
- [x] **9. Cabeceras de seguridad** — sin cambios, sigue hecho.

### Medias / bajas

- [x] **10. Validación del redirect `next` en el callback OAuth** — sin cambios, sigue hecho.
- [ ] **11. Roles solo comprobados en cliente** — sigue pendiente.
- [x] **12. Credenciales demo en el repo** — **[06/08/2026] Retiradas del working tree**: `README.md`, `CLAUDE.md`, `SECURITY-AUDIT.md` y `plans/001-*.md`/`plans/021-*.md` ya no mencionan la contraseña del usuario demo. **Sigue pendiente, y es tarea del mantenedor**: la contraseña **sigue en el historial de git** (commit `a7e2c6f` revirtió un intento previo de limpieza) y la cuenta `admin@movimientoconsolacion.com` está viva en producción con rol `gestor_central` en **17 delegaciones** y `last_sign_in_at` reciente. *Fix: rotar la contraseña desde el dashboard de Supabase Auth cuanto antes — cuatro dígitos protegen las finanzas de 17 delegaciones en un repo con historial expuesto.*
- [ ] **NUEVO — 12b. Protección de contraseñas filtradas desactivada** — el advisor de seguridad de Supabase reporta `auth_leaked_password_protection` desactivado (no comprueba contra HaveIBeenPwned). *Fix: activarlo en Supabase Auth — settings → Password protection.*
- [ ] **NUEVO — 12c. Postgres con parches de seguridad pendientes** — advisor `vulnerable_postgres_version`: `supabase-postgres-17.4.1.074` tiene actualizaciones de seguridad disponibles. *Fix: programar el upgrade desde el dashboard de Supabase.*

---

## ⚡ B. Rendimiento

### Alto impacto

- [x] **13. Doble consulta de resumen financiero en el dashboard** — **[08/2026]** `financial-summary.tsx` sigue llamando a `useFinancialSummary` dos veces (periodo + histórico 1970→hoy para el saldo, son rangos genuinamente distintos, no se pueden fusionar en una llamada sin cambiar la RPC). Lo que se ha corregido es el hook en sí: migrado a TanStack Query (`hooks/use-financial-summary.ts`, mismo patrón que `useCuentas`/`useCategoryBreakdown`), con caché compartida entre instancias/páginas y `staleTime` de 30s — evita relanzar ambas queries en cada remount/cambio de pestaña dentro de ese margen.
- [x] **14. Patrón N+1 en `getCuentaConMasMovimientos`** — resuelto: ya usa la RPC `get_cuenta_con_mas_movimientos` (una sola llamada), no N queries.
- [ ] **15. `getContactosByDelegacion` sin paginación** — **[reverificado 15/08/2026, no accionado]** el modelo cambió (proveedores globales + `contacto_delegacion`, ver `CLAUDE.md`), pero el volumen sigue sin justificarlo: 8 proveedores compartidos en total. `useContactos` sigue construyendo sus contadores por tipo client-side y haciendo mutaciones optimistas sobre el array completo — paginar rompería ambas cosas sin necesidad. Revisar cuando el volumen real lo justifique.
- [x] **16. Recargas de contadores en cada focus** — resuelto: `use-delegation-counts.ts` migrado a TanStack Query (antes: `useRevalidateOnFocusJitter` propio disparando las 6 queries en cada focus de pestaña sin importar si los datos seguían frescos).
- [x] **17. `useMonthlyTrendData` sin caché** — resuelto: migrado a TanStack Query, mismo patrón.
- [x] **18. Recharts y xlsx en el bundle inicial** — resuelto: `next/dynamic` (con `ssr:false`) en `MonthlyTrend`, `ActivityBalanceDashboard`, `CategoryAnalysisDashboard` (las 3 pestañas del dashboard que importan Recharts) y en `TransactionImportPanel` (importa `xlsx`, se abre desde un botón en `/transacciones`). Compilación verificada (`pnpm build`, `✓ Compiled successfully`); no había ningún uso de `next/dynamic` en el repo antes de esto.
- [x] **19. Re-renders en cascada desde `DelegationContext`** — resuelto: `setSelectedDelegation` ya es un `useCallback` con dependencias correctas (comprueba `delegationId === selectedDelegation` antes de actualizar).

### Medio impacto

- [x] **20. Búsquedas O(n×m) en la tabla de transacciones** — sin cambios, sigue hecho.
- [x] **21. `hasChanges` con `JSON.stringify` en cada render** — resuelto: `transaction-detail.tsx` comparaba `formData`/`baselineData` con `JSON.stringify` en cada tecleo (el `useMemo` ya evitaba recomputar si las referencias no cambiaban, pero `formData` cambia de referencia en cada tecla). Sustituido por comparación campo a campo de los 7 campos conocidos (mismos que construye `baselineData`), sin serializar.
- [x] **22. Falta `React.memo` en componentes pesados del dashboard** — resuelto: `React.memo` en `FinancialSummary`, `RecentTransactions`, `QuickActions`, `MonthlyTrend`, `ActivityBalanceDashboard` y `CategoryAnalysisDashboard` — todos reciben solo props primitivas (`from`/`to`/`resetToken`/`limit` o ninguna), así que la comparación superficial por defecto de `memo` es exacta sin necesitar estabilizar referencias en el padre.
- [x] **23. Fetches sin `AbortController`** — **[verificado 08/2026]** revisado every hook en `hooks/*.ts` que llama a Supabase/RPC: todos usan `abortSignal`, `runQuery` (que centraliza el abort) o `useQuery` de TanStack (que inyecta `signal` automáticamente) — no queda ningún hook haciendo queries sin mecanismo de cancelación. El hallazgo de mensajes de abort visibles al usuario (punto 38b) ya estaba corregido aparte.
- [x] **24. Sin virtualización en listas largas de transacciones** — **[08/2026]** resuelto con `@tanstack/react-virtual` (misma familia que TanStack Query, ya en el proyecto). Detalles de la implementación:
  - **Umbral**: se virtualiza a partir de **60 filas** (`VIRTUALIZATION_THRESHOLD` en `transaction-list.tsx`). Por debajo se sigue renderizando la lista completa: hay delegaciones con cuatro movimientos y otras con más de quinientas, y con pocas filas el ahorro es nulo mientras que el DOM completo conserva ventajas reales (Ctrl+F del navegador, impresión, lectores de pantalla). Verificado en navegador: 59 filas → 59 en el DOM; 60 filas → 18; 500 filas → 18.
  - **Alturas dinámicas**: la estimación inicial es 92px, pero cada fila visible se mide de verdad con `measureElement`, así que conceptos largos, chips de contacto que saltan de línea o la edición inline no descuadran el scroll.
  - **El scroll pasa a vivir dentro de `TransactionList`** (antes lo tenía el `div` contenedor de `transaction-manager.tsx`): el virtualizador tiene que ser dueño de su contenedor. La cabecera de «N transacciones encontradas» queda fuera del área de scroll, porque cualquier contenido en flujo por encima de las filas desplazaría todas las medidas.
  - **Selección, rangos con Shift y edición inline intactos**: `onSelectionChange` pasa a recibir el `movementId` (antes lo capturaba una lambda por fila, que anulaba el `React.memo`), `selectedMovementIds` se consulta con un `Set` (era `includes` por fila, O(n²)) y los handlers del manager se estabilizan con un ref-espejo para que `React.memo` de `TransactionListRow` funcione de verdad.
  - **Edición de concepto al desmontar**: una fila virtualizada puede desaparecer del DOM al salir del viewport sin disparar el `onBlur` del input. Se guarda igualmente en el cleanup, con la misma semántica que el blur.
  - **Carga de la siguiente página**: el `IntersectionObserver` ahora declara el contenedor de la lista como `root` y pide la página ~400px antes de tocar el fondo.
  - **Skeleton en vez de spinner** en la carga inicial (`transaction-list-skeleton.tsx`): placeholders con la forma real de la fila, mismo alto, sin salto de layout.
- [ ] **25. `images.unoptimized: true`** — sigue pendiente. *No accionado ahora*: activar la optimización de imágenes de Next tiene implicaciones de infraestructura (coste de la Image Optimization API de Vercel, dominios remotos permitidos) — decisión de producto/infra del mantenedor, no un cambio de código aislado.
- [x] **26. Sin Suspense/streaming** — **[08/2026]** resuelto. El diagnóstico de fondo no era «faltan `<Suspense>`»: era que **cada `page.tsx` montaba su propio `<AppLayout>`, y su `loading.tsx` montaba otro**. Con eso, los `loading.tsx` que ya existían no podían funcionar como streaming — sustituían la pantalla entera, incluida la chrome, en vez del contenido.
  - **Route group `app/(app)/`** con un `layout.tsx` que monta `<AppLayout>` una sola vez. Las 12 rutas autenticadas + `/` se han movido dentro; `/auth`, `/docs` y `/api` se quedan fuera. Las URLs no cambian (un route group no añade segmento) y el manifiesto de rutas del build es idéntico antes y después.
  - **Medido en navegador (Chromium)**: se marca el nodo DOM de la barra lateral y se navega por 9 secciones. Antes: el nodo se destruía en **todas** las navegaciones (la chrome entera se remontaba: sidebar, topbar y widget de avisos, con sus consultas). Después: el nodo **sobrevive a las 9**.
  - **`loading.tsx` por ruta, sin `AppLayout`**: ahora solo reemplazan a `{children}`, así que el skeleton aparece dentro del layout, que se queda quieto. Cada uno usa el skeleton que le toca (`DashboardSkeleton` para las cuatro rutas del panel, `TransactionsSkeleton` para `/transacciones`, `PageSkeleton` para las de lista) y se ha añadido el que faltaba, en `/informes`.
  - **`<Suspense>` alrededor de los cuatro componentes que leen `useSearchParams()`** (`TransactionManager`, `CategoryList`, `InformesPage`, `LoginForm`): sin barrera, ese hook arrastra a toda la ruta a renderizarse en cliente. `/transacciones` y `/categorias` dejan de ser páginas cliente y pasan a tener una parte servidor que puede enviarse en streaming.
  - **Skeletons revisados** (`components/ui/page-skeleton.tsx`): reproducen la forma real de cada pantalla (cabecera con barra de degradado, pestañas de filtro, filas; y en movimientos la columna de filtros + barra de acciones + lista de alto fijo) para que al llegar los datos no salte el layout. Sin padding propio: lo pone el `<main>` del layout.
  - **Contraste de `Skeleton` corregido**: usaba `bg-muted`, que en tema claro está a tres puntos de luminosidad del fondo (95% vs 98%) — sobre el degradado de la app los skeletons eran prácticamente invisibles. Ahora es un tinte de `muted-foreground`, visible en claro y oscuro, y respeta `prefers-reduced-motion`.

---

## 🐛 C. Bugs funcionales

- [x] **27-29, 34.** Sin cambios, siguen hechos (coma decimal, importe=0, timezone en `transaction-detail.tsx`, `not-found.tsx`).
- [ ] **30. Doble envío en formularios** — sigue pendiente.
- [x] **31. Doble importación posible** — resuelto: `transaction-import-panel.tsx` ya tiene guard `isImporting` que deshabilita el botón durante la importación.
- [ ] **32. Saldo de cuentas desactualizado** — parcialmente distinto del descrito originalmente; ver **hallazgo nuevo 32b**, que es la versión real y más grave de este bug.
- [ ] **NUEVO — 32b. [CRÍTICO, corregido 06/08/2026] Saldo de cuentas truncado por encima de ~1000 movimientos** — `components/cuentas/cuentas-manager.tsx` calculaba el saldo con una query por cuenta (`select importe from movimiento where cuenta_id=...`) sumada en cliente, **sin paginar**. PostgREST corta la respuesta a `db-max-rows` (1000 filas por defecto en Supabase): al superarlo, la suma se calculaba sobre un subconjunto y el saldo salía **mal, sin ningún error visible**. En el momento de la revisión la cuenta mayor tenía 548 movimientos (por debajo del límite, pero las cuentas sincronizan del banco automáticamente y lo alcanzarán). *Corregido*: nueva RPC `get_saldos_por_cuenta` (`scripts/057_saldos_por_cuenta.sql`, aplicada en producción) que agrega con `SUM()` en Postgres — sin N+1 y sin límite de filas. Verificado contra cálculo directo en SQL y en la app (delegación con 548 movimientos, saldo `-31.219,22 €` idéntico por ambas vías).
- [ ] **33. Selección no se limpia al cambiar filtros** — sigue pendiente.
- [x] **34.** (ver arriba, agrupado con 27-29).
- [ ] **35-38.** Sin cambios, siguen pendientes.
- [ ] **NUEVO — 38b. [corregido 06/08/2026] Mensaje de error interno filtrado al usuario** — `lib/db/in-flight.ts` cancela peticiones en curso al recuperar el foco de la pestaña con `ac.abort(new Error("tab-focus-reset"))`; el `catch` general de `runQuery` (`lib/db/query.ts`) dejaba pasar ese texto interno tal cual, así que cualquier hook que lo usara podía mostrar *"Ha ocurrido un problema: tab-focus-reset"* al usuario solo por cambiar de pestaña del navegador mientras cargaba algo (reproducido en `/propuestas`). *Corregido*: el catch ahora normaliza a `"Request aborted"` cuando `ac.signal.aborted`, igual que ya hacían las otras dos rutas de abort del mismo fichero. *Pendiente de decisión de producto*: si aborts nunca deberían mostrarse como alerta roja al usuario (relacionado con el punto 38 de mensajes de error genéricos).
- [ ] **NUEVO — 38c. [15/08/2026] Borrar entidades vinculadas: o falla en críptico, o desvincula en silencio** — al arreglar el borrado de contactos (que daba un 409 sin explicar que venía de `pago_mcm`, `ON DELETE RESTRICT`, reproducido contra producción) apareció el mismo patrón en el resto de entidades con relaciones, en sus dos variantes:
  - **Falla sin explicar qué lo bloquea** (`RESTRICT`/`NO ACTION`): borrar una **categoría** con movimientos, una **categoría padre** con subcategorías, o una **cuenta** con movimientos. Las tres dan un error de Postgres crudo, sin decir cuántos registros lo usan ni ofrecer una alternativa. La cuenta es la más grave: puede llevar años de movimientos.
  - **Borra en silencio** (`ON DELETE SET NULL`): borrar una **factura** vinculada a movimientos les quita el vínculo sin avisar — el mismo fallo silencioso que tenía contactos antes del fix.
  *Fix sugerido*: el patrón ya construido en `components/contactos/delete-contacto-dialog.tsx` (contar usos antes de confirmar, listar con fecha/importe, ofrecer desvincular en vez de borrar) se reutiliza casi tal cual en los cuatro casos. No accionado a petición del usuario — queda para otra sesión.

---

## 🎨 D. Interfaz y bugs visuales

- [x] **39-49.** Sin cambios, siguen hechos (verificados el 15/06).

### Hallazgos nuevos de la revisión de móvil (06/08/2026)

Pasada completa por Dashboard (3 pestañas), Cuentas, Categorías, Transacciones, Facturas, Pagos MCM, Contactos, Configuración, Informes, Propuestas y el widget de Avisos, en viewport 375×812. Todo lo listado aquí está **corregido**, salvo que se indique lo contrario:

- [x] **50n. Pestañas del dashboard descentradas** — `components/ui/tabs.tsx`: la pestaña activa tenía `border` y las inactivas no, así que medía 2px más y la píldora activa quedaba con 7px arriba / 3px abajo en vez de centrada. *Fix*: `border-transparent` en la base + `min-h-12` (no `h-12`) en el carril.
- [x] **51n. Etiquetas de las pestañas del dashboard invisibles en móvil** — `dashboard-home.tsx` usaba `hidden sm:inline` en los `<span>` de "Resumen"/"Balance"/"Análisis", dejando las pestañas sin nombre accesible en móvil (un `span` con `display:none` no llega al árbol de accesibilidad) y contradiciendo la convención del propio `CLAUDE.md` ("No hidden or truncated navigation labels on mobile"). *Fix*: etiquetas siempre visibles, con `px-2` en móvil para que quepan las tres.
- [x] **52n. Importes del resumen financiero truncados en móvil** — `components/dashboard/financial-summary.tsx`: con icono+texto en fila, el número solo tenía ~88px y `-31.219,22 €` necesitaba 129px → se veía `-31.21...`. *Fix*: icono encima del texto en móvil (`flex-col` → `sm:flex-row`), sin `truncate`.
- [x] **53n. Nombre de la delegación cortado a ~15px de ancho en el topbar móvil** — `components/topbar.tsx`: el spacer usaba `flex-1` en todos los breakpoints, dejando solo 56px al nombre de la delegación en móvil ("-T MCM Nueva Yorki" → "-T M..."). *Fix*: el selector de delegación pasa a `flex-1` en móvil (el spacer se oculta ahí); además se movieron **tema, manual y logout al menú lateral** (ver 54n), liberando aún más sitio — el nombre completo ya se lee sin cortes.
- [x] **54n. Tema, Manual y Logout ocupaban ~130px del topbar en móvil sin necesidad** — a petición del usuario, se han movido al pie del menú lateral (`components/sidebar.tsx`, solo en la variante `Sheet` móvil vía prop `accountFooter`) y se han ocultado en el topbar por debajo de `sm`. En desktop no cambia nada.
- [x] **55n. Página `/cuentas` con scroll horizontal en TODO el móvil** — dos causas combinadas en `components/cuentas/cuentas-manager.tsx`: (a) el `<h3>` del nombre de cuenta tenía `truncate` pero no `min-w-0`, así que como flex-item nunca se encogía por debajo de su contenido (p. ej. "Pruebas EnableBanking con cuenta AJ Central xd"); (b) la lista de tarjetas usaba `<div className="grid gap-4">` sin `grid-cols-1`, y sin columnas explícitas el track implícito de CSS Grid usa `min-width:auto`, así que **todas** las tarjetas —incluso las de nombre corto— se ensanchaban al ancho de la más larga, forzando `innerWidth` a 627px en un viewport de 375px. *Fix*: `min-w-0` en el `h3` y `Card`, `grid-cols-1` (que usa `minmax(0,1fr)`) en el contenedor.
- [x] **56n. Tabla "Últimas transacciones" del dashboard: columna Importe fuera de pantalla** — `components/dashboard/activity-balance.tsx`: "Fecha" (`w-[90px]`) + "Concepto" (`max-w-[320px]`, más ancho que el propio contenedor en móvil) dejaban "Importe" desplazado fuera de la vista, sin ninguna pista de que la mini-tabla se podía desplazar. *Fix*: fecha sin año en móvil (`dd MMM`), `max-w-[110px]` en Concepto por debajo de `sm`.
- [x] **57n. Tabla "Detalle por categoría" (Análisis): columna Categoría se pierde al desplazar** — `components/dashboard/category-analysis.tsx`: la tabla tiene 4 columnas visibles en móvil (Categoría/Ingresos/Gastos/Balance) y necesita scroll horizontal; al desplazar para ver Gastos/Balance se perdía de vista a qué categoría correspondía cada fila. *Fix*: columna Categoría con `sticky left-0` (cabecera, filas normales, filas de grupo y fila de Total) con fondo sólido — cuidado con no usar opacidad (`bg-card/95` dejaba ver los números de Ingresos superpuestos al desplazar; con `bg-card` sólido no pasa).
- [x] **58n. Botón "Generar informe" fuera de pantalla en `/informes`** — `components/informes/informes-page.tsx`: "Subir informe" + "Generar informe" en una fila `flex` sin envolver sumaban más ancho que el viewport. *Fix*: `grid grid-cols-2 gap-2 sm:flex` + `w-full sm:w-auto` en ambos botones.
- [x] **59n. Tabla de Delegaciones en `/configuracion`: columna UUID innecesaria en móvil** — mostraba un UUID completo de 36 caracteres en una tabla ya apretada. *Fix*: `hidden md:table-cell` en cabecera y celda (mismo patrón que "Categoría" en otras tablas del proyecto). También se acotó con `truncate`+`title` el email y la lista de delegaciones de la tabla de Usuarios, ocultando esta última en móvil.
- [ ] **60n. [menor, no corregido] Fila "Editar" parcialmente cortada al entrar en la tabla de Delegaciones/Usuarios de `/configuracion`** — el scroll interno de la tabla funciona (no hay overflow de página), pero el botón "Editar" queda parcialmente fuera de la vista inicial sin pista visual de que hay que desplazar. Página de uso exclusivo de `gestor_central`, impacto bajo. *Fix sugerido*: sticky en la columna de acciones, o botones de icono en vez de texto en móvil.
- [ ] **61n. [observación, no corregido] Panel "Avisos y tareas" flota sobre el contenido en móvil en vez de ocupar pantalla completa** — funciona y no desborda, pero su posicionado (anclado al botón flotante) puede sentirse menos natural que un bottom-sheet a pantalla completa en móvil. Prioridad baja, es una mejora de pulido, no un bug.

---

## 🚀 E. Nuevas funcionalidades

### De alto valor (controles financieros — es lo que más le falta a la app)

- [ ] **50. Presupuestos por categoría con alertas** — tabla `categoria_presupuesto`, widget en dashboard con semáforo (ok/aviso/excedido) y página `/presupuestos`. Es la pieza clave para una organización que gestiona dinero real.
- [ ] **51. Movimientos recurrentes** — definir gastos fijos (alquiler, suministros) y avisar cuando un mes no aparece el cargo esperado; widget "próximos gastos recurrentes".
- [ ] **52. Asistente de conciliación bancaria** — comparar extracto sincronizado (Enable Banking ya funciona) contra movimientos registrados: no-coincidentes en ambos lados, sugerencias de emparejamiento difuso, página `/reconciliacion`.
- [ ] **53. Detección y vinculación de transferencias internas** — al transferir entre cuentas propias, vincular los dos movimientos para no inflar ingresos/gastos en los informes.
- [ ] **54. Registro de auditoría** — triggers en `movimiento`/`cuenta`/`categoria` hacia tabla `audit_log` + página `/auditoria` (quién cambió qué y cuándo). Importante para una organización con tesoreros.
- [ ] **55. Informe PDF anual/por periodo** — portada, resumen, desglose mensual y por categorías; exportable desde el dashboard. Hoy solo hay Excel.

### De valor medio

- [x] **56.** Sin cambios, sigue hecho (falso positivo del análisis original).
- [ ] **57-62.** Sin cambios, siguen pendientes.

### Pulido

- [ ] **63. Auto-categorización por reglas** — el esquema de reglas existe parcialmente en BD pero no tiene UI de gestión. **Nota de la revisión del 06/08**: la tabla `regla` tiene RLS activo **sin ninguna política** (deny-all, 0 filas hoy) — no es un bug de seguridad (fail-closed), pero es un prerrequisito bloqueante antes de construir la UI: hay que decidir y crear las políticas de acceso (¿quién puede crear/editar reglas de su delegación?) antes de que cualquier pantalla nueva pueda leer o escribir en esa tabla.
- [ ] **64-65.** Sin cambios, siguen pendientes.

---

## 🧹 F. Mantenibilidad y deuda técnica

- [ ] **66-71.** Sin cambios, siguen pendientes.
- [ ] **NUEVO — 72. Comparación de la API key externa no es timing-safe** — **[corregido 06/08/2026]** `lib/api/external-auth.ts` comparaba la clave de la API externa con `!==` (tiempo variable, filtra por temporización cuántos caracteres iniciales coinciden). *Fix aplicado*: `timingSafeEqual` de `node:crypto` (con comprobación de longitud aparte, ya que `timingSafeEqual` exige buffers del mismo tamaño). Impacto era bajo (clave larga, superficie pequeña) pero el fix es gratis.
- [ ] **NUEVO — 73. `MCM_API_KEY` puede no estar configurada y caer al `CRON_SECRET` del cron bancario** — `lib/api/external-auth.ts` reutiliza `CRON_SECRET` como clave de la API externa (`/api/v1/movimientos/...`) si `MCM_API_KEY` no está definida. Si en Vercel no está puesta `MCM_API_KEY`, la misma clave que vive en Google Apps Script (superficie de menor confianza) dispara también `POST /api/bank-sync/run` (sincroniza **todas** las cuentas de banco). *Fix*: confirmar que `MCM_API_KEY` está configurada en producción y es distinta de `CRON_SECRET`; si no, generarla y añadirla.
- [ ] **NUEVO — 74. `/api/v1/movimientos` usa `createAdminClient()` sin ámbito de delegación** — por diseño (documentado en el propio código: API para Google Apps Script, el ID de movimiento es único en toda la BBDD), pero implica que una sola clave filtrada expone las 17 delegaciones sin pasar por RLS. *A valorar*: claves por delegación/consumidor si el número de integraciones externas crece.

---

## Prioridades recomendadas

1. **Lote 0 (crítico, acción manual del mantenedor):** rotar la contraseña del usuario demo en Supabase Auth (punto 12) — las credenciales ya no están en el repo, pero siguen en el historial de git y la cuenta tiene rol `gestor_central` en 17 delegaciones.
2. **Lote 1 (seguridad, verificar y cerrar):** 4 (dashboard `/` sin proteger), 6 (validación de ficheros), 8 (xlsx desde CDN), 12b/12c (advisors de Supabase), 73 (API key del cron).
3. **Lote 2 (bugs de datos):** 32b (ya corregido, desplegar la migración `057` si no se ha hecho vía MCP) — verificar que no hay más agregados client-side sin paginar en el resto de la app.
4. **Lote 3 (rendimiento):** ✅ 13, 16-18, 21-23 hechos (08/2026); ✅ 24 (virtualización de movimientos) y 26 (Suspense/streaming) hechos (08/2026); 15 verificado y deprioritizado (sin volumen real). Queda **25** (`images.unoptimized`), que sigue siendo una decisión de infra del mantenedor (coste de la Image Optimization API de Vercel y dominios remotos permitidos), no un cambio de código aislado.
5. **Lote 4 (deuda técnica):** 66-71, 74.
6. **Lote 5 (pulido móvil pendiente):** 60n, 61n.
7. **Lote 6 (borrados en cascada, 38c):** categoría con movimientos, categoría padre con subcategorías, cuenta con movimientos (fallan en críptico), factura vinculada a movimientos (desvincula en silencio). El patrón ya existe en `delete-contacto-dialog.tsx`.
