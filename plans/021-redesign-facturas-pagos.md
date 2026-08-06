# Rediseño de Facturas y Pagos MCM

Written against: 6046c7a

> **Para el agente ejecutor:** este plan es autocontenido — no necesitas ningún
> contexto de la conversación que lo generó. Lee las secciones "Contexto",
> "Principios" y "Reutilizar" antes de tocar nada. Todos los números de línea están
> tomados de `6046c7a`; si un excerpt no cuadra con el código actual, re-localízalo
> por contenido. Si un paso entero ya no tiene sentido, **PARA**, marca BLOCKED con
> una línea de motivo en `plans/README.md` y no improvises.
>
> Rama de trabajo: `claude/redesign-facturas-pagos-iiel8m`.
>
> Su fila ya está en la tabla de `plans/README.md`; actualiza el estado (`IN PROGRESS`
> → `DONE (fecha)`) al avanzar, como pide ese README.

---

## Contexto

`/facturas` y `/pagos-mcm` se construyeron después del resto de la app (PR #159) y se
hicieron copiando el uno del otro, no copiando el patrón de Movimientos. `plans/README.md`
lo dice literalmente: es *"the largest unaudited surface"*. Síntomas verificados:

| Queja del usuario | Causa en el código |
|---|---|
| "Parecen otra aplicación separada" | Movimientos lista **filas compactas en una columna** (`transaction-list-row.tsx:91`); Facturas y Pagos listan **tarjetas altas en rejilla 2-3 columnas** (`facturas-manager.tsx:281`, `pagos-mcm-manager.tsx:310`) |
| "Las cards para las pagadas son malísima idea, se ve todo apilado" | `factura-card.tsx` mete en cada tarjeta el bloque de proveedor (`:102-142`), los chips de archivos (`:145-161`) **y** una fila verde por cada movimiento vinculado (`:164-188`). Una factura pagada en 3 plazos mide ~400 px |
| "Tienen mucho texto" | Párrafo de 3 renglones bajo cada `h1`; 4 KPI cards; `descripcion` de cada estado bajo los selects; ayudas de 11 px en casi todos los campos; tarjeta "Próximamente" con roadmap; el `Alert` más largo de la app en `marcar-pagado-dialog.tsx:164-171` |
| "En móvil solo se ven iconos de colores inentendibles" | `TabsList grid w-full grid-cols-4` con `<span className="hidden sm:inline">` + `<span className="sm:hidden">{label.slice(0,3)}</span>` (`facturas-manager.tsx:225-226`, `pagos-mcm-manager.tsx:254-255`). En 375 px cada pestaña es un cuarto de pantalla con un punto de color, tres letras (`Ban` `Sin` `Pag` `Tod`) y un número |
| "Requieren muchos clicks para revisar" | Revisar+conciliar una factura son 3 superficies: dropzone → tarjeta → Sheet `FacturaForm` → cerrar → `VincularMovimientoDialog`. Los candidatos viven en un diálogo **separado del formulario donde escribes el importe que los determina** |
| "Los formularios no son los más claros" | `pago-mcm-form.tsx` = 461 líneas, 11 campos planos sin agrupar, con un panel condicional de gasolina en medio y un campo `importe` que se auto-deshabilita |
| "El selector de categorías no es el que toca en pagos" | `pago-mcm-form.tsx:380-393` usa un `<Select>` plano. El canónico es `CategoryChip` + `CategoryMegaSelector`. Y `factura-form.tsx` **recibe `categorias` por props y no las usa** (`:37`, `:263`) |

**Y más, que el usuario no podía ver pero también hay que arreglar:**

- **Doble consulta.** Cada manager llama a su hook **dos veces** —filtrada y sin filtro
  sólo para los contadores (`facturas-manager.tsx:84-90`, `pagos-mcm-manager.tsx:74-80`)—
  y ninguno tiene `limit`/`range`. Facturas son **4 round-trips** por fetch (2× `factura`
  + 2× `archivo_adjunto`, porque `attachArchivosToFacturas` es una segunda query,
  `database.ts:809`).
- **Contadores obsoletos en Pagos.** `pagos-mcm-manager.tsx:80` destructura `totals` sin
  `refetch`, así que los KPI y los contadores de pestaña **no se actualizan tras crear,
  editar, borrar ni marcar pagado** hasta la siguiente revalidación al foco (≥10 s).
  Facturas sí lo hace bien (`refetchTotals`).
- **`sinPagarImporte` está mal calculado.** `use-facturas.ts:138-140` suma el importe
  **completo** de las facturas `pagada_parcial`; una factura de 3.000 € con 1.500 € ya
  vinculados aporta 3.000 € al KPI. `importePendienteFactura()` ya existe
  (`lib/utils/facturas.ts:92`) y no se usa ahí.
- **Índice roto.** `idx_factura_delegacion_importe_sin_movimiento` (`scripts/047:64`) es
  parcial sobre `WHERE movimiento_id IS NULL`, columna que `scripts/048:15` elimina. El
  índice que sostiene la búsqueda de candidatos por importe **ya no existe**.
- **RLS sin `WITH CHECK`.** Las políticas UPDATE de `pago_mcm` (`041:130-141`), `factura`
  (`047:139-150`) y `archivo_adjunto` (`042:70-81`) tienen `USING` pero no `WITH CHECK`:
  una fila que puedes editar se puede mover a **otra delegación**.
- **Tipos sin unión.** `PagoMcmEstado`/`PagoMcmTipoCalculo`/`PagoMcmGasolinaPreset` se
  derivan de la Row generada, que los tipa como `string` (`supabase-generated.ts:1260`),
  así que `Record<PagoMcmEstado, …>` es `Record<string, …>`. `pago-mcm-card.tsx:35-37`
  hace `PAGO_MCM_TIPO_CALCULO_INFO[pago.tipo_calculo].icon` sin guardas: **revienta** con
  cualquier valor inesperado. `FacturaEstado` es una unión escrita a mano justo por esto
  (`lib/types/database.ts:86`).
- **N+1.** `getCuentaConMasMovimientos` (`database.ts:696-712`) lanza una query `count`
  **por cada cuenta** de la delegación, en `Promise.all`.
- **Diálogos sin `max-h`.** `components/ui/dialog.tsx:41` no pone altura máxima ni scroll.
  `transfer-run-dialog` apila 6 bloques y `marcar-pagado-dialog` 5: en un móvil desbordan
  sin poder hacer scroll.
- **Afordancias sólo al hover.** Copiar importe y copiar IBAN en `pago-mcm-card.tsx:100,134`
  son `opacity-0 group-hover:opacity-100`: **invisibles en táctil**. Los botones de acción
  son `h-7 w-7` (28 px, por debajo de los 44 px de objetivo táctil).
- **`Enter` doble en Modo transferencia.** El handler global de `transfer-run-dialog.tsx:111-112`
  excluye `INPUT`/`TEXTAREA`/`SELECT` pero **no `BUTTON`**: pulsar Enter con una fila de
  copia enfocada copia *y* marca el pago como hecho.
- **Fecha ISO cruda** en el explicativo de `transfer-run-dialog.tsx:342-348`, y ese diálogo
  —el masivo— **no avisa de que no mueve dinero de verdad**, mientras que el individual sí.
- **Copia equivocada:** `marcar-pagado-dialog.tsx:169` dice "vincúlalo desde la pestaña
  anterior" señalando a la pestaña *siguiente*.
- **`deleteFactura` deja huérfanos** en Storage: borra las filas de `archivo_adjunto` pero
  no los objetos del bucket (`database.ts:919`), al contrario que `useFacturaArchivos.deleteFile`.
- **`pago-mcm-archivos.tsx:39-45` es `multiple: false`**: en un móvil, quien elige varias
  fotos de tickets sube una sola, sin aviso. `factura-archivos.tsx` sí acepta varias.
- **`app/facturas/loading.tsx` no existe**, `app/pagos-mcm/loading.tsx` sí.

**Resultado buscado:** que las dos secciones se sientan la misma app que Movimientos
—mismo esqueleto, mismas filas, mismos selectores, misma densidad—, con el flujo principal
de cada una resuelto en un solo panel, usables en móvil, y sin los defectos de datos y
seguridad de arriba.

### Decisiones ya tomadas por el usuario — no volver a preguntar

1. **Híbrido**: la Bandeja de Facturas mantiene tarjetas **con miniatura del documento**;
   todo lo demás (resto de pestañas de Facturas y todo Pagos) pasa a **filas densas
   alineadas**.
2. Las dos secciones siguen **separadas** en el sidebar, compartiendo esqueleto.
3. Alcance completo: UI, componentes, hooks, servicios **y migraciones SQL**.
4. **Se eliminan**: los párrafos descriptivos del header, la fila de 4 KPI cards y el
   selector de "Estado" de los formularios. La tarjeta **"Próximamente" se mantiene**
   (se hace discreta).

---

## Principios

1. **Movimientos y Contactos son la referencia.** Ante cualquier duda de layout, densidad
   o interacción, copiar de `components/transactions/` o `components/contactos/`. No
   inventar patrones.
2. **Una fila = un registro, una sola columna.** Nunca rejillas de tarjetas para listas de
   datos. Única excepción autorizada: la Bandeja de Facturas, donde ver el documento *es*
   el trabajo.
3. **Nunca un `<table>` real.** El repo no usa tablas para listas: la "sensación de tabla"
   se consigue con una cabecera de columnas `hidden lg:grid` sobre filas-tarjeta. Es lo
   único que sobrevive a un móvil sin lógica de ocultar columnas.
4. **Click en la fila abre el detalle.** En la fila queda sólo la acción primaria del
   estado; el resto va a un menú `⋯`.
5. **El texto explicativo va al manual, no a la interfaz.** `docs/07-facturas.md` y
   `docs/08-pagos-mcm.md` ya lo explican. En la UI: un `title` o nada.
6. **Sin etiquetas de navegación ocultas ni truncadas.** Prohibido `hidden sm:inline` y
   `.slice(0,3)` en pestañas. Si no cabe, hace scroll.
7. **Nada importante detrás de un hover.** En táctil no existe. Las afordancias de copia y
   las acciones de fila deben ser visibles o estar en el menú `⋯`.
8. **Objetivo táctil mínimo 36 px** (`h-9 w-9`) en botones de icono de las filas nuevas.

### Escalera de z-index (respetarla o los popovers desaparecen)

`Sheet`/`Dialog` base `z-50` → sheet de detalle `z-[60]` → sheet anidado (crear contacto)
`z-[70]` → `PopoverContent` de `ContactoSelector` y `DateField` `z-[80]`.

### Reutilizar — no reimplementar

| Ya existe | Ruta | Uso aquí |
|---|---|---|
| `CategoryChip` | `components/transactions/category-chip.tsx:18` | **El campo de categoría** en los formularios: pill de color + X para limpiar + estado vacío "＋ Etiquetar" + diálogo `CategoryMegaSelector` gratis |
| `CategoryMegaSelector` | `components/transactions/category-mega-selector.tsx:14` | Lo abre `CategoryChip`; host `DialogContent className="max-w-3xl w-full p-0 overflow-hidden"` |
| `CategoryQuickCreateSheet` | `components/transactions/category-quick-create-sheet.tsx:10` | Crear categoría al vuelo, con el patrón `pendingCategoryAssignRef` de `transaction-manager.tsx:141-142, 289-303` |
| `ContactoSelector` | `components/contactos/contacto-selector.tsx:21` | Ya usado en los dos formularios: **mantener**. Incluye el aviso ⚠ de proveedor sin NIF |
| `ContactoForm` | `components/contactos/contacto-form.tsx:35` | Sheet anidado `z-[70]`; copiar el host de `transaction-detail.tsx:676-700` |
| `AmountDisplay` | `components/amount-display.tsx` | Importes de las filas, `size="sm"` |
| `EntityAvatar` | `components/ui/entity-avatar.tsx` | Avatar de proveedor/beneficiario, siempre con `seed={`contacto:${id}`}` |
| `StatusPill` | `components/ui/status-pill.tsx:23` | Pills de estado |
| `MoneyInput` + `parseMoney`/`formatMoney` | `components/ui/money-input.tsx` | Importes en formularios. Sustituye los `Input inputMode="decimal"` + `replace()` a mano de `factura-form.tsx:153-166` y `pago-mcm-form.tsx` (×3) |
| `DateField` | `components/ui/date-field.tsx` | Fechas. Sustituye los `Input type="date"` de `marcar-pagado-dialog.tsx:193` y `transfer-run-dialog.tsx:268` |
| `EmptyState` | `components/ui/empty-state.tsx` | Los tres vacíos (error / sin datos / sin resultados), CTA como `children` |
| `ScrollArea` | `components/ui/scroll-area.tsx` | Contención de scroll en los sheets de detalle |
| `useIsMobile(1024)` | `hooks/use-is-mobile.ts` | Sólo si el layout no se puede resolver con CSS |
| `useClipboard` | `hooks/use-clipboard.ts` | Copiar IBAN desde la fila |
| `useDebouncedState` | `hooks/use-debounced-state.ts` | Buscador (ya usado, 250 ms) |
| `runQuery` | `lib/db/query.ts` | Envoltorio con timeout, reintento de auth y telemetría. Los hooks de facturas/pagos **no** lo usan hoy; deben usarlo |
| `FACTURA_ESTADO_INFO`, `FACTURA_ORIGEN_INFO`, `scoreCandidatoMovimiento`, `esMatchDirecto`, `importePendienteFactura`, `importePagadoFactura`, `margenImporteFactura` | `lib/utils/facturas.ts` | **La lógica de conciliación está bien. No tocarla.** Sólo cambia dónde se muestra |
| `PAGO_MCM_ESTADO_INFO`, `PAGO_MCM_TIPO_CALCULO_INFO`, `PAGO_MCM_GASOLINA_PRESETS(_ORDER)`, `calcularImporteGasolinaKm`, `inferirPresetGasolina` | `lib/utils/pago-mcm.ts` | Igual: la lógica está bien |
| `COPY_FORMATS`, `getPagosTransferibles`, `getConceptoTransferenciaSugerido`, `formatearIban` | `lib/utils/copy-formats.ts`, `lib/utils/transferencia.ts` | Copiar IBANes: mantener |
| `formatCurrency`, `formatDate`, `getAmountColorClass`, `toLocalDateString` | `lib/utils/format.ts` | Formato |
| `hooks/use-cuentas.ts` | — | **Plantilla exacta** de migración a TanStack Query (documenta los tres sustos: `EMPTY` estable, `select` con `useCallback`, `loading: isPending && fetchStatus !== "idle"`) |
| `assert_delegacion_member()` + patrón `SECURITY DEFINER STABLE` + `REVOKE anon` | `scripts/049_secure_aggregation_rpcs.sql:35-51` | Plantilla exacta de las RPC nuevas |
| `PageSkeleton` | `components/ui/page-skeleton.tsx` | `loading.tsx` |

**No mirar como referencia:** `components/transactions/transaction-table.tsx` y
`transaction-form.tsx` son **código muerto** (cero imports en todo el repo); son un diseño
anterior abandonado. Tampoco ejecutar `plans/003-bulk-export-facturas.md` ni
`plans/004-…`: están sin ejecutar y pendientes de revisión de mantenedor.

---

## Fase 0 — Primitivos compartidos

Se crean en `components/ui/` porque los usan las dos secciones (y Contactos en la fase 5).

### `components/ui/page-header.tsx` — `PageHeader`
El header grande con barra de degradado está duplicado literalmente en seis superficies y
**es el patrón dominante del repo** (6 frente a 3 compactos); Movimientos es el outlier
porque es el único shell de altura completa. Así que **se conserva el header grande** y se
extrae.

```
PageHeader({ title, actions })
```
- **Sin prop de descripción**: el párrafo se elimina, no se hace opcional (decisión 4).
- Valores del **exemplar canónico `app/cuentas/page.tsx:8-16`**, no de los actuales:
  `gap-4` entre barra y título, `h1 text-4xl font-extrabold` + el gradiente
  `bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text`.
  Barra: `h-10 w-2 rounded-full bg-gradient-to-b from-primary via-primary/70 to-primary/40 shadow-lg shadow-primary/30`.
  Facturas/Pagos/Contactos usan hoy la variante desviada (`gap-3`, `text-3xl sm:text-4xl`);
  `design-plans/001` ya prescribió corregirla y está marcada DONE sin haber llegado al código.
- `actions` en un `flex items-center gap-2`; el contenedor exterior
  `flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between`.
- Usarlo en Facturas y Pagos en esta fase. Migrar Cuentas/Dashboard/Categorías/Contactos es
  mecánico: hacerlo en un commit aparte al final si queda tiempo (esto cierra `design-plans/001`).

### `components/ui/filter-tabs.tsx` — `FilterTabs`
**Este es el arreglo del bug de móvil.** Sustituye los dos `TabsList grid-cols-4`.

```
FilterTabs({ value, onValueChange, items: { value, label, count?, dotClass? }[] })
```
- Sobre `@radix-ui/react-tabs` (ya envuelto en `components/ui/tabs.tsx`) para conservar
  navegación por teclado y roles ARIA. Usar `Tabs`+`TabsList`+`TabsTrigger` sin
  `TabsContent`: en este repo las pestañas de página son un control de filtro y el
  filtrado se hace con un `useMemo`/query aparte (`contactos-manager.tsx:78-81`).
- Móvil: `flex overflow-x-auto snap-x snap-mandatory` con
  `[scrollbar-width:none] [&::-webkit-scrollbar]{display:none}`; cada trigger
  `shrink-0 snap-start`. **Etiqueta completa siempre.** Sin `grid-cols-*`, sin `hidden`,
  sin `slice()`.
- `sm+`: `inline-flex w-fit` centrado con `sm:mx-auto`, como el resto del repo.
- `count`: pastilla `rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-xs font-medium min-w-[1.25rem] text-center tabular-nums`,
  copiada de `tab-with-counter.tsx:37`, con tope `99+`.
- `dotClass`: punto de 6 px **antes** de la etiqueta, nunca en su lugar.
- Degradado de desvanecido a los lados en móvil para indicar que hay scroll.
- Al cambiar de pestaña: `scrollIntoView({ block: "nearest", inline: "center" })`.
- Ojo con el `TabsList` heredado: hoy es `h-12 rounded-2xl bg-muted/60 backdrop-blur-xl p-1.5 border shadow-lg`.
  Conservar ese aspecto; sólo cambia el sistema de layout.

### `components/ui/list-row.tsx` — `ListRow` + `ListHeaderRow`
Da a Facturas y Pagos la densidad de Movimientos.

- `ListRow({ accentClass?, onClick, selected?, className?, children })`. Clases base
  **copiadas de `transaction-list-row.tsx:91`**:
  `bg-card rounded-lg border border-border/50 p-3 hover:bg-muted/50 hover:border-border transition-[background-color,border-color,box-shadow] duration-150 cursor-pointer shadow-sm hover:shadow-md`.
  `accentClass` pinta la banda de estado como `border-l-4 border-l-*` (mismo mecanismo que
  el aviso ámbar de "sin categoría" de esa línea), **no** como el `absolute w-[3px]` de las
  tarjetas actuales. `selected` → `border-primary/60 bg-primary/5 ring-1 ring-primary/40`.
  `role="button"`, `tabIndex={0}`, `Enter`/`Space`.
- `ListHeaderRow({ className, children })`: `hidden lg:grid`, texto
  `text-[10px] uppercase tracking-widest text-muted-foreground`, `px-3 pb-1`.
- Cada sección exporta su plantilla de columnas en **una** constante `ROW_COLS` compartida
  entre su cabecera y su fila, para que estén alineadas por construcción.
- Contenedor de la lista: `space-y-1 p-2 sm:p-4` (como `transaction-list.tsx:114`).

### `components/ui/action-menu.tsx` — `ActionMenu`
No existe `dropdown-menu` en `components/ui/`. Construirlo sobre `Popover`, con el estilo
del menú de formatos de copia (`pagos-mcm-manager.tsx:176-193`).
```
ActionMenu({ items: { label, icon?, onSelect, destructive?, disabled? }[], align?, ariaLabel })
```
Trigger `MoreHorizontal`, `h-9 w-9` (objetivo táctil). Cierra al elegir. `destructive` →
`text-destructive`. Es lo que permite dejar en la fila sólo la acción primaria.

### `components/ui/file-thumbnail.tsx` — `FileThumbnail`
Miniatura del documento para las tarjetas de la Bandeja.
```
FileThumbnail({ url, mimeType, nombre, className })
```
- `image/*` → `<img loading="lazy" className="object-cover">`.
- `application/pdf` → `<iframe src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&page=1`}
  className="pointer-events-none" scrolling="no" tabIndex={-1} aria-hidden>` escalado con
  `transform: scale()` dentro de un `overflow-hidden`.
- Otro tipo, o `onError` → mosaico de fallback con `FileText` + la extensión.
- **Montaje diferido con `IntersectionObserver`**: no montar el `iframe` hasta que entra en
  viewport y desmontarlo al salir. Sin esto, 40 iframes de PDF hunden la página. Reusar la
  forma del observer de `transaction-list.tsx:52-71`.
- Los buckets `facturas`/`documentos` son públicos, así que `url_publica` sirve directamente.
- Dejar un `// TODO` apuntando a la solución limpia a medio plazo (columna `miniatura_path`
  en `archivo_adjunto` generada por una Edge Function). **No implementarla ahora.**

