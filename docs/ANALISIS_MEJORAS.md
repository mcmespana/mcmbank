# Análisis de mejoras de la aplicación

> **Lista única de trabajo pendiente.** Análisis completo realizado el 12/06/2026
> sobre seguridad, rendimiento, bugs funcionales, interfaz y nuevas funcionalidades.
> Marca con `[x]` las mejoras que se vayan completando.
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

- [ ] **1. API de admin sin autenticación (GET)** — `app/api/admin/users/route.ts:4`: lista todos los usuarios con emails y roles usando el cliente service-role, sin comprobar sesión ni rol. Cualquier persona puede descargar el directorio de usuarios. *Fix: verificar sesión + rol `gestor_central` server-side antes de operar.*
- [ ] **2. API de admin sin autenticación (POST/PUT/DELETE)** — `app/api/admin/users/route.ts:33` y `app/api/admin/users/[id]/route.ts`: cualquiera puede crear usuarios con rol admin, modificarlos o borrarlos sin autenticarse. Escalada de privilegios trivial.
- [ ] **3. Endpoint de diagnóstico público** — `app/supabase-sanity/route.ts`: expone estructura de tablas, contadores y muestras de datos sin autenticación. *Fix: exigir sesión o eliminarlo de producción.*
- [ ] **4. Rutas sin proteger en el middleware** — `lib/supabase/middleware.ts:57`: `/configuracion`, `/propuestas`, `/diagnostico` y el dashboard `/` no están en la lista de rutas protegidas. *Fix: pasar a lista blanca de rutas públicas (solo `/auth/*`).*

### Altas

- [ ] **5. Ficheros adjuntos con URL pública (IDOR)** — `lib/services/file-service.ts:103,143`: los adjuntos se sirven con `getPublicUrl`; con rutas predecibles (`código-delegación/año/mes/...`) son enumerables. *Fix: bucket privado + `createSignedUrl` con caducidad.*
- [ ] **6. Validación de ficheros permisiva** — `file-service.ts:94`: sanitización débil del nombre, sin lista blanca de extensiones ni límite de tamaño verificado. *Fix: whitelist de extensiones + límite de tamaño.*
- [ ] **7. Funciones RPC `SECURITY DEFINER` sin comprobar pertenencia** — `scripts/037_aggregation_functions.sql`: aceptan `p_delegacion_id` del cliente sin validar que `auth.uid()` sea miembro de esa delegación → posible lectura de resúmenes financieros de otras delegaciones. *Fix: añadir `EXISTS (SELECT 1 FROM membresia ...)` dentro de cada función.*
- [ ] **8. Dependencia `xlsx` desde CDN y desactualizada** — `package.json`: versión 0.20.3 instalada desde URL de CDN, con vulnerabilidades conocidas. *Fix: actualizar e instalar desde npm, sanear datos importados.*
- [ ] **9. Sin cabeceras de seguridad** — `next.config.mjs`: no hay CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS, `Referrer-Policy`. *Fix: añadir bloque `headers()`.*

### Medias / bajas

- [ ] **10. Validación del redirect `next` en el callback OAuth** — `app/auth/callback/route.ts:9`: el check `startsWith("/")` deja pasar URLs protocol-relative (`//evil.com`). *Fix: normalizar con `new URL()` y validar mismo origen.*
- [ ] **11. Roles solo comprobados en cliente** — `hooks/use-is-admin.ts` y `DatabaseService`: la autorización descansa al 100% en RLS + UI; operaciones sensibles no tienen verificación de pertenencia server-side. *Fix: revisar/endurecer políticas RLS y añadir checks en server actions.*
- [ ] **12. Credenciales demo en el repo** — README/CLAUDE.md documentan `admin@movimientoconsolacion.com` / `1234`. *Fix: rotar contraseña y sacarla del repositorio.*

---

## ⚡ B. Rendimiento

### Alto impacto

