# 028 · Quitar `generator: "v0.app"`

**Superficie:** global · **Riesgo:** ninguno · **Depende de:** nada

## Contexto

`app/layout.tsx` declara `generator: "v0.app"` en la `metadata`. Sale en el HTML de todas las
páginas. La app hace tiempo que no es lo que v0 generó, y el `<meta name="generator">` es
información pública sobre el stack que no aporta nada.

## Qué hacer

Borrar la línea `generator: "v0.app",` de `export const metadata` en `app/layout.tsx`.

## Validación

`pnpm build`; `curl -s localhost:3000 | grep generator` no devuelve nada.