### `components/ui/dialog.tsx` — arreglo de desbordamiento en móvil
`DialogContent` (`:41`) no tiene altura máxima ni scroll. Añadir
`max-h-[calc(100dvh-2rem)] overflow-y-auto` a las clases base. Es un cambio de una línea
que arregla **todos** los diálogos de la app; revisar después los diálogos grandes
(`transaction-manager.tsx:942-1134`, `category-chip.tsx:83`) para confirmar que ninguno
dependía del desbordamiento. Si alguno se rompe, aplicar la clase por diálogo en
facturas/pagos en lugar de en la base, y registrarlo.

---

## Fase 1 — Capa de datos

### `scripts/052_facturas_pagos_resumen_e_integridad.sql` (nueva migración)

Copiar literalmente el patrón de `scripts/049`: `LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'`, primera línea `PERFORM assert_delegacion_member(p_delegacion_id);`,
y al final `REVOKE ALL ON FUNCTION … FROM anon, public;` + `GRANT EXECUTE … TO authenticated;`.

**a) RPC de resumen** — sustituyen la segunda consulta completa de cada manager:
```sql
get_facturas_resumen(p_delegacion_id uuid)
  RETURNS TABLE(estado text, n bigint, importe_total numeric, importe_pendiente numeric)
get_pagos_mcm_resumen(p_delegacion_id uuid)
  RETURNS TABLE(estado text, n bigint, importe_total numeric)
```
Una fila por estado; el cliente compone los agregados. **`importe_pendiente` debe ser
`GREATEST(factura.importe - COALESCE(SUM(ABS(movimiento.importe)), 0), 0)`** — la misma
fórmula que `importePendienteFactura()` (`lib/utils/facturas.ts:92`) y que
`recalcular_estado_factura()` (`scripts/048:48-84`). Esto corrige de raíz el bug de
`use-facturas.ts:138-140`.

