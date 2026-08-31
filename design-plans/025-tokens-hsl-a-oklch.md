# 025 · Tokens de HSL a OKLCH, con rampa cruda y capa semántica

**Superficie:** global · **Riesgo:** alto · **Depende de:** `020`, `023`

## Contexto

`app/globals.css` define los tokens en HSL sueltos (`--primary: 217 91% 60%`), con
`tailwind.config.ts` envolviéndolos en `hsl(var(--x))`. `design.md` §3.1 pide OKLCH y **tres
capas**: rampa cruda → tokens semánticos → clases. Recursos, la Tienda y la capa `--avd-*` de
Votaciones ya están en OKLCH; Bank es el único que no.

Beneficio concreto, no cosmético: en HSL, aclarar `--primary` para el modo oscuro cambia el
tono percibido, y por eso el azul oscuro de la app se ve más lavado que el claro.

## Qué hacer

1. **Rampa cruda** en `:root`: `--brand-50…900` (azul institucional, el del logo MCM),
   `--n-0…1000` (neutros con sesgo de matiz hacia el azul, ~245°), `--ok/--warn/--bad`
   en `-100/-500/-600`. Todo en `oklch()`. Puedes tomar la rampa de
   `mcmvotaciones/src/index.css` (bloque `--avd-*`), que ya está construida y validada para
   el mismo azul institucional — **eso es exactamente lo que buscamos, que sea la misma**.
2. **Capa semántica**: redefinir `--background`, `--foreground`, `--card`, `--popover`,
   `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`,
   `--ring`, `--chart-1…5` y los `--sidebar-*` apuntando a la rampa, en `:root` y en `.dark`.
3. **`tailwind.config.ts`**: quitar el envoltorio `hsl(...)` y pasar a `var(--x)` a secas.
   Ojo: es un cambio en **todas** las entradas de `colors`, y hay que hacerlo en el mismo
   commit o la app sale en blanco y negro.
4. Comprobar contraste AA en los dos temas de: texto sobre `--background`, `--muted-foreground`
   sobre `--background`, `--primary-foreground` sobre `--primary`, y las cinco de gráfica.
5. Ajustar `--chart-1…5` a la paleta categórica del sistema (§3.9): no reciclar los
   semánticos y no ordenarlas por posición.

## Qué NO tocar

Los `--sidebar-background` con canal alfa (`255 255 255 / 0.8`) dependen de esto: pásalos a
`oklch(… / 0.8)` en el mismo paso, no los dejes a medias.

## Validación

`pnpm build`. Capturas en claro y oscuro de `/`, `/transacciones`, `/facturas`, `/informes`
antes y después: el objetivo es que **no cambie nada perceptible salvo que el oscuro deje de
verse lavado**. Pasar un comprobador de contraste por los pares de arriba.
