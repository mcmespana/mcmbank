# Diseño: auto-categorización (reglas + matching de contacto) en la sincronización bancaria

> **Spike de diseño (plan 020), no de construcción.** Ningún archivo de
> producción cambia como parte de este documento. El objetivo es dejar
> decidido el diseño para que un plan de build (021+) lo pueda implementar
> directamente.

## Preguntas abiertas para el mantenedor (léelas antes que el resto del doc)

1. **¿Apply-on-sync o suggest-only?** Ver §3. Recomiendo *suggest-only* para
   la primera versión — es reversible y no exige aún una vista de "revisar
   auto-categorizados" — pero es una decisión de producto, no técnica.
2. **¿Se puede confirmar el volumen real de `sin_categoria` por
   `origen_sync`?** No he podido consultarlo (sin proyecto Supabase real en
   este entorno de ejecución) — ver nota en §1. Antes de dimensionar el
   build habría que correr las queries de §1 contra la base real.
3. **¿El `regla` que existe hoy en la base viva coincide con las columnas
   documentadas más abajo?** Tampoco he podido volcarlo en vivo (mismo
   motivo). Las columnas de §1 son las que documenta el propio plan 020;
   hay que confirmarlas con `list_tables`/SQL antes de construir sobre
   ellas.
4. **¿Dónde vive la gestión de reglas en la UI?** Propongo una sección
   nueva dentro de `/configuracion` (ver §4) siguiendo el patrón de
   `components/categories/`, pero podría justificarse una ruta propia si
   crece.

## 1. Estado verificado (y lo que no he podido verificar)

### 1.1 Tabla `regla`

**No he podido volcar el esquema en vivo** en esta sesión — no hay acceso a
un proyecto Supabase real desde este entorno, y `regla` no tiene ninguna
migración rastreada en `scripts/` (`grep -rln "regla" scripts/*.sql` no
devuelve nada), igual que ya le pasa a las políticas RLS en vivo de otras
tablas (ver la nota de "reproducibility gap" en `plans/README.md`). Esta
sección documenta las columnas que el propio plan 020 registra como
verificadas en el pase de auditoría que lo escribió (`condiciones jsonb`,
`prioridad`, `categoria_id`, `activa`) — **hay que reconfirmarlas con
`list_tables` o SQL directo contra la base real antes de construir nada**,
no asumirlas ciertas solo por estar en este documento.

Columnas documentadas por el plan 020 (sin re-verificar en vivo aquí):

| Columna       | Tipo (asumido) | Notas |
|---------------|----------------|-------|
| `condiciones` | `jsonb`        | DSL propuesta en §2 |
| `prioridad`   | numérico       | desempate de reglas, menor = evalúa antes (propuesto) |
| `categoria_id`| `uuid`         | FK a `categoria`, la categoría a asignar |
| `activa`      | `boolean`      | si la regla se evalúa |

Hecho confirmado por el plan 020 (auditoría con acceso a Supabase
advisors, no reproducido aquí): RLS está **activado pero sin políticas**
(`rls_enabled_no_policy`) — es decir, hoy nadie autenticado puede leer ni
escribir la tabla vía la API pública. Cualquier build necesita añadir
políticas (§4.4) antes de que la tabla sea usable desde el cliente.

Zero referencias en código (`grep -rn "regla" app components lib hooks`
tampoco encuentra nada relevante en este pase) — confirma que es
infraestructura sin usar.

### 1.2 Volumen de movimientos sin categorizar

**Pendiente de datos.** Las queries que habría que correr, por delegación
y `origen_sync`, son:

```sql
SELECT origen_sync, COUNT(*) AS sin_categoria
FROM public.movimiento
WHERE categoria_id IS NULL
  AND delegacion_id = '<delegacion_id>'
GROUP BY origen_sync
ORDER BY sin_categoria DESC;
```

Y para una muestra anonimizable de patrones de `contraparte`/`concepto`:

```sql
SELECT contraparte, concepto
FROM public.movimiento
WHERE categoria_id IS NULL AND origen_sync = 'enablebanking'
LIMIT 50;
```

No se han ejecutado — no hay proyecto Supabase accesible desde este
entorno. Antes de dimensionar el build (S/M/L de §4.5) hace falta correr
esto contra 2-3 delegaciones reales.

