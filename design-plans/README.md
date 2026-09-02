# Mejoras de UI — planes de diseño

Cada plan es autocontenido: un agente ejecutor no necesita ningún contexto de la
conversación. **Ejecutor:** lee `../design.md` primero, después el plan entero, haz solo lo
que dice, ejecuta su sección Validación, y actualiza tu fila de estado aquí al terminar. Si
un paso no cuadra con el código actual, PARA, marca BLOCKED con una línea de motivo, y no
improvises.

## Dos tandas

- **001–010** — pasada de coherencia de 2026-07 (generados por el skill `improve-ui`).
  Todos hechos.
- **020–028** — **unificación con el sistema de diseño MCM** (`../design.md`). Retiraron la
  estética *Liquid Glass* heredada de v0 y llevaron Bank al vocabulario compartido por las
  cuatro apps. **Hechos los nueve el 2026-09-02**, un commit por plan, validando cada uno con
  `typecheck` + `lint` + los 971 tests + `build` y con capturas en claro y oscuro a 430 y
  1700 px.
- **029** — lo que aquellos nueve apartaron a propósito para no ensanchar sus commits.

Los planes de diseño no pisan a los funcionales de `plans/` — cada plan indica qué NO tocar.

## Estado

| Plan | Título | Superficie | Estado |
|------|--------|------------|--------|
| [001](001-contactos-section-header-alignment.md) | Cabecera de Contactos alineada al patrón de sección | /contactos | DONE (2026-07-17) |
| [002](002-contacto-selector-reuse-tipo-badge.md) | ContactoSelector reutiliza ContactoTipoBadge y pill Global | movimientos | DONE (2026-07-17) |
| [003](003-delete-contacto-dialog-destructive-title.md) | Título destructivo rojo en DeleteContactoDialog | /contactos | DONE (2026-07-17) |
| [004](004-unify-amount-display-owner.md) | Unificar los dos `AmountDisplay` duplicados (tokens `transaction-amount-*`) | movimientos + categorías | DONE (2026-07-18) |
| [005](005-use-loading-spinner-owner.md) | Spinners de página → owner `LoadingSpinner` | movimientos + categorías | DONE (2026-07-18) |
| [006](006-file-delete-dialog-destructive-title.md) | Título destructivo rojo en "¿Eliminar archivo?" | movimientos | DONE (2026-07-18) |
| [007](007-animate-bulk-selection-toolbar.md) | Animar entrada de la barra de selección masiva | movimientos | DONE (2026-07-18) |
| [008](008-animate-mobile-filters-panel.md) | Animar apertura del panel de filtros móvil | movimientos | DONE (2026-07-18) |
| [009](009-animate-empty-state-entrance.md) | Entrada suave de EmptyState (toda la app) | global | DONE (2026-07-18) |
| [010](010-animate-import-success-message.md) | Entrada del mensaje de éxito de importación | movimientos | DONE (2026-07-18) |
| [020](020-borrar-css-muerto-liquid-glass.md) | Borrar el CSS muerto de "Liquid Glass" + `styles/globals.css` | global | DONE (2026-09-02) |
| [021](021-botones-a-la-escala-del-sistema.md) | Botones a la escala del sistema (radio, altura, sombra, blur) | global | DONE (2026-09-02) |
| [022](022-page-header-sin-degradado.md) | `PageHeader` sin degradado ni sombra de color | global | DONE (2026-09-02) |
| [023](023-radius-y-barrido-de-rounded-2xl.md) | `--radius` a 0,625 rem y barrido de `rounded-2xl` | global | DONE (2026-09-02) |
| [024](024-quitar-hover-scale.md) | Quitar los 15 `hover:scale` que quedan | global | DONE (2026-09-02) |
| [025](025-tokens-hsl-a-oklch.md) | Tokens de HSL a OKLCH, con rampa cruda y capa semántica | global | DONE (2026-09-02) |
| [026](026-tipografia-figtree-bricolage.md) | Tipografía: Geist → Figtree + Bricolage (requiere visto bueno) | global | DONE (2026-09-02) |
| [027](027-theme-color-y-primary.md) | `theme-color` y `--primary` no coinciden; falta el de oscuro | global | DONE (2026-09-02) |
| [028](028-quitar-generator-v0.md) | Quitar `generator: "v0.app"` de la metadata | global | DONE (2026-09-02) |
| [029](029-destructivo-y-restos-de-liquid-glass.md) | Rojo destructivo en dos variantes; restos de `backdrop-blur`; `hidden sm:inline` | global | TODO |

Estados: TODO | IN PROGRESS | DONE (fecha) | BLOCKED (motivo en una línea)