- [ ] **13. Doble consulta de resumen financiero en el dashboard** — `components/dashboard/financial-summary.tsx:17-21`: llama dos veces a `useFinancialSummary` (periodo + histórico desde 1970), sin caché compartida, y ambas se reejecutan en cada focus. *Fix: una sola RPC que devuelva ambos rangos, o caché interna por rango.*
- [ ] **14. Patrón N+1 en `getCuentaConMasMovimientos`** — `lib/services/database.ts:687`: hace 1 query por cada cuenta para contar movimientos (50 cuentas = 51 queries). *Fix: una sola query agregada o RPC.*
- [ ] **15. `getContactosByDelegacion` sin paginación** — `database.ts:233`: trae todos los contactos de la delegación sin `limit`. *Fix: paginación opcional.*
- [ ] **16. Recargas de contadores en cada focus** — `hooks/use-delegation-counts.ts`: 5 count-queries por delegación en cada cambio de pestaña, sin TTL. *Fix: caché TTL de 30s como en `useCuentas`.*
- [ ] **17. `useMonthlyTrendData` sin caché** — repite la agregación mensual completa en cada re-render/focus. *Fix: TTL como en `useCuentas`.*
- [ ] **18. Recharts y xlsx en el bundle inicial** — los gráficos del dashboard y la librería de Excel se cargan eagerly. *Fix: `next/dynamic` para los charts e `import()` dinámico de xlsx solo al exportar/importar.*
- [ ] **19. Re-renders en cascada desde `DelegationContext`** — `contexts/delegation-context.tsx:41`: `setSelectedDelegation` cambia de identidad en cada actualización, propagando renders a todos los consumidores. *Fix: limpiar dependencias del `useCallback` (functional update).*

### Medio impacto

- [ ] **20. Búsquedas O(n×m) en la tabla de transacciones** — `transaction-table.tsx:93`: `accounts.find()`/`categories.find()` dentro del map de cada fila. *Fix: mapas `byId` memoizados (el patrón ya existe en `transaction-list.tsx`).*
- [ ] **21. `hasChanges` con `JSON.stringify` en cada render** — `transaction-detail.tsx:93`. *Fix: comparación campo a campo memoizada.*
- [ ] **22. Falta `React.memo` en componentes pesados del dashboard** — `activity-balance.tsx` y similares se re-renderizan cuando cambian hermanos. *Fix: memoizar componentes de gráficos.*
- [ ] **23. Fetches sin `AbortController`** — `use-financial-summary.ts` y otros hooks: actualizan estado tras desmontar, con condiciones de carrera al cambiar filtros rápido. *Fix: señal de aborto + guard.*
- [ ] **24. Sin virtualización en listas largas de transacciones** — `TransactionTable` renderiza todas las filas en el DOM (lag con +500 movimientos). *Fix: `@tanstack/react-virtual` o similar.*
- [ ] **25. `images.unoptimized: true`** — `next.config.mjs`: sin compresión/WebP/resize. *Fix: activar optimización de imágenes.*
- [ ] **26. Sin Suspense/streaming** — todo es `"use client"` sin boundaries; las páginas esperan al hook más lento. *Fix: `loading.tsx` por ruta + Suspense en secciones del dashboard.*

---

## 🐛 C. Bugs funcionales

