# 029 · Rojo destructivo en dos variantes, y los restos de Liquid Glass

**Superficie:** global · **Riesgo:** bajo · **Depende de:** `021` (hecho)

## Contexto

Los planes `020`–`028` dejaron MCM Bank dentro del sistema, pero apartaron a
propósito tres cosas que no cabían sin ensanchar aquellos commits.

## Qué hacer

### 1. Separar el rojo que confirma del rojo que solo abre

Hoy `variant="destructive"` es rojo sólido y lo usan catorce sitios, con dos
significados distintos:

- **Confirmar** dentro de un diálogo (`delete-factura-dialog`,
  `delete-category-dialog`, `delete-account-dialog`, `delete-contacto-dialog`,
  `delete-pago-mcm-dialog`, y los botones finales de `transaction-files`,
  `informes-page`…). Ahí el rojo sólido es correcto: conviene que pese.
- **Abrir** ese diálogo desde una fila, una barra o una tarjeta
  (`configuration-manager:183`, `factura-archivos:175`, `file-list:317`,
  `config-page:259`, `transaction-manager:976`). Ahí grita de más: la acción
  peligrosa todavía no ha pasado.

Añadir a `components/ui/button.tsx` la variante que ya se escribió y se retiró
por no dejar API sin usar:

```ts
destructiveGhost:
  "bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/15 dark:hover:bg-destructive/25",
```

y pasar a ella **solo** los sitios del segundo grupo. Comprueba caso por caso
si el botón abre un diálogo o si es el que ejecuta: si ejecuta, se queda rojo
sólido.

### 2. Restos de Liquid Glass fuera de los botones

```bash
grep -rn "backdrop-blur" components app --include=*.tsx
```

Quedan en la tarjeta del login (`border-2 border-border/30 shadow-2xl
backdrop-blur-2xl`), en `tabs.tsx` (`bg-muted/60 backdrop-blur-xl`), en la
barra superior y en algún contenedor suelto. `design.md` §5.1 reserva el
`backdrop-filter` a **una** barra pegajosa por app: quédate con la de la barra
superior si la mejora, y quita el resto. Las `shadow-2xl` y `border-2` de esos
mismos sitios, con ellas (§3.3).

### 3. `hidden sm:inline` en `category-list`

`components/categories/category-list.tsx` esconde el texto «¿Qué añado en cada
categoría?» por debajo de `sm`, contra `design.md` §5.8. Es un botón de ayuda
con icono, así que el arreglo no es enseñar el texto —no cabe— sino dejar el
icono con un `aria-label` claro y el `title` que ya tiene, y comprobar que se
entiende sin él. Si no se entiende, mover la ayuda a otro sitio.

## Qué NO tocar

Las tarjetas de `quick-actions` del dashboard llevan degradados de color por
categoría de acción. Son un caso aparte —decorativo y deliberado— y merecen su
propia decisión de producto, no un barrido.

## Validación

`pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Recorrer en claro y
oscuro los cinco diálogos de borrado y las cinco pantallas del grupo 2,
comprobando que se distingue de un vistazo cuál es el botón que borra de verdad.
