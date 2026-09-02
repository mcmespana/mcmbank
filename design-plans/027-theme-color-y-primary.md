# 027 · `theme-color` y `--primary` no coinciden

**Superficie:** global · **Riesgo:** muy bajo · **Depende de:** `025` (mejor después)

## Contexto

`app/layout.tsx` declara `<meta name="theme-color" content="#0b42db">` y
`msapplication-TileColor` con el mismo valor. `--primary` es `hsl(217 91% 60%)` ≈ `#3b82f6`.
Son dos azules distintos: la barra del navegador en Android y el mosaico de Windows salen de
un color que no está en la app.

Además no hay `theme-color` para el modo oscuro, así que la barra sale azul brillante sobre
una app oscura.

## Qué hacer

1. Derivar el valor de `--primary` (tras el plan `025`, del token de la rampa) y usarlo en el
   `theme-color`.
2. Declarar **dos**, con `media`:
   ```html
   <meta name="theme-color" media="(prefers-color-scheme: light)" content="…">
   <meta name="theme-color" media="(prefers-color-scheme: dark)"  content="…">
   ```
   El de oscuro debe ser el `--background` oscuro, no el primario: la barra imita la app.
3. Revisar `public/site.webmanifest`: `theme_color` y `background_color` tienen que decir lo
   mismo, o Android usa el del manifest al abrir desde el icono.
4. Quitar `generator: "v0.app"` de la `metadata` mientras estás ahí (plan `028`).

## Validación

`pnpm build`. Abrir en Chrome Android (o simular) en los dos temas y comprobar la barra.
Instalar la PWA y comprobar la pantalla de arranque.