- [ ] **27. El importe no acepta coma decimal** — `transaction-form.tsx:143` y `amount-range-filter.tsx:97`: `parseFloat("270,41")` → `270` o `NaN→0`. Siendo app española es un bug grave de entrada de datos. *Fix: usar el `parseEuropeanNumber` que ya existe en el panel de importación.*
- [ ] **28. Sin validación de importe = 0** — `transaction-form.tsx:69`: se puede guardar una transacción con importe 0 (el fallback del parseFloat). *Fix: validar importe ≠ 0.*
- [ ] **29. Bug de zona horaria en fechas** — `transaction-detail.tsx:122`: parseo de `yyyy-MM-dd` con `new Date()` puede producir desfase de un día. *Fix: parsear siempre como fecha local (`parseISO` de date-fns).*
- [ ] **30. Doble envío en formularios** — guardado de categorías (`category-list.tsx:617`) y otros formularios no deshabilitan el botón mientras se envía → registros duplicados con doble clic. *Fix: estado `saving` + disabled.*
- [ ] **31. Doble importación posible** — `transaction-import-panel.tsx:553`: clic rápido dos veces dispara dos importaciones; la detección de duplicados no ve la primera. *Fix: guard `isImporting`.*
- [ ] **32. Saldo de cuentas desactualizado** — `cuentas-manager.tsx:84`: el saldo se calcula al montar y no se refresca al crear/borrar movimientos. *Fix: refetch al cambiar movimientos.*
- [ ] **33. Selección no se limpia al cambiar filtros** — `transaction-list.tsx:109`: las transacciones seleccionadas persisten tras cambiar filtros; las operaciones masivas pueden aplicarse a elementos que ya no se ven. *Fix: limpiar selección al cambiar filtros.*
- [ ] **34. Falta `not-found.tsx`** — los boundaries `error.tsx`/`global-error.tsx` ya existen, pero no hay página 404 personalizada. *Fix: crear `app/not-found.tsx`.*
- [ ] **35. Roles no aplicados en la UI** — el rol `solo_lectura` solo se respeta en categorías y pagos-mcm; en transacciones, cuentas, contactos e importación los botones de edición/borrado siguen activos. *Fix: aplicar el patrón de `category-list.tsx` en el resto.*
- [ ] **36. Borrados sin deshacer ni resumen de impacto** — borrar una categoría con movimientos no avisa del impacto ni ofrece undo. *Fix: diálogo con recuento de movimientos afectados + toast con "Deshacer".*
- [ ] **37. Operaciones masivas sin actualización optimista** — `transaction-manager.tsx`: asignar categoría en lote deja la UI congelada hasta la respuesta. *Fix: optimistic update con revert en error.*
- [ ] **38. Mensajes de error genéricos** — `toast.error("Error al guardar")` por toda la app sin código ni pista de resolución. *Fix: helper centralizado de errores con detalle.*

---

## 🎨 D. Interfaz y bugs visuales

- [ ] **39. Dark mode roto en el panel de importación** — `transaction-import-panel.tsx:797,813`: cajas informativas con `bg-blue-50 text-blue-800` hardcodeado, ilegibles en oscuro. *Fix: variantes `dark:`.*
- [ ] **40. Contraste insuficiente de los chips de importe en dark mode** — `components/ui/amount-display.tsx:26`. *Fix: ajustar opacidades dark.*
- [ ] **41. Título de categorías gigante en móvil** — `category-list.tsx:316`: `text-4xl` sin breakpoint rompe el layout en pantallas pequeñas. *Fix: `text-2xl sm:text-4xl`.*
- [ ] **42. Truncados/overflow en la tabla de transacciones** — `transaction-table.tsx:105` y `transaction-list-row.tsx:226`: conceptos y badges desbordan o quedan ilegibles en móvil. *Fix: `min-w-0`, `line-clamp`, max-widths responsivas.*
- [ ] **43. Email del usuario desborda el topbar en móvil** — `topbar.tsx:169`. *Fix: ocultar en `sm` o reducir max-width.*
- [ ] **44. Sheets/modales desbordan en pantallas pequeñas** — `transaction-import-panel.tsx:716` y formularios de categoría. *Fix: `max-h-[calc(100dvh-2rem)]` + scroll interno.*
- [ ] **45. Flash del icono de tema al hidratar** — `topbar.tsx:42`: el botón de tema muestra el icono equivocado un instante. *Fix: script inline de inicialización del tema.*
- [ ] **46. Posible mismatch de hidratación en el sidebar** — `app-layout.tsx:21`: lectura síncrona de localStorage en render. *Fix: leer en `useEffect`.*
- [ ] **47. Indicador "sin categorizar" solo por color** — `transaction-list-row.tsx:92`: borde ámbar invisible para daltónicos. *Fix: añadir icono o etiqueta de texto.*
- [ ] **48. Accesibilidad: botones de solo icono sin `aria-label`** — sidebar, topbar y acciones de tabla. *Fix: auditoría de aria-labels + `aria-busy` en estados de carga.*
- [ ] **49. Cadenas mezcladas español/inglés** — auditar y unificar todo el texto visible al español.

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

