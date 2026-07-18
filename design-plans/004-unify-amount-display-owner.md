# Unificar los dos componentes `AmountDisplay` duplicados en un único owner tokenizado

Written against: 0bc851b (working tree includes design-plans 001–003 already executed)

> **Instrucciones para el ejecutor (léelas enteras antes de tocar nada):**
> Este plan es autocontenido. Haz EXACTAMENTE los pasos en orden. No cambies
> nada más. Si un `grep` de verificación no da el resultado esperado, PARA y
> repórtalo en `design-plans/README.md` en lugar de improvisar.

## Evidence chain

- Surface: filas de movimientos (`/transacciones`), sheet de movimientos relacionados, y filas de categorías (`/categorias`).
- Problem: Existen DOS componentes distintos llamados `AmountDisplay`:
  - `components/amount-display.tsx` — usa los tokens del sistema `transaction-amount-positive` / `transaction-amount-negative` (definidos en `app/globals.css:193-210`, con modo oscuro y efecto glass) y un estado especial para importe 0 (gris apagado).
  - `components/ui/amount-display.tsx` — copia con paleta cruda (`text-green-700 bg-green-100 border-green-300 …`), `min-w-[80px+]`, y SIN estado cero (un importe 0 se pinta en rojo).
- Design evidence: los tokens `transaction-amount-*` de `app/globals.css` son la definición del sistema para importes de transacciones; la copia de `components/ui/` los ignora. Consecuencia visible: el mismo importe se ve con pill distinta en `/transacciones` (verde/rojo crudo con borde fuerte) y en `/categorias` (token esmeralda/rosa glass), y un importe 0 sale rojo en movimientos pero gris en categorías.
- Owner: `components/amount-display.tsx` (el tokenizado).
- Scope and affected surfaces: `components/transactions/transaction-list-row.tsx:6`, `components/transactions/related-movements-sheet.tsx:7` (consumidores de la copia); `components/categories/category-list.tsx:41` (ya usa el owner).
- Uncertainty: none.

## Design decision

Un solo owner: `components/amount-display.tsx`. Los dos consumidores de la copia pasan a importar el owner, y la copia `components/ui/amount-display.tsx` se elimina. No se cambia el owner en sí.

## Reuse

- `components/amount-display.tsx` (owner, sin modificar)
- Tokens: `.transaction-amount-positive` / `.transaction-amount-negative` en `app/globals.css`
- Exemplar de consumo: `components/categories/category-list.tsx:41` + su uso `<AmountDisplay amount={balance} size="sm" />`

## Changes (paso a paso)

1. `components/transactions/transaction-list-row.tsx` línea 6
   - Cambia EXACTAMENTE esta línea:
     - ANTES: `import { AmountDisplay } from "@/components/ui/amount-display"`
     - DESPUÉS: `import { AmountDisplay } from "@/components/amount-display"`
   - No toques nada más del fichero. El uso `<AmountDisplay amount={movement.importe} size="sm" />` es compatible (mismas props).
2. `components/transactions/related-movements-sheet.tsx` línea 7
   - Mismo cambio de import que en el paso 1.
3. Borra el fichero `components/ui/amount-display.tsx`.
   - Antes de borrarlo ejecuta: `grep -rn "components/ui/amount-display" components app lib` → NO debe quedar ningún resultado. Si queda alguno, cámbialo igual que el paso 1 y vuelve a comprobar.

- Preserve: el componente owner `components/amount-display.tsx` tal cual está; el tamaño `size="sm"` en ambos consumidores.
- Verify: ver Validation.

## Scope

- Inherit: `/transacciones` (filas), sheet de movimientos relacionados.
- Verify: `/categorias` no cambia (ya usaba el owner).
- Exclude: `transaction-table.tsx` (componente sin consumidores, no lo toques); cualquier cambio de estilo dentro del owner.

## Validation

- Product: en `/transacciones`, las pills de importe pasan a verse como las de `/categorias` (esmeralda/rosa glass); un importe 0 se ve gris apagado.
- Interface: modo claro y oscuro.
- System: queda un único `AmountDisplay` en el repo.
- Repository:
  - `grep -rn "ui/amount-display" components app` → sin resultados.
  - `ls components/ui/amount-display.tsx` → "No such file".
  - `npx tsc --noEmit` → sin errores nuevos que mencionen amount-display.

## Stop conditions

- Para si `components/amount-display.tsx` ya no existe o sus props han cambiado (reconcilia primero).

## Design documentation

- None.
