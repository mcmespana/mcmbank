# 023 · `--radius` a 0,625 rem y barrido de `rounded-2xl`

**Superficie:** global · **Riesgo:** medio · **Depende de:** `021`

## Contexto

`app/globals.css` fija `--radius: 1rem`. `design.md` §3.3 fija el radio base del sistema en
**0,625 rem (10 px)**, que es el que ya usan Recursos y (en su capa `--avd-*`) Votaciones.
Con 1 rem, `rounded-lg` = 16 px y cualquier control pequeño sale con forma de cápsula (§5.5).

Recuento actual en `components/`: 24 usos de `rounded-2xl`, 67 de `rounded-xl`, 101 de
`rounded-lg`.

## Qué hacer

1. En `app/globals.css`, `--radius: 0.625rem`.
2. En `tailwind.config.ts`, ampliar `borderRadius` para tener la escala completa del sistema:
   `sm: calc(var(--radius) - 4px)`, `md: calc(var(--radius) - 2px)`, `lg: var(--radius)`,
   `xl: calc(var(--radius) + 4px)`.
3. Barrer `rounded-2xl` y `rounded-3xl`:
   ```bash
   grep -rn "rounded-2xl\|rounded-3xl" components app
   ```
   - Superficies grandes (tarjeta de dashboard, hoja, diálogo, panel de facturas) → `rounded-xl`.
   - Todo lo demás → `rounded-lg`.
   - `rounded-full` **solo** en avatares, pills, puntos de estado y el botón flotante de avisos.
4. Revisar `rounded-xl` en controles pequeños (botones `sm`, inputs, chips) → `rounded-md`.

## Qué NO tocar

`EntityAvatar`, `BankAvatar` y los puntos de `StatusPill`/`FilterTabs`: `rounded-full` es
correcto ahí.

## Validación

`pnpm build`. Recorrido visual completo a 390 / 1440 px, claro y oscuro. Prestar atención a
los sitios donde un radio grande tapaba un problema de alineación: la banda `border-l-4` de
`ListRow` y las miniaturas de `FileThumbnail`.