**b) RPC para matar el N+1** de `getCuentaConMasMovimientos` (`database.ts:696-712`):
```sql
get_cuenta_con_mas_movimientos(p_delegacion_id uuid) RETURNS uuid
```
Un `GROUP BY cuenta_id ORDER BY count(*) DESC LIMIT 1`. El servicio pasa a una sola llamada
con el mismo fallback a `cuentas[0]` si devuelve `NULL`.

**c) Reparar el índice roto.** `idx_factura_delegacion_importe_sin_movimiento`
(`scripts/047:64-66`) es parcial sobre `movimiento_id IS NULL`, columna eliminada por
`scripts/048:15`. Hacer `DROP INDEX IF EXISTS` y crear el equivalente vivo:
```sql
CREATE INDEX IF NOT EXISTS idx_factura_delegacion_importe_abierta
  ON factura (delegacion_id, importe)
  WHERE estado IN ('bandeja','sin_pagar','pagada_parcial');
```

**d) Índices de orden** (los de `(delegacion_id, estado)` **ya existen** en `047:52` y
`041:43` — no duplicarlos):
```sql
idx_factura_delegacion_fecha_emision   ON factura (delegacion_id, fecha_emision DESC NULLS LAST, creado_en DESC)
idx_pago_mcm_delegacion_creado         ON pago_mcm (delegacion_id, creado_en DESC)
```

