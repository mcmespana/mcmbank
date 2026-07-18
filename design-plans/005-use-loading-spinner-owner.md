# Sustituir los spinners de página hechos a mano por el owner `LoadingSpinner`

Written against: 0bc851b (working tree includes design-plans 001–003 already executed)

> **Instrucciones para el ejecutor:** plan autocontenido; haz exactamente
> estos pasos y nada más. Si un grep de verificación falla, PARA y repórtalo
> en `design-plans/README.md`.

## Evidence chain

- Surface: estado de carga de página en `/transacciones` y `/categorias`.
- Problem: Ambas superficies pintan un spinner a mano — `<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>` — en `components/transactions/transaction-manager.tsx:522` y `components/categories/category-list.tsx:1191`, mientras que el resto de las MISMAS superficies usa el owner `components/ui/loading-spinner.tsx` (`border-2 border-muted border-t-primary`; usado en transaction-list-row, transaction-files, related-movements-sheet, etc.). Dos estilos de spinner distintos dentro de la misma tarea.
- Design evidence: owner `components/ui/loading-spinner.tsx` con variante `size="lg"` (`h-8 w-8`, el mismo tamaño que el spinner a mano).
- Owner: `components/ui/loading-spinner.tsx`.
- Scope and affected surfaces: las dos líneas citadas.
- Uncertainty: none.

## Design decision

Los dos estados de carga de página usan `<LoadingSpinner size="lg" className="mx-auto mb-4" />` para que todos los spinners de la app compartan una única presentación.

## Reuse

- `LoadingSpinner` (`components/ui/loading-spinner.tsx`), variante `size="lg"`
- Exemplar: `components/transactions/transaction-list-row.tsx` (uso de `<LoadingSpinner size="sm" />`)

## Changes (paso a paso)

1. `components/transactions/transaction-manager.tsx` (~línea 522)
   - Busca EXACTAMENTE: `<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>`
   - Sustitúyelo por: `<LoadingSpinner size="lg" className="mx-auto mb-4" />`
   - Comprueba si el fichero ya importa `LoadingSpinner`; si no, añade: `import { LoadingSpinner } from "@/components/ui/loading-spinner"` junto al resto de imports de `@/components/ui/`.
2. `components/categories/category-list.tsx` (~línea 1191)
   - Mismo reemplazo y mismo import que el paso 1.

- Preserve: el texto/estructura que rodea al spinner (mensajes de "cargando"), sin cambios.
- Verify: ver Validation.

## Scope

- Inherit: `/transacciones` y `/categorias` (carga inicial).
- Verify: ninguna otra superficie.
- Exclude: cualquier otro spinner; no cambies el owner.

## Validation

- Product: recarga `/transacciones` y `/categorias`; el spinner de carga es el circular con pista gris + arco primario, igual que los spinners pequeños de la app.
- Interface: modo claro y oscuro.
- System: `grep -rn "border-b-2 border-primary" components` → sin resultados.
- Repository: `npx tsc --noEmit` → sin errores nuevos.

## Stop conditions

- Para si los literales citados ya no existen en esos ficheros (reconcilia contra el código actual).

## Design documentation

- None.
