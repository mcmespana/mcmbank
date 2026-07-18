# Animar la entrada de la barra de acciones masivas en movimientos

Written against: 0bc851b

> **Instrucciones para el ejecutor:** plan autocontenido; haz exactamente
> estos pasos y nada más. Si el literal a buscar no existe, PARA y anótalo
> como BLOCKED en `design-plans/README.md`.

## Evidence chain

- Surface: `/transacciones` — barra de acciones masivas que aparece al seleccionar la primera transacción.
- Problem: `components/transactions/transaction-manager.tsx:670` — `{selectionActive && (<div className="rounded-xl border border-primary/30 bg-primary/10 …">)}` aparece de golpe y empuja el layout.
- Purpose: evitar un cambio brusco (preventing a jarring change). Frecuencia: ocasional. Duración dentro de presupuesto (200ms).
- Owner: utilidades de `tailwindcss-animate` ya usadas por los primitivos del repo (`animate-in`, `fade-in-0`, `slide-in-from-top-2`).
- Uncertainty: none.

## Design decision

Entrada con fade + deslizamiento corto desde arriba, 200ms, mismo idioma que los popovers del repo. Solo entrada — no añadas lógica JS para animar la salida (el render condicional la quita al instante y está bien así). Incluir `motion-reduce`.

## Changes (paso a paso)

1. `components/transactions/transaction-manager.tsx` (~línea 671)
   - Busca el div que se renderiza dentro de `{selectionActive && (`:
     `<div className="rounded-xl border border-primary/30 bg-primary/10 p-3 sm:p-4 shadow-sm">`
   - Sustituye SOLO su className por:
     `<div className="rounded-xl border border-primary/30 bg-primary/10 p-3 sm:p-4 shadow-sm animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none">`
   - No toques nada más.

- Preserve: todo el contenido y lógica de la barra.

## Validation

- Product: en `/transacciones`, selecciona una transacción → la barra entra con un fade+deslizamiento sutil (~200ms). Al deseleccionar, desaparece al instante (correcto).
- Interface: móvil y escritorio; con "reducir movimiento" activado en el SO no debe animar.
- Repository: `grep -n "slide-in-from-top-2" components/transactions/transaction-manager.tsx` → 1 coincidencia.

## Stop conditions

- Para si el div ya tiene clases `animate-in` (otro ejecutor llegó antes).

## Design documentation

- None.
