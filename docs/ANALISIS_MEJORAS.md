# Trabajo pendiente

> Lista única de lo que queda por hacer, ordenada por lo que más duele primero.
> Sin numerar a propósito: los números del análisis viejo apuntaban a un
> documento que ya no existía y hacían falta dos saltos para entender una línea.
>
> **Cuando termines algo, bórralo de aquí.** El registro de lo ya hecho vive en
> `docs/ARCHIVO_MEJORAS.md` (análisis 2026, congelado) y en
> `docs/OPTIMIZACIONES_REALIZADAS.md` (rendimiento).
>
> Última revisión contra código y BBDD en vivo: **15/08/2026**.

---

## Ahora

Cosas pequeñas con consecuencias reales. Ninguna necesita decisión de producto.

- **El dashboard `/` no está protegido en el middleware** — `lib/supabase/middleware.ts`
  cubre las diez rutas de la app menos la portada. Añadirlo a `protectedRoutes`,
  o dejar escrito por qué se queda fuera a propósito.
- **`solo_lectura` no se respeta en media app** — el rol se comprueba en
  categorías, contactos, facturas, informes y pagos MCM (`use-delegation-role`),
  pero en **transacciones, cuentas e importación** los botones de editar y
  borrar siguen activos. Es el hueco más grande que queda de permisos en
  cliente.
- **Validación de ficheros permisiva** — revisar la lista blanca de extensiones
  y el límite de tamaño de `lib/services/file-service.ts`. Pendiente de mirar en
  detalle; puede que ya esté bien.
- **`xlsx` se instala desde el CDN de SheetJS** — `package.json` apunta a
  `https://cdn.sheetjs.com/...` (0.20.3): una dependencia de build fuera de
  cualquier registro con lockfile. Moverla a npm y actualizar.
- **Operaciones masivas sin actualización optimista** — en `transaction-manager.tsx`,
  asignar categoría en lote deja la interfaz congelada hasta que responde el
  servidor. Optimista con revert en error, como ya hace el resto de la pantalla.
- **Mensajes de error genéricos** — `toast.error("Error al guardar")` por toda la
  app, sin decir qué ha fallado ni qué hacer. Falta un helper central que
  traduzca el error de Postgres/PostgREST a algo accionable. Relacionado: decidir
  si un abort de petición (cambiar de pestaña) debería llegar a verse como
  alerta roja — hoy se normaliza a "Request aborted" pero se sigue pintando.

## Acción del mantenedor (fuera del código)

- **Protección de contraseñas filtradas desactivada en Supabase Auth** — el
  advisor reporta `auth_leaked_password_protection` apagado (no contrasta contra
  HaveIBeenPwned). Se activa en Auth → Password protection.
- **Postgres con parches de seguridad pendientes** — advisor
  `vulnerable_postgres_version` sobre `supabase-postgres-17.4.1.074`. Programar
  el upgrade desde el dashboard.
- **`images.unoptimized: true` en `next.config.mjs`** — activar la optimización
  de imágenes de Next tiene coste (Image Optimization API de Vercel) y hay que
  declarar los dominios remotos permitidos. Es una decisión de infra, no un
  cambio de código aislado.

## Funcionalidad: control financiero

Es lo que más le falta a la app para una organización que mueve dinero de verdad.
Ordenado por valor.

- **Presupuestos por categoría con alertas** — tabla `categoria_presupuesto`,
  widget en el dashboard con semáforo (ok / aviso / excedido) y página
  `/presupuestos`. La pieza clave.
- **Movimientos recurrentes** — declarar los gastos fijos (alquiler,
  suministros) y avisar cuando un mes no aparece el cargo esperado; widget de
  "próximos gastos recurrentes".
- **Asistente de conciliación bancaria** — comparar el extracto sincronizado
  (Enable Banking ya funciona) contra lo registrado: no-coincidentes por ambos
  lados y sugerencias de emparejamiento difuso, en una página `/reconciliacion`.
- **Transferencias internas vinculadas** — al mover dinero entre cuentas
  propias, enlazar los dos movimientos para que los informes no cuenten un
  ingreso y un gasto que no existen.
- **Registro de auditoría** — triggers en `movimiento`/`cuenta`/`categoria` hacia
  una tabla `audit_log`, y página `/auditoria`: quién cambió qué y cuándo.
  Importante con tesoreros en 17 delegaciones.
- **Informe PDF por periodo** — portada, resumen, desglose mensual y por
  categorías. Hoy solo hay Excel.

## Funcionalidad: auto-categorización