### 1.3 Pipeline de sync (verificado leyendo el código en este repo)

- `lib/enable-banking/dedup.ts` → `mapTransactionToMovimiento(tx, ctx)`
  construye el objeto que se inserta en `movimiento`. **No incluye
  `categoria_id` ni `contacto_id` en absoluto** — todo movimiento
  sincronizado nace sin categorizar y sin contacto vinculado.
- La misma función ya extrae, para el hash de dedup
  (`resolveExternalId`, líneas ~37-46), exactamente los campos que un
  matcher de contacto necesitaría:
  ```ts
  tx.creditor_account?.iban || tx.debtor_account?.iban ||
  tx.creditor_account?.bban || tx.debtor_account?.bban ||
  tx.creditor_account?.other?.identification ||
  tx.debtor_account?.other?.identification ||
  tx.creditor?.name || tx.debtor?.name
  ```
  y `mapTransactionToMovimiento` calcula por separado un `contraparte`
  (nombre) según sea débito o crédito (líneas ~117-121). El IBAN de la
  contraparte NO se persiste hoy en `movimiento` — solo el nombre.
- `lib/enable-banking/sync.ts` llama a `mapTransactionToMovimiento` y hace
  upsert por `external_id` (`onConflict: "cuenta_id,external_id"`,
  `ignoreDuplicates: true`) — no hay ningún paso posterior que toque
  `categoria_id`/`contacto_id` de las filas insertadas.
- `contacto` (`scripts/040_create_contacto.sql`) tiene `iban TEXT` y
  `categoria_id_predeterminada UUID REFERENCES categoria(id)` — ambos ya
  existen y están poblados donde el usuario los rellena manualmente, pero
  solo se leen en la creación manual de movimientos
  (`components/transactions/transaction-create-panel.tsx`, `onChange` del
  `ContactoSelector`: si el contacto tiene `categoria_id_predeterminada` y
  el formulario no tiene categoría aún, la sugiere).
- La importación manual (Excel/CSV) también nace sin este pipeline; el
  plan 018 ya extrajo su parseo a `lib/utils/import-parsing.ts`, que es el
  punto de enganche natural para reutilizar el mismo matcher (ver §4.2).

## 2. DSL de `condiciones` (jsonb)

Formato propuesto — un objeto con una lista de condiciones combinadas por
AND dentro de la misma regla; el "OR entre reglas" ya lo da tener varias
filas en `regla` con distinta `prioridad`:

```ts
type ReglaCondiciones = {
  version: 1
  clauses: ReglaClause[]
}

type ReglaClause =
  | { field: "concepto" | "contraparte"; op: "contains" | "regex"; value: string; caseSensitive?: boolean }
  | { field: "contraparte_iban"; op: "equals"; value: string } // IBAN normalizado (normalizarIban)
  | { field: "importe"; op: "sign"; value: "positive" | "negative" }
  | { field: "importe"; op: "between"; min?: number; max?: number } // sobre el valor absoluto, mismo criterio que applyAbsoluteAmountFilter
```

### Ejemplos concretos

1. **Sustring en concepto** — gastos de luz:
   ```json
   { "version": 1, "clauses": [
     { "field": "concepto", "op": "contains", "value": "IBERDROLA", "caseSensitive": false }
   ]}
   ```
2. **Regex en contraparte** — cualquier variante de un proveedor de limpieza:
   ```json
   { "version": 1, "clauses": [
     { "field": "contraparte", "op": "regex", "value": "LIMPIEZAS?\\s+GARC[IÍ]A" }
   ]}
   ```
3. **IBAN exacto + signo** — cuota fija de un proveedor conocido, solo si es un cargo:
   ```json
   { "version": 1, "clauses": [
     { "field": "contraparte_iban", "op": "equals", "value": "ES7620770024003102575766" },
     { "field": "importe", "op": "sign", "value": "negative" }
   ]}
   ```
4. **Rango de importe + substring** — donativos pequeños recurrentes:
   ```json
   { "version": 1, "clauses": [
     { "field": "concepto", "op": "contains", "value": "BIZUM" },
     { "field": "importe", "op": "between", "min": 1, "max": 50 }
   ]}
   ```

### Orden de evaluación y determinismo