- [ ] **56. Completar las páginas deshabilitadas del sidebar** — `sidebar.tsx:82-94`: **Facturas** e **Informes** están como stubs `enabled: false`. Implementarlas o retirarlas.
- [ ] **57. Mapeo de columnas configurable en la importación** — hoy solo hay parsers hardcodeados de Sabadell y CaixaBank; añadir UI de mapeo + plantillas guardadas por banco.
- [ ] **58. Detector de duplicados "blandos"** — emparejamiento difuso (mismo importe ±0,01€, fecha ±1 día, concepto similar) con asistente de fusión; el `concepto_hash` actual solo pilla duplicados exactos.
- [ ] **59. Notificaciones por email** — presupuesto excedido, huecos de conciliación, consentimiento PSD2 a punto de caducar (este banner ya está apuntado como pendiente en `docs/ENABLE_BANKING.md`).
- [ ] **60. Gestión de miembros por delegación** — UI para que el tesorero invite usuarios y asigne roles, en vez de depender solo de la página de admin.
- [ ] **61. Búsqueda avanzada y filtros guardados** — full-text search con `tsvector` en Postgres (hoy solo `ilike` en concepto/descripción) + conjuntos de filtros reutilizables.
- [ ] **62. Soporte PWA/móvil** — manifest + service worker para captura rápida de gastos en campo.

### Pulido

- [ ] **63. Auto-categorización por reglas** — el esquema de reglas existe parcialmente en BD pero no tiene UI de gestión.
- [ ] **64. Previsión de tesorería** — proyección de saldo a 30/60/90 días basada en recurrentes + histórico, con aviso de saldo negativo proyectado.
- [ ] **65. Exportación en más formatos** — CSV/JSON y selección de columnas (hoy solo XLSX con 7 columnas fijas).

---

## 🧹 F. Mantenibilidad y deuda técnica

- [ ] **66. Debounce global de revalidaciones al cambiar de pestaña** — `hooks/use-app-status.ts`: las revalidaciones al volver al foco se disparan en ráfaga (jitter individual de 90-220ms). *Fix: agrupador `scheduleRevalidation` con ventana de ~500ms que ejecute los callbacks de forma escalonada.*
- [ ] **67. Trocear `category-list.tsx` (1269 líneas)** — solo se extrajo `CategoryCard`. *Fix: separar tipos, helpers, dialogs y formularios a `components/categories/`, dejando el archivo principal como orquestador (<400 líneas). Refactor mecánico sin cambio de comportamiento.*
- [ ] **68. Continuar la migración a TanStack Query** — el piloto cubre `useCategoryBreakdown`. *Fix: migrar el resto de hooks de fetching manteniendo el mismo contrato de salida, y retirar la gestión manual de abort/caché donde React Query ya lo cubra.*

---

## Prioridades recomendadas

1. **Lote 1 (urgente):** 1–4 — la API de admin abierta es una vulnerabilidad crítica explotable hoy.
2. **Lote 2 (seguridad alta):** 5, 7, 9 — adjuntos públicos, RPCs sin autorización, cabeceras.
3. **Lote 3 (bugs diarios):** 27–31 — coma decimal y doble envío afectan a la entrada de datos a diario.
4. **Lote 4 (rendimiento):** 13–16, 24.
5. **Lote 5 (deuda técnica):** 66–68.
