# 021 · Botones a la escala del sistema

**Superficie:** global · **Riesgo:** alto (es el cambio más visible de todos) · **Depende de:** `020`

## Contexto

`components/ui/button.tsx` viene de la estética v0 y choca con `design.md` §3.3 y §5:

- `rounded-2xl` (16 px) en un control de 44 px → cápsula (§5.5)
- `h-11` por defecto (44 px) frente a los 32 px del sistema; en una barra de acciones de
  tabla eso es un muro
- `shadow-sm hover:shadow-lg` → la sombra no es elevación, es decoración (§3.3)
- `backdrop-blur-sm/md` decorativo en todas las variantes (§5.1)
- `active:scale-95` en cada botón de la app (§5.3)

El resto de las primitivas nuevas del repo (`StatusPill`, `ListRow`, `FilterTabs`) ya están
en la estética sobria. El botón es lo que hace que la app siga pareciendo otra cosa.

## Qué hacer

En `components/ui/button.tsx`, sustituir `buttonVariants` por:

- **base:** quitar `shadow-sm hover:shadow-lg` y `active:scale-95`; `rounded-2xl` →
  `rounded-md`; mantener `transition-[color,background-color,border-color,box-shadow]`
  a 150 ms, el anillo de foco y `[&_svg]:size-4`.
- **variantes:** quitar `backdrop-blur-*` de las cinco. `outline` pasa de `border-2` a
  `border`; `default`/`destructive` pierden el `border border-*/20`.
- **tamaños:** `sm` → `h-7 rounded-sm px-2.5 text-xs`; `default` → `h-8 px-3`;
  `lg` → `h-9 rounded-md px-4`; `icon` → `h-8 w-8`. Añadir `icon-sm` → `h-7 w-7`.
- **`destructive`:** pasar al tinte sobrio (`bg-destructive/10 text-destructive
  hover:bg-destructive/20`), reservando el rojo sólido para el botón que **confirma** un
  borrado dentro de un diálogo. Si esto complica el plan, déjalo para un plan aparte y anótalo.

Después, **barrer los sitios donde el tamaño estaba compensado a mano**:

```bash
grep -rn "h-11\|h-12\|size=\"lg\"" components app
```
En móvil, los botones que quedan por debajo de 44 px de zona sensible necesitan el patrón
`.toque` (§3.3): añade la clase utilitaria a `app/globals.css` copiándola de
`mcmrecursos/app/src/app.css` y aplícala a los botones sueltos de barras y tarjetas.

## Qué NO tocar

`components/ui/list-row.tsx`, `filter-tabs.tsx`, `status-pill.tsx`: ya están bien.
No toques el botón flotante de avisos (44 px es correcto ahí, es un target táctil primario).

## Validación

```bash
pnpm build && pnpm lint
```
Revisar a 390 / 1024 / 1440 px, claro y oscuro: `/transacciones` (barra de selección en
lote), `/facturas` (workspace: la fila de botones del panel no debe desbordar —el panel va
en un contenedor con `overflow-hidden`), `/cuentas`, diálogos de borrado, y el formulario
de login. Comprobar que en móvil ningún botón queda por debajo de 44 px de zona sensible.
