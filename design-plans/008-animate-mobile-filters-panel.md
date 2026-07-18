# Animar la apertura del panel de filtros móvil en movimientos

Written against: 0bc851b

> **Instrucciones para el ejecutor:** plan autocontenido; haz exactamente
> estos pasos y nada más. Si el literal a buscar no existe, PARA y anótalo
> como BLOCKED en `design-plans/README.md`.

## Evidence chain

- Surface: `/transacciones` en móvil — panel de filtros que se abre con el botón de filtros.
- Problem: `components/transactions/transaction-manager.tsx:744` — `{filtersOpen && (<Card className="lg:hidden p-4 border-2 border-blue-200 …">)}` aparece de golpe.
- Purpose: indicación de estado + evitar cambio brusco. Frecuencia: ocasional. 200ms.
- Owner: utilidades `tailwindcss-animate` (mismo idioma `slide-in-from-top-2` que popovers/tooltips del repo).
- Uncertainty: none.

## Design decision

Entrada fade + deslizamiento corto desde arriba (viene del botón que está encima → coherencia espacial), 200ms, solo entrada, con `motion-reduce`.

## Changes (paso a paso)

1. `components/transactions/transaction-manager.tsx` (~línea 744)
   - Busca la Card dentro de `{filtersOpen && (`:
     `<Card className="lg:hidden p-4 border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">`
   - Sustituye SOLO su className por:
     `<Card className="lg:hidden p-4 border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none">`

- Preserve: todo el contenido del panel y el botón de cierre.

## Validation

- Product: en `/transacciones` con viewport móvil (<1024px), abre filtros → el panel entra suave desde arriba (~200ms); cerrar es instantáneo (correcto).
- Interface: comprobar que en escritorio (lg) sigue oculto; con "reducir movimiento" no anima.
- Repository: `grep -c "slide-in-from-top-2" components/transactions/transaction-manager.tsx` → 2 (esta + plan 007; si el 007 no se ha ejecutado aún, 1).

## Stop conditions

- Para si la Card ya tiene clases `animate-in`.

## Design documentation

- None.
