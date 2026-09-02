# 024 · Quitar los `hover:scale` que quedan

**Superficie:** global · **Riesgo:** bajo · **Depende de:** `020`

## Contexto

Quedan **15** usos de `hover:scale` en `components/` y `app/`. En una lista de cuarenta
filas eso es un temblor, y en móvil no significa nada porque el hover no existe (§5.3, §3.7).

## Qué hacer

```bash
grep -rn "hover:scale\|hover:rotate\|hover:-translate-y" components app
```

Para cada uno:

- **Fila de lista, tarjeta de tabla, fila de factura, tarjeta de propuesta** → borrar el
  `scale`. El hover se señala con `hover:bg-muted/50 hover:border-border`, que es lo que ya
  hace `ListRow`.
- **Avatar de cuenta / logo de proveedor** → borrar `hover:scale-110 hover:rotate-6`. Si el
  avatar es *clicable* y hace falta señalarlo, `hover:ring-2 hover:ring-primary/40`.
- **Botón** → ya lo cubre el plan `021`; si queda alguno, borrar.
- **Excepción admitida:** un elemento único y grande cuyo hover es la única affordance de
  una acción no obvia (p. ej. la miniatura del documento en la bandeja de facturas). Si
  decides conservar uno, deja un comentario de una línea diciendo por qué.

## Qué NO tocar

`active:scale-*` en el botón lo retira el plan `021`; no lo dupliques aquí.

## Validación

`pnpm build`. Recorrer `/transacciones` con ~50 filas y pasar el ratón en diagonal por la
lista: no debe moverse nada. Comprobar que cada elemento clicable sigue teniendo una señal
de hover visible.