**e) `WITH CHECK` en las políticas UPDATE.** Añadirlo, con el mismo predicado que el
`USING`, a `pago_mcm` (`041:130-141`), `factura` (`047:139-150`) y `archivo_adjunto`
(`042:70-81`). Sin él, una fila editable se puede mover a otra delegación. Usar
`DROP POLICY IF EXISTS` + `CREATE POLICY` para reemplazarlas.

**f)** Comentario al final del `.sql`, **sin ejecutar**, describiendo la mejora pendiente:
columna generada `tsvector` + índice GIN para buscar facturas también por nombre de
proveedor (hoy el `ILIKE` de `database.ts:858` sólo llega a `concepto`, `numero`, `notas`).

### Migración de los hooks a TanStack Query
React Query **ya está adoptado** (`@tanstack/react-query ^5.101.0`, `contexts/query-provider.tsx`
montado en `contexts/app-providers.tsx:26`, y `hooks/use-cuentas.ts` / `use-informes.ts` /
`use-category-breakdown.ts` migrados). `use-facturas.ts` y `use-pagos-mcm.ts` siguen con el
patrón artesanal de `useState` + `useEffect` + `AbortController` + `Promise.race`.

Migrarlos **usando `hooks/use-cuentas.ts` como plantilla literal**, respetando sus tres
avisos documentados: constante `EMPTY` estable, `select` envuelto en `useCallback`, y
`loading: query.isPending && query.fetchStatus !== "idle"`. Consultar vía `runQuery`
(`lib/db/query.ts`) para heredar timeout, reintento de auth y telemetría — hoy no lo hacen.

1. **Listas con `useInfiniteQuery`.** El repo hace **scroll infinito**, no paginación con
   botón: `transaction-list.tsx:52-71` usa un `IntersectionObserver` sobre un `loadMoreRef`.
   Replicarlo. Páginas de 100. Añadir `.range()` en
   `getFacturasByDelegacion`/`getPagosMcmByDelegacion` (`database.ts:834`, `:411`).
   Query keys: `["facturas", delegacionId, { estados, busqueda, contactoId }]`,
   `["pagos-mcm", delegacionId, { … }]`.
2. **Resumen en su propia query**: `hooks/use-facturas-resumen.ts` y
   `hooks/use-pagos-mcm-resumen.ts`, key `["facturas-resumen", delegacionId]`, llamando a
   las RPC de (a). **Eliminar la segunda invocación del hook** en los dos managers
   (`facturas-manager.tsx:90`, `pagos-mcm-manager.tsx:80`). Esto arregla los contadores
   obsoletos de Pagos sin ningún `refetchTotals` manual.
3. **Invalidación en las mutaciones.** Cada `create`/`update`/`delete`/`link`/`unlink`/
   `convert` hace `queryClient.invalidateQueries` de la lista **y** del resumen, en vez de
   `await fetchRef.current()`. Corregir de paso `deletePago`/`deleteFactura`, que hoy sólo
   filtran el array local y nunca resincronizan (`use-pagos-mcm.ts:111-114`,
   `use-facturas.ts:110-113`).
4. **Orden explícito:** Facturas `fecha_emision DESC NULLS LAST, creado_en DESC` (hoy sólo
   `creado_en desc`, `database.ts:851`); Pagos `creado_en DESC` (hoy `estado asc, creado_en desc`,
   que mezcla estados de forma arbitraria dentro de la pestaña "Todos").
5. Mantener las firmas públicas (`createX`, `linkToMovimiento`, `unlinkFromMovimiento`,
   `convertToMovimiento`…) para no tocar consumidores. La capa de escritura funciona.
