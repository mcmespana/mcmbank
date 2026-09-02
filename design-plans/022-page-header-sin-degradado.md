# 022 · `PageHeader` sin degradado

**Superficie:** global · **Riesgo:** bajo · **Depende de:** nada

## Contexto

`components/ui/page-header.tsx` pinta el título con
`bg-gradient-to-r … bg-clip-text` y una franja con `shadow-lg shadow-primary/30`. Contra
`design.md` §5.2 (nada de degradados en texto: es de 2022 y baja el contraste) y §5.4 (nada
de sombras de color). Es, además, lo primero que se ve en cada pantalla.

## Qué hacer

En `components/ui/page-header.tsx`:

1. El `h1` pasa a `text-2xl font-semibold tracking-tight text-foreground` (y `text-3xl` a
   partir de `sm`). Fuera el `bg-gradient-to-r`, el `bg-clip-text` y el `font-extrabold`.
2. La franja de la izquierda: mantenerla como identidad de sección, pero
   `h-8 w-1 rounded-full bg-primary`, sin degradado y **sin `shadow-primary/30`**.
3. Comprobar que ninguna página duplica el patrón a mano:
   ```bash
   grep -rn "bg-clip-text\|shadow-primary" components app
   ```
   y sustituir los que aparezcan por `<PageHeader>`.

## Qué NO tocar

La API del componente (`title`, `actions`) no cambia: ninguna página necesita edición.

## Validación

`pnpm build`. Recorrer `/`, `/transacciones`, `/cuentas`, `/categorias`, `/contactos`,
`/facturas`, `/propuestas` en claro y oscuro. Comprobar contraste AA del `h1` en los dos temas.