1. **Match de contacto por IBAN primero** (no es una "regla" de la tabla
   `regla` — es un paso previo, exacto, sin ambigüedad: si el IBAN de la
   contraparte coincide con `contacto.iban`, se usa
   `contacto.categoria_id_predeterminada` si existe, y se enlaza
   `movimiento.contacto_id`). Es más específico que cualquier regla textual
   y no debería poder ser pisado por una regla de menor confianza.
2. Si no hay contacto-match (o el contacto no tiene categoría por
   defecto): evaluar `regla` activas de la delegación (+ globales, si se
   decide que existan reglas globales — no lo asume este diseño) ordenadas
   por `prioridad` ascendente; **primera que casa gana** (first-match-wins).
3. Empate de `prioridad`: desempate estable por `id` (orden de creación),
   para que el resultado sea reproducible entre ejecuciones — nunca
   aleatorio ni dependiente del orden de un `SELECT` sin `ORDER BY`
   explícito.
4. Ninguna regla ni contacto-match → el movimiento queda `categoria_id
   NULL`, exactamente como hoy.

## 3. Apply-on-sync vs. suggest-only

### Opción A — Apply-on-sync

`categoria_id` (y `contacto_id`) se rellenan directamente durante el
upsert en `sync.ts`.

- **A favor**: cero fricción — el dashboard ya refleja la categorización
  sin que nadie toque nada.
- **En contra**: en una app financiera, escribir un valor "adivinado" sin
  que un humano lo confirme es arriesgado si una regla está mal escrita
  (ej. una regex demasiado laxa categoriza mal un lote entero antes de que
  alguien se dé cuenta). Necesita, como mínimo:
  - Columna de auditoría `categoria_origen` (`enum: manual | regla |
    contacto | import`) en `movimiento`, para poder distinguir "esto lo
    puso una persona" de "esto lo adivinó una regla" y poder revertir en
    bloque si una regla resulta estar mal.
  - Una vista/filtro "revisar auto-categorizados" (¿nueva pestaña en
    `/transacciones` filtrando por `categoria_origen IN ('regla',
    'contacto')`?) para que el tesorero pueda auditar en lote.

### Opción B — Suggest-only

Se guarda una sugerencia (`categoria_sugerida_id` en `movimiento`, o una
tabla lateral si se prefiere no tocar el esquema de `movimiento`) sin tocar
`categoria_id`. La UI de transacciones muestra un chip "¿Es
`<categoría sugerida>`?" con confirmación de un clic
(`updateCategoria(movimientoId, categoriaSugeridaId)`, ya existe en
`hooks/use-movimientos.ts`).

- **A favor**: reversible por construcción — nunca escribe el campo real
  sin que un humano lo apruebe explícitamente; el `categoria_origen` de la
  Opción A pasa a ser innecesario porque `categoria_id` solo lo escribe
  quien siempre lo escribió (un humano, ahora con una sugerencia a mano).
  Más fácil de lanzar sin desconfianza inicial del maintainer, y sirve como
  período de prueba en vivo antes de plantearse Apply-on-sync más adelante.
- **En contra**: no reduce el backlog de categorización sin que alguien
  pase por la lista y confirme — para un volumen alto, sigue siendo trabajo
  manual (aunque de un clic en vez de escribir a mano).

### Recomendación

**Empezar por suggest-only.** Es la opción reversible-por-diseño, no
necesita la columna de auditoría ni la vista de revisión en bloque para
salir a producción, y da datos reales (tasa de aceptación de las
sugerencias) para decidir con confianza si pasar a apply-on-sync más
adelante — decisión que sigue siendo del maintainer, no algo que este spike
zanje unilateralmente.

## 4. Puntos de integración (para el build)

### 4.1 Sync-time hook

`lib/enable-banking/sync.ts`, en el bloque que ya mapea
`allTx.map((tx) => mapTransactionToMovimiento(...))` (línea ~513 al
escribir este documento): tras construir `rows` y antes del upsert, pasar
cada fila (+ el `tx` original, que trae el IBAN de contraparte que hoy se
descarta) por un nuevo módulo puro `lib/services/auto-categorizacion.ts`
que devuelva `{ contacto_id, categoria_sugerida_id, categoria_origen }` (o
directamente `categoria_id` si se decide Apply-on-sync). Debe:
- Recibir las reglas y contactos ya cargados para la delegación (una
  consulta por sync, no por fila) para no hacer N+1.