6. **`useRevalidateOnFocusJitter` sobra** una vez migrado: React Query ya hace
   `refetchOnWindowFocus: true` (`query-provider.tsx:17`). Quitar las llamadas de estos dos
   hooks. (Sus argumentos `{minMs,maxMs}` ya eran muertos, `use-app-status.ts:121-126`.)

### Tipos — `lib/types/database.ts`
Sustituir las derivaciones que colapsan a `string` por uniones escritas a mano, exactamente
como se hizo con `FacturaEstado` (`:86`):
```ts
export type PagoMcmEstado = "borrador" | "pendiente" | "pagado" | "cancelado"
export type PagoMcmTipoCalculo = "manual" | "gasolina_tickets" | "gasolina_km" | "gasolina_avanzado"
export type PagoMcmGasolinaPreset = "ivaj_0_12" | "min_0_18" | "max_0_20" | "estandar_0_26" | "personalizado"
```
Y estrechar `PagoMcmConRelaciones` con `Omit<PagoMcm, "estado"|"tipo_calculo"|"gasolina_preset"> & {…}`,
igual que `FacturaConRelaciones` (`:106-115`). Esto hace exhaustivos los `Record<…>` de
`lib/utils/pago-mcm.ts:18,70,109` y saca a la luz cualquier acceso sin guarda. Añadir de
todos modos un fallback defensivo donde hoy se desreferencia a ciegas
(`pago-mcm-card.tsx:35-37` desaparece con la fase 3, pero el mismo acceso vive en el nuevo
`pago-mcm-row.tsx`).

### `app/facturas/loading.tsx` (nuevo)
Copiar `app/pagos-mcm/loading.tsx` tal cual (`AppLayout` + `PageSkeleton`).

---

## Fase 2 — Facturas

### `components/facturas/facturas-manager.tsx` (reescritura)
```
PageHeader   "Facturas" + [Nueva factura]                        ← sin párrafo
FilterTabs   Bandeja · Sin cerrar · Pagadas · Todas              ← contadores del resumen
[FacturaInboxDropzone]                                           ← SOLO si tab === "bandeja"
buscador + pastillas de filtro
{ tab === "bandeja"
    ? rejilla de FacturaInboxCard
    : ListHeaderRow + FacturaRow[] }
centinela de scroll infinito
línea discreta "Próximamente"
FacturaDetailSheet · DeleteFacturaDialog · CategoryQuickCreateSheet
```
- **Fuera:** los cuatro `KpiCard` (`:167-206`) y el `KpiCard`/`ACCENT_CLASSES` local del
  final del archivo (`:384-441`). Los números ya están en las pestañas.
- **Fuera:** el párrafo del header (`:143-146`).
- El dropzone sólo en la pestaña Bandeja: es donde tiene sentido y libera altura en el resto.
- **"Próximamente"** (`:313-329`): se mantiene por decisión del usuario, pero pasa a una
  línea `text-xs text-muted-foreground` con los dos iconos al final de la página, sin `Card`
  ni borde punteado.
- Filtros nuevos junto al buscador, como pastillas conmutables (no un panel desplegable):
  **`Sin proveedor`**, **`Sin importe`**, **`Falta NIF`**. Son los tres huecos que impiden
  cerrar una factura y hoy sólo se descubren mirando tarjeta por tarjeta.
- Recortar los `description` de `EmptyState` (`:264-272`) a una frase.
- Cablear el patrón de crear-categoría: `pendingCategoryAssignRef` + `CategoryQuickCreateSheet`,
  copiado de `transaction-manager.tsx:141-142, 289-303`.

### `components/facturas/factura-row.tsx` (nuevo — sustituye `factura-card.tsx`)
`ListRow` con `accentClass` derivado de `FACTURA_ESTADO_INFO[estado].dotClass`. `memo()`.

Columnas en `lg+`, alineadas con `ListHeaderRow`:

| Proveedor | Concepto | Importe | Fecha | Conciliación | |
|---|---|---|---|---|---|
| `EntityAvatar` + nombre + ⚠ si falta NIF | concepto en 1 línea (`line-clamp-1`) + `Nº …` secundario | `AmountDisplay size="sm"`; debajo `Falta 120 €` si es parcial | `fecha_emision` | `StatusPill` + `2 mov.` + 📎 recuento | acción primaria + `ActionMenu` |

- **`md` y abajo, dos líneas:** L1 `avatar · proveedor — concepto` … `importe`;
  L2 `StatusPill · fecha · N mov · 📎`. Nada oculto con `hidden`; todo con
  `min-w-0` + `truncate`/`line-clamp-1`.
- Acción primaria por estado: `bandeja`/`sin_pagar`/`pagada_parcial` → **`Conciliar`**;
  `pagada`/`pagada_fuera` → ninguna, sólo `ActionMenu`.
- `ActionMenu`: Editar · Pagada fuera · Desvincular movimiento · Eliminar.
- **Lo que sale de la fila y pasa al detalle:** los chips de archivos
  (`factura-card.tsx:145-161`) y el bloque verde de movimientos vinculados (`:164-188`).
  Eso es exactamente lo que hace que las pagadas se vean apiladas. En la fila quedan
  recuentos.
- Si hay varios movimientos vinculados, "Desvincular" abre un submenú/diálogo pequeño para
  elegir cuál: la API es `unlinkFromMovimiento(facturaId, movimientoId)` (necesita los dos).

### `components/facturas/factura-inbox-card.tsx` (nuevo)
Tarjeta de la Bandeja, deliberadamente **pequeña** — es triaje, no datos.
- Rejilla `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`, `gap-3`.
- `FileThumbnail` en `aspect-[3/4]`; debajo: nombre (`line-clamp-2`), fecha de subida y,
  si `origen === "email"`, el remitente (`FACTURA_ORIGEN_INFO` ya tiene icono y etiqueta).
- Toda la tarjeta clickable → `FacturaDetailSheet`. Un solo botón visible: `Completar`.
  Eliminar en un `ActionMenu` **siempre visible** (no `group-hover`, principio 7).

### `components/facturas/factura-detail-sheet.tsx` (nuevo) — **el cambio que quita los clicks**
Unifica en un `Sheet` lo que hoy son tres superficies (`factura-form.tsx`,
`vincular-movimiento-dialog.tsx` y las acciones de la tarjeta).

Estructura tomada de **`contacto-detail-sheet.tsx:85-100`**, que es la mejor del repo:
`<SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0 z-[60]">`
con `SheetHeader` fijo y el cuerpo en un `ScrollArea` — así el scroll queda contenido y el
pie de acciones no se va.

1. **Cabecera fija:** proveedor, importe grande, `StatusPill`. Si es parcial, cuánto falta.
2. **Documento:** `FileThumbnail` grande + "Abrir en pestaña nueva" + `FacturaArchivos`
   (reutilizar `components/facturas/factura-archivos.tsx`) para añadir/quitar.
