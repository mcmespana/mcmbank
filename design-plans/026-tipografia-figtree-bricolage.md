# 026 · Tipografía: Geist → Figtree + Bricolage Grotesque

**Superficie:** global · **Riesgo:** alto · **Requiere visto bueno humano antes de ejecutar**

## Contexto

`app/layout.tsx` carga Geist y Geist Mono vía `next/font/google`. `design.md` §3.2 fija para
las cuatro apps **Figtree Variable** (texto e interfaz) y **Bricolage Grotesque Variable**
(display, solo ≥24 px y pesos 600–800), autoalojadas con Fontsource, más **JetBrains Mono**
para códigos e IBAN.

Geist no está mal; el problema es que cada app lleva una tipografía distinta y la letra es lo
primero que hace que dos productos parezcan de la misma casa o no. Figtree se eligió en
Recursos por legibilidad en tamaños pequeños y buen comportamiento con diacríticos españoles,
que es exactamente lo que pide una tabla de movimientos.

**Este plan cambia la cara de la app. No lo ejecutes sin confirmación explícita.**

## Qué hacer

1. `pnpm add @fontsource-variable/figtree @fontsource-variable/bricolage-grotesque @fontsource-variable/jetbrains-mono`
   (y después `npx pnpm install` si has usado npm, ver `CLAUDE.md`).
2. Importarlas en `app/globals.css`, arriba del todo.
3. En `app/layout.tsx`, quitar `Geist`/`Geist_Mono` y las variables `--font-geist*`; dejar el
   `<html>` solo con `antialiased`.
4. En `tailwind.config.ts`, `fontFamily`: `sans` → `'Figtree Variable', ui-sans-serif, system-ui`;
   `display` → `'Bricolage Grotesque Variable', var(--font-sans)`;
   `mono` → `'JetBrains Mono', ui-monospace, monospace`.
5. En `app/globals.css`, `h1, h2 { font-family: theme(fontFamily.display) }`.
6. Barrer `font-mono`: debe quedar **solo** en códigos, IBAN, identificadores y logs. Los
   importes van con `tabular-nums`, no con mono (§3.2).
7. Comprobar la escala fija de §3.2: si aparece un `text-[13px]` o similar, ajústalo.

## Validación

`pnpm build`. Comparar capturas antes/después de `/transacciones` (densidad: la fila no debe
crecer), `/facturas` (el panel no debe desbordar: va en un contenedor `overflow-hidden`),
`/informes` y el dashboard. Comprobar que no hay FOUT: las fuentes se sirven desde el propio
dominio, no desde `fonts.gstatic.com`.
