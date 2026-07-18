# Entrada suave para EmptyState en toda la app

Written against: 0bc851b

> **Instrucciones para el ejecutor:** plan autocontenido; haz exactamente
> estos pasos y nada más. Si el literal a buscar no existe, PARA y anótalo
> como BLOCKED en `design-plans/README.md`.

## Evidence chain

- Surface: todos los estados vacíos de la app (transacciones, categorías, dashboard, contactos, archivos…) — consumidores de `components/ui/empty-state.tsx`.
- Problem: al resolverse una carga, el spinner se sustituye por el EmptyState de golpe (teletransporte).
- Purpose: evitar cambio brusco. Frecuencia: ocasional/rara. 200ms.
- Owner: `components/ui/empty-state.tsx:16-21` (componente único; un cambio lo hereda toda la app).
- Uncertainty: none.

## Design decision

Fade + zoom sutil desde 95% (nunca desde 0), 200ms, en el contenedor raíz del componente. Con movimiento reducido: solo fade (más suave, no cero).

## Changes (paso a paso)

1. `components/ui/empty-state.tsx` (~línea 18)
   - Busca dentro del `cn(` del div raíz la cadena:
     `"flex flex-col items-center justify-center gap-3 rounded-lg border bg-card p-8 text-center shadow-sm"`
   - Sustitúyela por:
     `"flex flex-col items-center justify-center gap-3 rounded-lg border bg-card p-8 text-center shadow-sm animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:zoom-in-100"`
   - Nota: `motion-reduce:zoom-in-100` mantiene el fade y anula el zoom — NO uses `animate-none` aquí.

- Preserve: la prop `className` sigue mergeándose después (los consumidores pueden sobreescribir).

## Validation

- Product: en `/contactos` busca algo sin resultados, o abre `/transacciones` de una delegación vacía → el estado vacío entra con fade+zoom sutil.
- Interface: modo claro/oscuro; con "reducir movimiento" solo hace fade.
- Repository: `grep -n "zoom-in-95" components/ui/empty-state.tsx` → 1 coincidencia; `npx tsc --noEmit` sin errores nuevos.

## Stop conditions

- Para si el div raíz ya tiene clases `animate-in`.

## Design documentation

- None.