Los dos hermanos del mismo problema. Reglas ya decididas y que no hay que volver
a discutir: **la IA sugiere, no decide** (igual que en facturas, la sugerencia
espera a que alguien la acepte) y el proveedor se detecta con
`CADENAS_EN_EXTRACTO` de `lib/utils/facturas-matching.ts`, que ya sabe leer las
cadenas típicas del extracto.

- **Reglas de auto-categorización (UI)** — el esquema existe a medias en la BBDD.
  **Bloqueante antes de tocar pantalla**: la tabla `regla` tiene RLS activo *sin
  ninguna política* (deny-all, 0 filas hoy). No es un agujero —falla cerrado—
  pero hay que decidir y crear las políticas (¿quién crea y edita las reglas de
  su delegación?) antes de que nada pueda leer o escribir ahí.
- **Categorizar y renombrar movimientos** — dos piezas:
  1. *Categorizar*: primero sin IA (reglas y, sobre todo, aprender del
     historial: si los últimos N movimientos cuyo concepto normaliza igual
     fueron a la misma categoría, proponerla). La IA solo para lo que no case, y
     en lote, que es lo que lo hace asumible.
  2. *Nombrar*: el concepto del banco es ruido
     (`COMPRA TARJ. 4021 MERCADONA SEVILLA 13/08`). Guardar aparte un título
     legible sin pisar el original, que es la prueba documental.

## Funcionalidad: resto

- **Mapeo de columnas configurable en la importación** — hoy hay parsers
  hardcodeados de Sabadell y CaixaBank. Falta UI de mapeo y plantillas guardadas
  por banco.
- **Detector de duplicados "blandos"** — el `concepto_hash` actual solo pilla
  duplicados exactos. Emparejamiento difuso (mismo importe ±0,01 €, fecha ±1
  día, concepto parecido) con asistente de fusión.
- **Notificaciones por email** — presupuesto excedido, huecos de conciliación y
  consentimiento PSD2 a punto de caducar (este banner ya está apuntado en
  `docs/ENABLE_BANKING.md`).
- **Gestión de miembros por delegación** — que el tesorero invite usuarios y
  asigne roles sin depender de la página de admin.
- **Búsqueda avanzada y filtros guardados** — full-text con `tsvector` en
  Postgres (hoy es `ilike` sobre concepto y descripción) y conjuntos de filtros
  reutilizables.
- **Previsión de tesorería** — proyección de saldo a 30/60/90 días desde los
  recurrentes y el histórico, avisando de saldo negativo proyectado.
- **Soporte PWA** — no hay manifest ni service worker. Para capturar un gasto en
  el momento, desde el móvil.
- **Exportar en más formatos** — CSV/JSON y elegir columnas; hoy es XLSX con 7
  columnas fijas.
- **Deshacer un borrado** — los diálogos de borrado ya cuentan el impacto antes
  de preguntar (categoría, cuenta, contacto, factura), pero una vez confirmado
  no hay vuelta atrás. Un toast con "Deshacer" cubriría el resto del caso.

## Deuda técnica

- **Trocear `category-list.tsx`** — 1.248 líneas. Solo se extrajo `CategoryCard`.
  Separar tipos, helpers, diálogos y formularios, dejando el fichero como
  orquestador (<400 líneas). Refactor mecánico, sin cambio de comportamiento.
- **Terminar la migración a TanStack Query** — 10 de 36 hooks migrados. El resto
  sigue con `useState`/`useEffect` y gestión manual de abort y caché que React
  Query ya cubre. Migrar manteniendo el mismo contrato de salida.
- **Agrupar las revalidaciones al volver el foco** — `hooks/use-app-status.ts`
  las dispara en ráfaga con un jitter individual de 90-220 ms. Un
  `scheduleRevalidation` con ventana de ~500 ms las escalonaría.
- **`components/configuration/configuration-manager.tsx` es código muerto** — no
  lo importa nadie y arrastra los bugs que ya se corrigieron en
  `components/configuracion/config-page.tsx` (entre ellos el doble envío).
  Borrarlo.
- **`getContactosByDelegacion` sin paginación** — *revisado y aparcado a
  propósito*: son 8 proveedores compartidos en total. `useContactos` construye
  los contadores por tipo en cliente y hace mutaciones optimistas sobre el array
  entero; paginar rompería las dos cosas sin ganar nada. Volver cuando el
  volumen lo justifique.
- **La API externa usa el cliente admin sin ámbito de delegación** — por diseño
  y documentado en el propio código (la consume Google Apps Script y el id de
  movimiento es único en toda la BBDD), pero una sola clave filtrada expone las
  17 delegaciones sin pasar por RLS. A valorar: claves por delegación o por
  consumidor si crecen las integraciones.
