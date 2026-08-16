# Trabajo pendiente

> Lista única de lo que queda por hacer, ordenada por lo que más falta hace.
> Sin numerar a propósito.
>
> **Cuando termines algo, bórralo de aquí.** El registro de lo ya hecho vive en
> `docs/ARCHIVO_MEJORAS.md` (análisis 2026, congelado) y en
> `docs/OPTIMIZACIONES_REALIZADAS.md` (rendimiento).
>
> Última revisión contra código y BBDD en vivo: **15/08/2026**.

---

## Siguiente

- **Informe PDF por periodo** — *priorizado.* Portada, resumen, desglose mensual
  y por categorías, exportable desde el dashboard. Hoy solo hay Excel, y un
  Excel no se manda a una junta.
- **Deshacer, en el resto de borrados** — el borrado en lote de movimientos ya
  tiene toast con "Deshacer" (se reinsertan con su id original,
  `restoreMovimientos()` en `hooks/use-movimientos.ts`). Falta llevarlo al
  borrado de un movimiento suelto y al de facturas, que son los otros dos que
  duelen. Aviso: los adjuntos no vuelven, porque `movimiento_archivo` cae por
  cascada y los ficheros de Storage se borran aparte.
- **Terminar la migración a TanStack Query** — *priorizado para otro momento.*
  10 de 36 hooks. El resto sigue con `useState`/`useEffect` y gestión manual de
  abort y caché que React Query ya cubre. Mismo contrato de salida, hook a hook.

## Auto-categorización

Reglas ya decididas y que no hay que volver a discutir: **la IA sugiere, no
decide** (igual que en facturas: la sugerencia espera a que alguien la acepte) y
el proveedor se detecta con `CADENAS_EN_EXTRACTO` de
`lib/utils/facturas-matching.ts`, que ya sabe leer las cadenas típicas del
extracto.

- **UI de reglas** — el esquema existe a medias en la BBDD. **Bloqueante antes
  de tocar pantalla**: la tabla `regla` tiene RLS activo *sin ninguna política*
  (deny-all, 0 filas hoy). No es un agujero —falla cerrado— pero hay que decidir
  y crear las políticas (¿quién crea y edita las reglas de su delegación?) antes
  de que nada pueda leer o escribir ahí.
- **Categorizar y renombrar movimientos** — dos piezas:
  1. *Categorizar*: primero sin IA (reglas y, sobre todo, aprender del
     historial: si los últimos N movimientos cuyo concepto normaliza igual
     fueron a la misma categoría, proponerla). La IA solo para lo que no case, y
     en lote, que es lo que lo hace asumible.
  2. *Nombrar*: el concepto del banco es ruido
     (`COMPRA TARJ. 4021 MERCADONA SEVILLA 13/08`). Guardar aparte un título
     legible sin pisar el original, que es la prueba documental.

## Funcionalidad, sin prisa

- **Presupuestos por categoría con alertas** — tabla `categoria_presupuesto`,
  widget en el dashboard con semáforo (ok / aviso / excedido) y página
  `/presupuestos`. *Se hará algún día, no ahora.*
- **Mapeo de columnas configurable en la importación** — hoy hay parsers
  hardcodeados de Sabadell y CaixaBank. Falta UI de mapeo y plantillas guardadas
  por banco.
- **Detector de duplicados "blandos"** — el `concepto_hash` actual solo pilla
  duplicados exactos. Emparejamiento difuso (mismo importe ±0,01 €, fecha ±1
  día, concepto parecido) con asistente de fusión.
- **Registro de auditoría** — triggers en `movimiento`/`cuenta`/`categoria`
  hacia una tabla `audit_log`, y página `/auditoria`: quién cambió qué y cuándo.
- **Notificaciones por email** — presupuesto excedido y consentimiento PSD2 a
  punto de caducar (este banner ya está apuntado en `docs/ENABLE_BANKING.md`).
- **Gestión de miembros por delegación** — que el tesorero invite usuarios y
  asigne roles sin depender de la página de admin.
- **Búsqueda avanzada y filtros guardados** — full-text con `tsvector` en
  Postgres (hoy es `ilike` sobre concepto y descripción) y conjuntos de filtros
  reutilizables.
- **Exportar en más formatos** — CSV/JSON y elegir columnas; hoy es XLSX con 7
  columnas fijas.

## Acción del mantenedor (fuera del código)

- **Protección de contraseñas filtradas desactivada en Supabase Auth** — el
  advisor reporta `auth_leaked_password_protection` apagado (no contrasta contra
  HaveIBeenPwned). Se activa en el dashboard: Authentication → Policies →
  Password protection. Es un interruptor, no requiere despliegue.
- **Postgres con parches de seguridad pendientes** — advisor
  `vulnerable_postgres_version` sobre `supabase-postgres-17.4.1.074`. En el
  dashboard de Supabase: Settings → Infrastructure → "Upgrade project". Lo hace
  Supabase solo; implica unos minutos de corte, así que conviene lanzarlo fuera
  de horario. Hace copia antes.

## Deuda técnica

- **Trocear `category-list.tsx`** — 1.248 líneas. Solo se extrajo `CategoryCard`.
  Separar tipos, helpers, diálogos y formularios, dejando el fichero como
  orquestador (<400 líneas). Refactor mecánico, sin cambio de comportamiento.
- **Agrupar las revalidaciones al volver el foco** — `hooks/use-app-status.ts`
  las dispara en ráfaga con un jitter individual de 90-220 ms. Un
  `scheduleRevalidation` con ventana de ~500 ms las escalonaría.
- **`components/configuration/configuration-manager.tsx` es código muerto** — no
  lo importa nadie y arrastra los bugs que ya se corrigieron en
  `components/configuracion/config-page.tsx` (entre ellos el doble envío).
  Borrarlo.
- **Extender `describirError()`** — `lib/utils/describir-error.ts` ya enseña el
  mensaje real de Postgres/PostgREST (con `details`, `hint` y código) y está
  puesto en las acciones en lote de movimientos. Falta llevarlo al resto de
  `toast.error("Error al guardar")` que siguen sueltos por la app.
- **Validación de ficheros** — revisar la lista blanca de extensiones y el
  límite de tamaño de `lib/services/file-service.ts`. Pendiente de mirar en
  detalle; puede que ya esté bien.

## Revisado y descartado

No volver a abrirlos sin un motivo nuevo.

- **`solo_lectura` sin aplicar en toda la UI** — el rol se respeta en categorías,
  contactos, facturas, informes y pagos MCM, y no en transacciones, cuentas e
  importación. **No se usa ese rol hoy**, así que no toca.
- **`images.unoptimized: true`** — activarlo cuesta dinero en la Image
  Optimization API de Vercel. Se queda como está.
- **Movimientos recurrentes** — no encaja con cómo gasta la organización.
- **Asistente de conciliación bancaria y transferencias internas vinculadas** —
  descartados: no responden a un problema real de la casa.
- **Paginar `getContactosByDelegacion`** — son 8 proveedores compartidos en
  total. `useContactos` construye los contadores por tipo en cliente y hace
  mutaciones optimistas sobre el array entero; paginar rompería las dos cosas
  sin ganar nada. Volver cuando el volumen lo justifique.
- **Ámbito de delegación en la API externa** — usa el cliente admin a propósito
  (la consume Google Apps Script y el id de movimiento es único en toda la
  BBDD). Una clave filtrada expone las 17 delegaciones sin pasar por RLS; a
  valorar claves por delegación *solo si* crecen las integraciones.
