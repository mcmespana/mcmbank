# Mejoras de UI — planes de diseño

Generados por el skill `improve-ui`. Cada plan es autocontenido: un agente
ejecutor no necesita ningún contexto de la conversación. **Ejecutor:** lee el
plan entero, haz solo lo que dice, ejecuta su sección Validation, y actualiza
tu fila de estado aquí al terminar. Si un paso no cuadra con el código actual,
PARA, marca BLOCKED con una línea de motivo, y no improvises.

Los planes 004–006 son independientes entre sí; se pueden ejecutar en
cualquier orden o en paralelo. No pisan a los planes funcionales de `plans/`
(012 y 013 tocan ficheros vecinos — cada plan indica qué NO tocar).

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

Estados: TODO | IN PROGRESS | DONE (fecha) | BLOCKED (motivo en una línea)