3. **Datos:** los campos de `factura-form.tsx` extraídos a
   `components/facturas/factura-datos-fields.tsx`: proveedor (`ContactoSelector`),
   concepto, importe (**`MoneyInput`**), fecha (`DateField`), nº, notas, y **categoría con
   `CategoryChip`** — hoy `factura-form.tsx` recibe `categorias` y no las usa.
   **Sin selector de Estado** (decisión 4): lo calculan los triggers de `scripts/048`, así
   que ofrecerlo era ofrecer algo que la base de datos iba a sobrescribir. "Pagada fuera"
   pasa a ser una acción explícita del `ActionMenu`.
   Dejar sólo las dos ayudas de 11 px que aportan algo; quitar el resto.
4. **Conciliación:** el cuerpo de `vincular-movimiento-dialog.tsx` **como sección inline**.
   Usa `scoreCandidatoMovimiento` y `esMatchDirecto` sin cambios, conserva la preselección
   del match directo (`:89-93`) y los chips de afinidad (`:195-214`), y **se recalcula al
   editar el importe de la sección 3** — hoy es imposible porque están en superficies
   distintas. Debajo, los movimientos ya vinculados con su botón de desvincular.
5. **Pie pegajoso:** botón primario contextual —`Guardar y conciliar` si hay candidato
   marcado, `Guardar` si no— más `Cancelar`.

**Flujo resultante:** arrastrar archivo → click en la tarjeta → rellenar → *un* botón.
De ~7 pasos y 3 superficies a 3 pasos y 1 superficie.

**Extracción:** mover el cuerpo del diálogo a
`components/facturas/factura-conciliacion-panel.tsx` y que lo consuman tanto el sheet nuevo
como `vincular-movimiento-dialog.tsx`, que se conserva como envoltorio fino porque
`vincular-factura-dialog.tsx` y `transaction-files.tsx:267-271` entran desde el lado del
movimiento.

### A borrar
`components/facturas/factura-card.tsx`. Verificar con `grep -rn "FacturaCard" components/ app/`.

---

## Fase 3 — Pagos MCM

### `components/pagos-mcm/pagos-mcm-manager.tsx` (reescritura)
```
PageHeader   "Pagos MCM" + [Modo transferencia] [Copiar IBANes] [Nuevo pago]
FilterTabs   Pendientes · Borradores · Pagados · Todos
línea de resumen: "12 pagos pendientes · 3.450,00 €"
buscador
ListHeaderRow + PagoMcmRow[]
centinela de scroll infinito
PagoMcmDetailSheet · MarcarPagadoDialog · TransferRunDialog · DeletePagoMcmDialog · CategoryQuickCreateSheet
```
- **Fuera** los cuatro `KpiCard` (`:205-234`) y el `KpiCard`/`ACCENT_CLASSES` local
  (`:387-444`), y el párrafo del header (`:148-152`).
- El único KPI que se echará de menos (importe pendiente) pasa a la línea de resumen, con
  el dato del RPC.
- En móvil las tres acciones del header no caben: dejar `Nuevo pago` visible y agrupar
  `Modo transferencia` + `Copiar IBANes` en un `ActionMenu`. En `sm+`, los tres botones.
- `pendientesConIban` se calcula hoy sobre `pagos`, que está filtrado por la pestaña activa
  (`:94-97`): en la pestaña "Pagados" el contador de Modo transferencia cae a 0. Calcularlo
  desde el resumen o desde una query propia, no desde la lista visible. Reutilizar
  `getPagosTransferibles` (`lib/utils/copy-formats.ts:10`) en lugar del filtro inline.

### `components/pagos-mcm/pago-mcm-row.tsx` (nuevo — sustituye `pago-mcm-card.tsx`)
| Beneficiario | Concepto | Importe | Categoría | Fecha | |
|---|---|---|---|---|---|
| `EntityAvatar` + nombre + ⚠ `Sin IBAN` | concepto + chip de tipo de cálculo si es gasolina | `AmountDisplay size="sm"` | `CategoryChip` de la categoría sugerida | `creado_en` | acción primaria + `ActionMenu` |

- Acción primaria: `pendiente` → **`Marcar pagado`**; `borrador` → **`Confirmar`**, que lo
  pasa a `pendiente` en un click (hoy hay que abrir el formulario y cambiar un select);
  `pagado`/`cancelado` → ninguna.
- **Botón de copiar IBAN en la fila**, siempre visible (`useClipboard`), cuando el contacto
  tiene IBAN. Es la acción más repetida de la sección y hoy exige abrir el menú global de
  copia. Mostrar el IBAN con `formatearIban` y copiar la versión normalizada sin espacios,
  como hace `transfer-run-dialog.tsx`.
- `ActionMenu`: Editar · Duplicar · Cancelar · Desvincular movimiento · Eliminar.
- Móvil en dos líneas, mismo criterio que Facturas.
- **Selección múltiple**, copiando el patrón de `transaction-list-row.tsx:119-162` pero
  **sin depender del hover** (principio 7): checkbox visible cuando la selección está
  activa, y un checkbox de "seleccionar" accesible siempre en táctil. Con selección activa
  aparece una barra de acciones —`Modo transferencia (n)`, `Confirmar borradores (n)`—
  usando la animación de `transaction-manager.tsx:758`
  (`animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none`).

### `components/pagos-mcm/pago-mcm-detail-sheet.tsx` (nuevo)
Misma estructura que el de Facturas (base `contacto-detail-sheet.tsx`): cabecera
(beneficiario, importe, estado) · datos del beneficiario con IBAN copiable · desglose del
cálculo si es gasolina (`120 km × 2 × 0,26 € = 62,40 €`) · justificantes (reutilizar
`pago-mcm-archivos.tsx`) · movimiento vinculado o botón `Marcar pagado` · notas internas ·
acciones.

### `components/pagos-mcm/pago-mcm-form.tsx` (refactor, no reescritura)
461 líneas hoy; el objetivo es que se lea como un formulario y no como un cuestionario.
1. **Categoría sugerida:** sustituir el `<Select>` de `:377-395` por **`CategoryChip`**,
   con `onCreateCategory` cableado al patrón `pendingCategoryAssignRef` +
   `CategoryQuickCreateSheet`. **Este es el bug que señaló el usuario.**
   *Nota:* no usar `CategorySelector` aquí — su botón "Crear nueva categoría"
   (`category-selector.tsx:356-359`) **no tiene `onClick`** y es inerte. Y al cablear
   `CategoryChip` no repetir el fallo de `transaction-list.tsx:144`, que pasa
   `onRequestCreateCategory` a un componente que no lo declara en sus props, dejándolo
   silenciosamente muerto.
2. **Fuera el selector de Estado** (`:397-425`, decisión 4). Se sustituye por dos botones
   de envío en el pie: **`Guardar borrador`** y **`Guardar como pendiente`** — que es
   exactamente lo que documenta `docs/08-pagos-mcm.md:55`. Cancelar y marcar pagado pasan
   al `ActionMenu` de la fila y al detalle.
3. **Modo de importe:** los tres modos pasan de `Select` a un **control segmentado** de una
   línea, con los `shortLabel` que ya existen en `PAGO_MCM_TIPO_CALCULO_INFO`
   (`lib/utils/pago-mcm.ts:70-100`). `gasolina_avanzado` tiene `disabled: true`:
   **no renderizarlo** en vez de renderizarlo apagado con la etiqueta "próximamente".
