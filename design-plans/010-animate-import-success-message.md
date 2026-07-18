# Celebrar (con moderación) el éxito de una importación de movimientos

Written against: 0bc851b

> **Instrucciones para el ejecutor:** plan autocontenido; haz exactamente
> estos pasos y nada más. Si el literal a buscar no existe, PARA y anótalo
> como BLOCKED en `design-plans/README.md`.

## Evidence chain

- Surface: panel de importación de movimientos — mensaje de éxito tras importar.
- Problem: `components/transactions/transaction-import-panel.tsx:907-910` — la caja verde "✅ Se han importado N transacciones" aparece plana, sin entrada.
- Purpose: delight en momento raro y de alta emoción (el usuario acaba de completar una importación). Frecuencia: rara → aquí vive el presupuesto de delight. Aun así ≤300ms y sin bounce: es una app de tesorería.
- Owner: utilidades `tailwindcss-animate`.
- Uncertainty: none.

## Design decision

Entrada fade + zoom sutil + pequeño deslizamiento desde abajo, 300ms, con `motion-reduce` a solo fade.

## Changes (paso a paso)

1. `components/transactions/transaction-import-panel.tsx` (~línea 908)
   - Busca dentro de `{!isImporting && message && (`:
     `<div className="bg-green-50 border border-green-200 rounded-lg p-3">`
   - Sustitúyelo por:
     `<div className="bg-green-50 border border-green-200 rounded-lg p-3 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-300 motion-reduce:zoom-in-100 motion-reduce:slide-in-from-bottom-0">`
   - Cuidado: hay OTRA caja parecida justo debajo para duplicados (`bg-amber-50 …`); NO la toques — es un aviso, no una celebración.

- Preserve: el texto del mensaje y toda la lógica de importación.

## Validation

- Product: completa una importación (o simula `message` con estado) → la caja verde entra con fade+zoom+deslizamiento (~300ms).
- Interface: con "reducir movimiento" solo fade; la caja ámbar de duplicados sigue apareciendo sin animar.
- Repository: `grep -n "slide-in-from-bottom-2" components/transactions/transaction-import-panel.tsx` → 1 coincidencia.

## Stop conditions

- Para si el div verde ya tiene clases `animate-in`.

## Design documentation

- None.