- Ser puro/testeable igual que `lib/enable-banking/dedup.ts` — sin
  Supabase dentro, solo transformación de datos.

### 4.2 Import manual (Excel/CSV)

`components/transactions/transaction-import-panel.tsx`, ya apoyado en
`lib/utils/import-parsing.ts` (plan 018). El módulo de §4.1 debería
reutilizarse aquí tal cual — el import manual también trae
`contraparte`/`concepto`/`importe`, aunque no trae IBAN de la contraparte
(el Excel de los bancos no lo incluye), así que el matching por IBAN
quedaría limitado a la vía de sync; las reglas basadas en texto/importe
funcionan igual en ambos caminos.

### 4.3 Backfill de movimientos existentes

Job por delegación, en lotes (para no bloquear ni saturar), con modo
`--dry-run` primero (contar cuántos cambiarían sin escribir nada) antes de
aplicar. Candidato natural: un script en `scripts/` invocado manualmente
por el operador (no un cron — es una operación puntual de migración de
datos, no recurrente), o un botón admin en `/configuracion` que dispare
una API route con el mismo límite de lote. Debe respetar la opción elegida
en §3 (si es suggest-only, el backfill solo rellena
`categoria_sugerida_id`, nunca `categoria_id`).

### 4.4 RLS de `regla`

Siguiendo el patrón ya usado para `categoria` (`scripts/050_enable_categoria_rls.sql`,
membership-scoped, ver esa migración como plantilla exacta):

```sql
ALTER TABLE public.regla ENABLE ROW LEVEL SECURITY; -- ya está activado, falta política

CREATE POLICY "Ver reglas de la delegacion" ON public.regla
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM membresia m
      WHERE m.delegacion_id = regla.delegacion_id
        AND m.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Gestionar reglas de la delegacion" ON public.regla
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM membresia m
      WHERE m.delegacion_id = regla.delegacion_id
        AND m.usuario_id = auth.uid()
        AND m.rol IN ('tesorero', 'gestor_central')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM membresia m
      WHERE m.delegacion_id = regla.delegacion_id
        AND m.usuario_id = auth.uid()
        AND m.rol IN ('tesorero', 'gestor_central')
    )
  );
```

**Nota**: asume que `regla` tiene una columna `delegacion_id` — no
confirmado en vivo (§1.1); si no la tiene, el diseño de esta política
cambia (podría ser una tabla global sin scoping, lo cual sería un cambio de
producto más grande que decidir aquí).

### 4.5 UI de gestión de reglas

Propuesta: sección nueva dentro de `/configuracion`
(`components/configuracion/config-page.tsx` ya tiene el patrón de
secciones añadidas — `PlantillaMemoriaSection`, `EnableBankingHealthSection`),
siguiendo el patrón CRUD de `components/categories/category-list.tsx`
(tabla + sheet de edición) en vez de un componente nuevo desde cero.

### 4.6 Desglose de build aproximado (S/M/L)

| Pieza | Tamaño | Depende de |
|---|---|---|
| RLS de `regla` (§4.4) | S | confirmar esquema real |
| `lib/services/auto-categorizacion.ts` puro + tests | M | — |
| Hook en `sync.ts` (§4.1) | S | pieza anterior |
| Hook en import manual (§4.2) | S | plan 018 (ya aterrizado) |
| Columna `categoria_sugerida_id` + chip de confirmación en la UI de transacciones | M | decisión de §3 |
| CRUD de reglas en `/configuracion` (§4.5) | L | RLS de `regla` |
| Backfill batch/dry-run (§4.3) | M | pieza de auto-categorización |

## 5. Sonda de precisión del matching (§5 del plan, no ejecutada)

El plan sugiere, como paso opcional, un script desechable que corra el
matcher propuesto contra movimientos ya categorizados de una delegación
real y calcule precisión (cuántas veces la categoría de la regla coincide
con la que puso la persona). **No se ha podido ejecutar** — no hay
proyecto Supabase accesible desde este entorno de ejecución para leer
datos reales. Queda como el primer paso recomendado del plan de build:
antes de escribir el CRUD de reglas, correr esta sonda contra 1-2
delegaciones para validar que el DSL de §2 captura los patrones reales
antes de invertir en la UI.