4. **Agrupar en tres bloques** con `Separator`: *A quién y por qué* (contacto, concepto) ·
   *Cuánto* (modo + importe + justificantes) · *Detalles* (descripción, categoría, notas),
   este último colapsado por defecto.
5. **`MoneyInput`** para importe y precio €/km, y un `Input inputMode="decimal"` limpio para
   los km. Hoy son tres `Input` con `parseFloat(replace(...))` a mano (`:117-120`), que se
   rompe con `1.234.567`. El campo de importe deja de estar `disabled` en modo €/km: pasa a
   ser de sólo lectura con el resultado calculado visible, en un renglón único
   (`120 km × 2 × 0,26 € = 62,40 €`).
6. Recortar las ayudas de 11 px: conservar sólo las de €/km y la de la categoría sugerida.

### `components/pagos-mcm/marcar-pagado-dialog.tsx`
- Las dos vías (`Crear movimiento` / `Vincular existente`) pasan de `Tabs` a control
  segmentado, igual que el formulario.
- **Preseleccionar `Vincular existente` cuando haya algún candidato con importe exacto**;
  si no, `Crear movimiento`. Hoy arranca siempre igual y obliga a comprobar la otra pestaña.
- `Input type="date"` (`:193`) → **`DateField`**.
- Recortar el `Alert` de `:164-171` a una línea, y **corregir "vincúlalo desde la pestaña
  anterior"** (`:169`): Vincular es la opción *siguiente*, no la anterior. Con el control
  segmentado, referirse a ella por su nombre.

### `components/pagos-mcm/transfer-run-dialog.tsx`
- Aceptar el subconjunto seleccionado en la lista: el manager le pasa la selección si hay
  alguna y todos los transferibles si no.
- **Arreglar el atajo de teclado** (`:108-124`): el handler de `Enter` excluye
  `INPUT`/`TEXTAREA`/`SELECT` pero **no `BUTTON`**, así que Enter con una fila de copia
  enfocada copia *y* marca el pago como hecho. Añadir `BUTTON` (o mejor, exigir que el
  foco no esté en un elemento interactivo).
- **Formatear la fecha** del explicativo (`:342-348`): hoy imprime el ISO crudo. Usar
  `formatDate`.
- **Añadir el aviso de que no mueve dinero real**, en una línea. El diálogo individual lo
  tiene y este —el masivo, donde más importa— no.
- `Input type="date"` (`:268`) → `DateField`. Conservar los atajos `→`/`Enter`, la barra de
  progreso y la persistencia de cuenta/fecha entre pasos: eso funciona bien.

### `components/pagos-mcm/pago-mcm-archivos.tsx`
`multiple: false, maxFiles: 1` (`:39-45`) → **`multiple: true`** con bucle secuencial, igual
que `factura-archivos.tsx:29-39`. Hoy quien sube varias fotos de tickets desde el móvil
pierde todas menos una sin aviso. Subir tickets al bucket `documentos` como ahora.

### `lib/services/database.ts`
- `getCuentaConMasMovimientos` (`:696-712`) → una llamada a la RPC nueva.
- `deleteFactura` (`:915-933`): borrar también los objetos de Storage antes de las filas de
  `archivo_adjunto`, con `FileService.deleteFile(path_storage, bucket)`, como hace
  `useFacturaArchivos.deleteFile`. Hoy deja huérfanos en el bucket.
- `findCandidatosMovimientoParaPago` (`:721`) exige **importe exacto**
  (`importe == -Math.abs(importe)`), mientras que la vía de facturas usa
  `margenImporteFactura`. Aplicar el mismo margen aquí para que los dos flujos se comporten
  igual — y así el diálogo encuentra candidatos con diferencias de céntimos.
- Añadir `.range()` a `getFacturasByDelegacion` y `getPagosMcmByDelegacion` para (1).

---

## Fase 4 — Coherencia y limpieza

1. **Contactos hereda el arreglo de móvil.** `contactos-manager.tsx:139-155` tiene
   *exactamente* el mismo bug, y peor: en móvil sus pestañas son **sólo** un punto de color
   y un número (`<span className="hidden sm:inline">{info.shortLabel}</span>`, sin variante
   corta). Migrarlo a `FilterTabs` son ~10 líneas. **Commit aparte.**
2. Repasar que no quede rastro de los patrones retirados:
   `grep -rn "KpiCard\|ACCENT_CLASSES\|grid-cols-4\|slice(0, 3)" components/facturas components/pagos-mcm`
   debe devolver vacío.
3. Los importes en las dos secciones pasan todos por `AmountDisplay`/`formatCurrency`; que
   no queden clases de color sueltas de las tarjetas viejas.
4. `pnpm lint:fix` y revisar los `no-unused-vars` que dejen los imports huérfanos.
5. **Opcional, si queda tiempo y en commits separados:** migrar Cuentas/Dashboard/
   Categorías/Contactos a `PageHeader` (cierra `design-plans/001`) y borrar el código
   muerto `transaction-table.tsx` + `transaction-form.tsx`.

---

## Fase 5 — Documentación

- `docs/07-facturas.md`: reescribir "Flujo básico" (§10-32) al flujo de un solo panel;
  añadir que la Bandeja muestra miniaturas y el resto son filas; quitar la mención al
  selector de estado. **Mantener intacta** la parte "Para el equipo técnico" (§71-152), que
  sigue siendo correcta.
- `docs/08-pagos-mcm.md`: actualizar §24 (ya no hay 4 indicadores arriba), §55 (borrador/
  pendiente son dos botones), §65-79 (segmentado en vez de pestañas), §81-106 (Modo
  transferencia acepta selección). Los marcadores `📸 _Captura…_` se quedan.
- `docs/ANALISIS_MEJORAS.md`: el punto **56** afirma que Facturas e Informes son stubs con
  `enabled: false`; es **falso** (`sidebar.tsx:76-90` los tiene `enabled: true`).
  Corregirlo. Añadir los pendientes que este trabajo deja abiertos: miniaturas persistidas
  en `archivo_adjunto`, búsqueda de facturas por nombre de proveedor, y los enlaces
  bidireccionales no transaccionales (`linkPagoToMovimiento`, `linkFacturaToMovimiento`,
  `database.ts:600`, `:935`).
- **Convención del repo:** los planes funcionales viven en `plans/NNN-*.md` con una fila en
  `plans/README.md`. Añadir `plans/021-redesign-facturas-pagos.md` (este plan, con
  `Written against: <sha>`) y su fila de estado. `plans/README.md` marca facturas/pagos como
  *"the largest unaudited surface"*: dejar constancia de que esta pasada la cubre.
- `CLAUDE.md`: añadir `PageHeader`, `FilterTabs`, `ListRow`, `ActionMenu` y `FileThumbnail`
  al inventario de `components/ui/`, y una línea en "Styling Conventions" prohibiendo
  etiquetas de navegación ocultas o truncadas en móvil.

---

## Orden de ejecución y commits

Un commit por fase; cada uno debe dejar la app compilando y navegable.

