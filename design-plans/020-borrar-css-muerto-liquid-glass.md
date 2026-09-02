# 020 · Borrar el CSS muerto de "Liquid Glass"

**Superficie:** global · **Riesgo:** muy bajo · **Depende de:** nada

## Contexto

`app/globals.css` define un puñado de clases de la estética original generada con v0 que
**no usa ningún componente**. Comprobado con:

```bash
grep -ro "glass-card\|glass-card-hover\|glass-button\|glass-panel\|transaction-card\|floating" components app
```

El único fichero que aparece es `app/globals.css`. Cero usos en producto.

Además hay **dos** `globals.css`: `app/layout.tsx` importa `./globals.css`, así que
`styles/globals.css` (90 líneas) no se carga nunca y es un despiste esperando a ocurrir —
alguien editará el equivocado.

## Qué hacer

1. En `app/globals.css`, borrar del bloque `@layer components`:
   `.glass-card`, `.glass-card-hover`, `.transaction-card` (y su `::before` y su
   `:hover::before`), `.glass-button`, `.account-avatar`, `.glass-panel`, `.floating` y su
   `@keyframes float`.
   **Antes de borrar `.account-avatar`**, verifica con `grep -rn "account-avatar" components app`:
   si tuviera algún uso, muévela al componente que la usa en vez de borrarla.
2. En el bloque `@media (max-width: 640px)` de `@layer components`, borrar las reglas que
   quedan huérfanas (`.transaction-card`, `.account-avatar`, `.glass-card`). Si el bloque
   se queda vacío, borrarlo entero.
3. Borrar del `:root` y del `.dark`: `--glass-bg`, `--glass-border`, `--glass-shadow`,
   `--glass-shadow-lg`, `--blur-sm`, `--blur-md`, `--blur-lg`.
   Comprobar antes: `grep -rn "glass-shadow\|--blur-" components app tailwind.config.ts`.
4. Borrar el fichero `styles/globals.css`.
5. Dejar intactas `.transaction-amount-positive` y `.transaction-amount-negative`: **sí** se
   usan (son los tokens de `AmountDisplay`, ver plan `004`).

## Qué NO tocar

Nada fuera de `app/globals.css` y `styles/globals.css`. Este plan no cambia ni un píxel de
lo que se ve; si algo cambia visualmente, has borrado de más: revierte y para.

## Validación

```bash
pnpm build && pnpm lint
grep -rn "glass-\|--blur-\|\.floating" app components styles   # sin resultados
```
Abrir `/`, `/transacciones` y `/facturas` en claro y oscuro y comprobar que no ha cambiado nada.