1. `feat(ui): primitivos compartidos PageHeader, FilterTabs, ListRow, ActionMenu, FileThumbnail`
2. `fix(db): resumen por RPC, índice de facturas reparado y WITH CHECK en RLS` — migración `052`
3. `refactor(hooks): facturas y pagos a TanStack Query con scroll infinito` — + tipos + `loading.tsx`
4. `feat(facturas): filas densas, bandeja con miniaturas y panel de detalle único`
5. `feat(pagos): filas densas, detalle, selector de categorías correcto y formulario agrupado`
6. `refactor(contactos): pestañas legibles en móvil con FilterTabs`
7. `docs: actualiza facturas y pagos MCM al nuevo flujo`

Push: `git push -u origin claude/redesign-facturas-pagos-iiel8m`, con reintentos
(2s/4s/8s/16s) si falla por red. **No abrir PR** salvo petición expresa.

**STOP y preguntar** si: la migración `052` falla al aplicarse; `get_advisors` devuelve
avisos nuevos; o el cambio de `WITH CHECK` rompe alguna escritura existente (indicaría que
alguna ruta de la app dependía de poder mover filas entre delegaciones).

---

## Verificación

### Base de datos (MCP de Supabase)
1. `mcp__Supabase__apply_migration` con `scripts/052_…sql`.
2. `mcp__Supabase__execute_sql`: `SELECT * FROM get_facturas_resumen('<delegacion_id>')` y
   `get_pagos_mcm_resumen(...)`. Cuadrar contra
   `SELECT estado, count(*), sum(importe) FROM factura WHERE delegacion_id = … GROUP BY estado`.
3. **Comprobar el bug del pendiente:** una factura de 3.000 € con un movimiento de 1.500 €
   vinculado debe dar `importe_pendiente = 1500`, no 3000.
4. `get_cuenta_con_mas_movimientos('<delegacion_id>')` devuelve el mismo id que la lógica
   vieja, y `NULL` en una delegación sin movimientos.
5. Blindaje: con rol `anon` las RPC fallan; con un usuario que no es miembro, lanzan la
   excepción de `assert_delegacion_member`.
6. `WITH CHECK`: como tesorero de la delegación A, un `UPDATE factura SET delegacion_id = '<B>'`
   debe ser **rechazado**. Antes pasaba.
7. `SELECT indexname FROM pg_indexes WHERE tablename IN ('factura','pago_mcm')` — que exista
   `idx_factura_delegacion_importe_abierta` y ya no el roto.
8. `mcp__Supabase__get_advisors` sin avisos nuevos de RLS ni de `search_path`.

### Aplicación (`pnpm dev`, con un usuario con membresía — pídele el acceso al usuario)

**Facturas**
9. Arrastrar un PDF y una imagen a la Bandeja → dos tarjetas con **miniatura visible**, no
   un icono genérico.
10. Click en una tarjeta → detalle con documento + datos + candidatos **en el mismo panel**.
11. Escribir el importe → la lista de candidatos se recalcula **sin cerrar nada**.
12. `Guardar y conciliar` → la factura sale de Bandeja, aparece como `Pagada` y el badge del
    sidebar baja. **Contar los clicks: 3 desde la subida.**
13. Factura de 3.000 € vinculada a dos movimientos de 1.500 € → `Pago parcial` tras el
    primero (con "Falta 1.500 €" en la fila), `Pagada` tras el segundo. Desvincular uno →
    vuelve a parcial. Con varios vinculados, "Desvincular" deja elegir cuál.
14. Pestaña `Pagadas` con ≥15 facturas: filas de una línea en escritorio, alineadas con la
    cabecera de columnas. Nada apilado.
15. Las tres pastillas de filtro (`Sin proveedor`/`Sin importe`/`Falta NIF`) devuelven lo
    esperado.

**Pagos**
16. Crear un pago: el campo de categoría es el **chip de color que abre el mega selector**,
    no un desplegable plano. Y el botón "+" de dentro del selector **crea la categoría y la
    asigna** (verificar que no queda inerte).
17. **No existe** campo "Estado" en el formulario; los dos botones dejan el pago en
    `borrador` y en `pendiente` respectivamente.
18. Modo `Gasolina · €/km`: 120 km, ida y vuelta, preset Estándar → 62,40 € en vivo, con el
    desglose en un renglón. `Gasolina · avanzado` **no aparece**.
19. Un `borrador` → `Confirmar` de la fila lo pasa a `pendiente` en **un** click.
20. Seleccionar 3 pendientes → `Modo transferencia (3)` recorre sólo esos tres.
21. Copiar IBAN desde la fila: un click, toast. El botón es visible **sin pasar el ratón**.
22. En Modo transferencia, con el foco en una fila de copia, pulsar `Enter` **sólo copia**;
    no marca el pago como hecho. La fecha del explicativo sale como `dd/mm/aaaa`.
23. `Marcar pagado` con un movimiento de importe exacto disponible → arranca ya en
    "Vincular existente".
24. Subir 3 tickets a la vez en los justificantes de un pago → se suben **los tres**.
25. Crear un pago, luego borrarlo: los contadores de pestaña y la línea de resumen se
    actualizan **al instante** (antes tardaban ≥10 s en Pagos).

**Móvil** — DevTools a 375 px, y repetir a 320 px
26. **Las cuatro pestañas de cada sección muestran su etiqueta completa** ("Bandeja",
    "Sin cerrar", "Pagadas", "Todas") y hacen scroll horizontal con snap. Ningún punto de
    color suelto sin texto.
27. Cambiar de pestaña centra la activa en pantalla.
28. Las filas son de dos líneas, sin desbordamiento horizontal de la página ni texto
    solapado.
29. El header no desborda: `Nuevo pago` visible, el resto en `⋯`.
30. `Modo transferencia` y `Marcar pagado` **hacen scroll dentro del diálogo** en vez de
    desbordar la pantalla.
31. Los botones de icono de las filas se pueden pulsar con el dedo (≥36 px).
32. Repetir 26-28 en `/contactos` tras la fase 4.

**Regresión**
33. `/transacciones` intacta. `CategoryChip`, `CategoryMegaSelector` y `CategoryQuickCreateSheet`
    tienen consumidores nuevos: comprobar que siguen funcionando igual desde el detalle de
    un movimiento y desde el diálogo de edición masiva.
34. Detalle de un movimiento → pestaña Archivos: subir factura y "Vincular una factura
    existente" siguen funcionando (usan `vincular-factura-dialog.tsx` y el panel de
    conciliación extraído, `transaction-files.tsx:267-271`).
35. Con rol `solo_lectura`: ni filas, ni detalle, ni bandeja ofrecen acciones de escritura.
36. Cambiar de delegación en el selector: las listas y los contadores de las dos secciones
    se refrescan y no muestran datos de la anterior (verificar las query keys).
37. `pnpm lint` sin errores nuevos.

### Aviso importante sobre el build
`next.config.mjs` tiene `ignoreBuildErrors: true`, así que **`pnpm build` no detecta errores
de TypeScript**. Ejecutar `npx tsc --noEmit` explícitamente al terminar cada fase; es el
único modo de ver los tipos roídos por las reescrituras — y con el estrechamiento de
`PagoMcmEstado` a una unión real (fase 1) van a aparecer errores legítimos que hay que
arreglar, no silenciar.
