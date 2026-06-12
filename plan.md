# Plan "Puesta a punto MCM Bank" — Calidad, Bugs y UX

**Fecha:** 12 de junio de 2026
**Estado:** Pendiente de ejecución
**Audiencia:** Este documento está escrito para que lo pueda ejecutar un desarrollador junior o una IA sin contexto previo. Cada tarea incluye: objetivo, archivos exactos, pasos numerados, código de ejemplo y cómo verificar que funciona. **No te saltes las verificaciones.**

---

## Cómo usar este documento

1. Ejecuta las fases **en orden**. Cada fase es independiente y se puede commitear por separado.
2. Antes de empezar cualquier fase: `git checkout -b fase-N-nombre-corto` (nunca trabajes en `main`).
3. Después de cada fase: ejecuta la **verificación** indicada y haz commit con mensaje convencional (ej: `fix(dashboard): corregir desfase de fechas por zona horaria`).
4. Comandos de verificación globales que usarás constantemente:
   ```bash
   npx tsc --noEmit        # comprobar tipos (no debe sacar errores nuevos)
   pnpm lint               # ESLint
   pnpm dev                # servidor en http://localhost:3000
   ```
5. Usuario demo para probar en el navegador: `admin@movimientoconsolacion.com` / contraseña `1234`.
6. **Regla de oro:** si una verificación falla, NO pases a la siguiente tarea. Arregla o revierte.

---

# FASE 0 — Bugs confirmados (arreglar primero, son errores reales)

## Tarea 0.1 — Bug de zona horaria en los filtros de periodo ⚠️ CRÍTICO

**Problema:** En `components/dashboard/timeframe-filter.tsx` los rangos de fechas se calculan con `new Date(año, mes, día)` (que crea medianoche en hora **local** de España) y luego se convierten con `.toISOString().split("T")[0]` (que convierte a **UTC**). Como España va 1-2 horas por delante de UTC, la medianoche local del 1 de septiembre es las 22:00/23:00 UTC del **31 de agosto**. Resultado: **todos los filtros de periodo ("Este curso escolar", "Año pasado", etc.) empiezan y terminan un día antes de lo que deberían.** Los movimientos del primer día del periodo pueden quedar fuera y los del día anterior colarse.

**Archivos afectados (buscar el mismo patrón en todos):**
- `components/dashboard/timeframe-filter.tsx` (líneas ~70-90)
- `components/dashboard/activity-balance.tsx` (líneas ~158-163)
- Cualquier otro resultado de: `grep -rn 'toISOString().split' components lib hooks`

**Pasos:**

1. Crea una función utilitaria en `lib/utils/format.ts` (o un nuevo `lib/utils/date.ts` si format.ts no existe):

   ```typescript
   /**
    * Formatea un Date como "yyyy-mm-dd" usando la fecha LOCAL,
    * sin pasar por UTC (toISOString() desplaza el día en husos != UTC).
    */
   export function toLocalDateString(date: Date): string {
     const year = date.getFullYear()
     const month = String(date.getMonth() + 1).padStart(2, "0")
     const day = String(date.getDate()).padStart(2, "0")
     return `${year}-${month}-${day}`
   }
   ```

2. En `timeframe-filter.tsx`, sustituye:
   ```typescript
   // ANTES (mal):
   return {
     from: from.toISOString().split("T")[0],
     to: to.toISOString().split("T")[0],
   }
   // DESPUÉS (bien):
   return {
     from: toLocalDateString(from),
     to: toLocalDateString(to),
   }
   ```
   No olvides el import: `import { toLocalDateString } from "@/lib/utils/format"`.

3. Repite en `activity-balance.tsx` para `interval.toISOString().split("T")[0]` y `nextInterval.toISOString().split("T")[0]`.

4. **EXCEPCIÓN — no tocar:** `lib/utils/export-to-excel.ts` usa el patrón solo para el nombre del archivo descargado (`transacciones-2026-06-12.xlsx`); un desfase ahí es inofensivo. Tampoco toques `cuenta-sync-dialog.tsx`, que muestra horas de log (usa la parte `T[1]`, no la fecha).

**Verificación:**
1. `npx tsc --noEmit` sin errores.
2. En el navegador, abre el Dashboard, selecciona "Este curso escolar" y abre las herramientas de red (pestaña Network). Busca la petición a Supabase y comprueba que el parámetro de fecha `gte` es `2025-09-01` (NO `2025-08-31`).
3. Prueba también "Año pasado": debe ir de `2025-01-01` a `2025-12-31` exactos.

---

## Tarea 0.2 — Doble montaje del panel de filtros de transacciones

**Problema:** En `components/transactions/transaction-manager.tsx` el componente `<TransactionFiltersComponent>` se renderiza **dos veces simultáneamente** (línea ~569 para la barra lateral de escritorio y línea ~791 para el panel móvil/plegable). Ambas instancias están montadas a la vez en el DOM (una se oculta solo con CSS). Esto causa: (a) los popovers internos (selector de categorías) a veces se anclan a la instancia oculta de tamaño 0 y aparecen flotando arriba a la izquierda de la pantalla; (b) doble trabajo de render; (c) estado interno duplicado.

**Pasos:**

1. Abre `transaction-manager.tsx` y localiza los dos usos: `grep -n "TransactionFiltersComponent" components/transactions/transaction-manager.tsx`.
2. Identifica qué condición controla cada uno (busca hacia arriba el JSX que los envuelve). Verás que uno vive en la sidebar de escritorio (`sidebarCollapsed`) y otro en un `<Card>` para móvil (`filtersOpen`).
3. La solución correcta es **montar solo el que corresponde al viewport actual**. Usa el hook existente si hay uno de media query (busca `useMediaQuery` o `useIsMobile` en `hooks/`); si no existe, créalo:

   ```typescript
   // hooks/use-is-mobile.ts
   "use client"
   import { useEffect, useState } from "react"

   export function useIsMobile(breakpointPx = 768) {
     const [isMobile, setIsMobile] = useState(false)
     useEffect(() => {
       const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
       const update = () => setIsMobile(mq.matches)
       update()
       mq.addEventListener("change", update)
       return () => mq.removeEventListener("change", update)
     }, [breakpointPx])
     return isMobile
   }
   ```

4. En `transaction-manager.tsx`:
   ```tsx
   const isMobile = useIsMobile()
   // Instancia escritorio: envolver con {!isMobile && ( ... )}
   // Instancia móvil: envolver con {isMobile && ( ... )}
   ```
   ⚠️ Cuidado: NO cambies la lógica interna de `sidebarCollapsed`/`filtersOpen`, solo añade la condición de viewport por fuera.
5. Nota: la segunda instancia no pasa la prop `contactos` (la primera sí). Al unificar, asegúrate de que ambas ramas pasan **las mismas props completas**, incluida `contactos`.

**Verificación:**
1. `pnpm dev`, ve a `/transacciones` en escritorio. Abre el panel Filtros → desplegable "Todas las categorías". El menú debe abrirse **pegado debajo del campo**.
2. En las DevTools del navegador ejecuta:
   `document.querySelectorAll('button[role="combobox"]').length` — los combobox del panel de filtros ya no deben estar duplicados (antes salían 2 de "Todas las categorías", ahora 1).
3. Redimensiona la ventana a <768px y comprueba que los filtros móviles siguen funcionando (abrir, filtrar, cerrar).

---

## Tarea 0.3 — Lockfile huérfano que confunde a Turbopack

**Problema:** Existe `/Users/izanriro/package-lock.json` (en la carpeta HOME del usuario, fuera del proyecto). Next.js lo detecta y elige mal la raíz del workspace; sale este warning en cada arranque: *"Next.js inferred your workspace root, but it may not be correct"*.

**Pasos:**
1. Comprueba qué contiene: `cat ~/package-lock.json | head -30`. Si es un lockfile vacío o de pruebas (lo más probable), bórralo: `rm ~/package-lock.json`. **Pregunta al usuario antes de borrar si tiene contenido real.**
2. Alternativa sin borrar (más segura): fija la raíz en `next.config.mjs` (o `.ts`, comprobar cuál existe):
   ```javascript
   const nextConfig = {
     turbopack: {
       root: __dirname,
     },
     // ...resto de la config existente
   }
   ```

**Verificación:** reinicia `pnpm dev` y confirma que el warning de "multiple lockfiles" ya no aparece.

---

## Tarea 0.4 — Limpiar `console.log` de producción (37 usos)

**Problema:** Hay 37 `console.log` repartidos por `components/`, `hooks/` y `lib/` que ensucian la consola en producción y pueden filtrar datos.

**Pasos:**
1. Lista todos: `grep -rn "console\.log" --include="*.ts" --include="*.tsx" components lib hooks app`
2. Para cada uno, decide:
   - Si es debug temporal (ej: `console.log("[useMovimientos] Already fetching, skipping...")`) → **bórralo**.
   - Si aporta valor de diagnóstico → cámbialo a `console.warn`/`console.error` solo si es realmente un problema, o elimínalo.
3. **NO toques** los `console.warn` y `console.error` existentes: esos son legítimos.
4. Para evitar regresiones, añade la regla a `eslint.config.js` (o el archivo de config de ESLint que exista):
   ```javascript
   rules: {
     "no-console": ["warn", { allow: ["warn", "error"] }],
   }
   ```

**Verificación:** `grep -rn "console\.log" --include="*.ts" --include="*.tsx" components lib hooks app | wc -l` devuelve `0`, y `pnpm lint` no saca errores nuevos.

---

## Tarea 0.5 — `key={index}` en listas (6 usos)

**Problema:** Usar el índice del array como `key` de React provoca bugs de estado cuando la lista se reordena o se filtran elementos (inputs que conservan el valor de otra fila, animaciones rotas).

**Pasos:**
1. Localiza: `grep -rn "key={index}\|key={i}\|key={idx}" --include="*.tsx" components`
2. Para cada uso, sustituye por un identificador estable del dato:
   - Si el item tiene `id`: `key={item.id}`.
   - Si es un valor primitivo único (nombre de columna, etiqueta): `key={item}`.
   - Si de verdad no hay nada único Y la lista nunca se reordena/filtra (ej: skeleton placeholders estáticos), se puede dejar el índice pero añade un comentario `{/* lista estática, índice seguro como key */}`.

**Verificación:** `npx tsc --noEmit` y prueba manual de las pantallas tocadas.

---

# FASE 1 — Tipos generados de Supabase (eliminar los ~187 `any`)

**Objetivo:** Generar los tipos TypeScript desde el esquema real de la base de datos para que las consultas de Supabase estén tipadas, y eliminar la mayoría de `as any` / `: any`.

## Tarea 1.1 — Generar los tipos

1. Genera los tipos con el CLI de Supabase (necesitas el project-ref, está en la URL de `NEXT_PUBLIC_SUPABASE_URL` de `.env.local`):
   ```bash
   npx supabase gen types typescript --project-id TU_PROJECT_REF --schema public > lib/types/supabase-generated.ts
   ```
   (Alternativa: si hay un MCP de Supabase conectado, usar su herramienta `generate_typescript_types`.)
2. NO borres `lib/types/database.ts` todavía: contiene tipos de dominio hechos a mano (`MovimientoConRelaciones`, `CategoriaConOrdenEfectivo`...) que siguen siendo útiles.
3. Conecta el tipo `Database` generado al cliente. En `lib/supabase/client.ts`:
   ```typescript
   import type { Database } from "@/lib/types/supabase-generated"
   // donde se cree el cliente:
   createBrowserClient<Database>(...)
   ```
   Haz lo mismo en `lib/supabase/server.ts` (`createServerClient<Database>`) y `lib/supabase/admin.ts`.

## Tarea 1.2 — Eliminar los `as any` gradualmente

1. Lista los ofensores: `grep -rn "as any" --include="*.ts" --include="*.tsx" components lib hooks | sort`
2. Empieza por `hooks/use-movimientos.ts`: los `(supabase as any).from("movimiento")` ahora compilan sin `as any` porque el cliente está tipado. Quita el cast y deja que TypeScript te diga si algún nombre de columna está mal (¡eso es justo lo que queremos detectar!).
3. Si al quitar un `as any` aparece un error de tipos:
   - Si es un nombre de columna mal escrito → corrígelo (era un bug latente).
   - Si es una relación anidada que el tipo generado no refleja (joins con `select`) → tipa el resultado con los tipos de dominio existentes: `as MovimientoConRelaciones[]` (un cast concreto y documentado es mejor que `any`).
4. Trabaja archivo por archivo y commitea cada 3-4 archivos. Orden sugerido: `hooks/`, luego `lib/services/database.ts`, luego componentes.
5. **Meta realista de esta fase:** bajar de ~187 a <50 usos. Los que queden deben tener un comentario justificando por qué.

**Verificación:** `npx tsc --noEmit` limpio tras cada archivo. Prueba en navegador las pantallas de transacciones, categorías y dashboard (las más afectadas).

---

# FASE 2 — `loading.tsx`, `error.tsx` y skeletons

**Objetivo:** Que ninguna ruta muestre pantalla en blanco al cargar ni reviente sin mensaje ante un error.

## Tarea 2.1 — Crear skeleton base reutilizable

1. Comprueba si ya existe `components/ui/skeleton.tsx` (es estándar de shadcn/ui). Si no:
   ```tsx
   // components/ui/skeleton.tsx
   import { cn } from "@/lib/utils"

   export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
     return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
   }
   ```

## Tarea 2.2 — `loading.tsx` por ruta

Para **cada** carpeta de ruta con página (`app/transacciones/`, `app/balance/`, `app/analisis/`, `app/resumen/`, `app/cuentas/`, `app/categorias/`, `app/contactos/`, `app/pagos-mcm/`, `app/configuracion/`, `app/propuestas/`), crea un `loading.tsx`. Plantilla genérica (ajusta el layout a lo que muestre cada página):

```tsx
// app/transacciones/loading.tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      {/* barra de acciones */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-10" />
      </div>
      {/* filas de tabla */}
      {Array.from({ length: 8 }).map((_, i) => (
        // lista estática, índice seguro como key
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}
```

Para el dashboard (`app/page.tsx` y `app/analisis` si existe como ruta): 3 tarjetas KPI (`h-24`) + 2 bloques grandes (`h-80`).

⚠️ Nota: como casi todas las páginas son client components que cargan datos con hooks, el `loading.tsx` solo cubre la navegación inicial. La carga de datos interna ya la cubren los spinners existentes; no los toques en esta fase.

## Tarea 2.3 — `error.tsx` global y por ruta

1. Crea `app/error.tsx`:
   ```tsx
   "use client"

   import { Button } from "@/components/ui/button"

   export default function Error({
     error,
     reset,
   }: {
     error: Error & { digest?: string }
     reset: () => void
   }) {
     return (
       <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
         <h2 className="text-xl font-semibold">Algo ha ido mal</h2>
         <p className="max-w-md text-sm text-muted-foreground">
           Ha ocurrido un error inesperado. Puedes reintentar o volver al inicio.
         </p>
         <div className="flex gap-2">
           <Button onClick={reset}>Reintentar</Button>
           <Button variant="outline" onClick={() => (window.location.href = "/")}>
             Ir al inicio
           </Button>
         </div>
       </div>
     )
   }
   ```
2. Crea también `app/global-error.tsx` (mismo contenido pero envolviendo con `<html><body>...</body></html>`, es requisito de Next para errores en el layout raíz).

**Verificación:**
1. `pnpm dev` y navega entre rutas: al cambiar de página debe verse el skeleton un instante (acelera la comprobación con DevTools → Network → throttling "Slow 3G").
2. Para probar `error.tsx`: lanza un `throw new Error("test")` temporal dentro de una página, comprueba que sale la pantalla de error con botón Reintentar, y **quita el throw**.

---

# FASE 3 — Móvil: bottom sheets con vaul

**Objetivo:** Los modales grandes (selector de categorías y similares) se comportan mal en móvil (la X salta de fila, mucho scroll). `vaul` ya está en `package.json` — es una librería de bottom sheets (paneles que suben desde abajo, patrón nativo móvil).

## Tarea 3.1 — Crear wrapper responsive reutilizable

1. Comprueba si existe `components/ui/drawer.tsx` (wrapper shadcn de vaul). Si no, créalo siguiendo la doc de shadcn/ui drawer (es copy-paste estándar).
2. Crea un componente que elija automáticamente Dialog (escritorio) o Drawer (móvil):

   ```tsx
   // components/ui/responsive-modal.tsx
   "use client"

   import { useIsMobile } from "@/hooks/use-is-mobile"
   import { Dialog, DialogContent } from "@/components/ui/dialog"
   import { Drawer, DrawerContent } from "@/components/ui/drawer"

   interface ResponsiveModalProps {
     open: boolean
     onOpenChange: (open: boolean) => void
     children: React.ReactNode
     /** clases extra para el contenedor de contenido */
     className?: string
   }

   export function ResponsiveModal({ open, onOpenChange, children, className }: ResponsiveModalProps) {
     const isMobile = useIsMobile()
     if (isMobile) {
       return (
         <Drawer open={open} onOpenChange={onOpenChange}>
           <DrawerContent className={className}>{children}</DrawerContent>
         </Drawer>
       )
     }
     return (
       <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent className={className}>{children}</DialogContent>
       </Dialog>
     )
   }
   ```

## Tarea 3.2 — Migrar el CategoryMegaSelector

1. Hoy el `CategoryMegaSelector` se monta dentro de un overlay manual (`<div className="fixed inset-0 z-50 ...">`) en: `components/dashboard/category-analysis.tsx`, `components/dashboard/activity-balance.tsx`, `components/transactions/transaction-manager.tsx` y `components/transactions/category-chip.tsx`. Localízalos: `grep -rn "CategoryMegaSelector" --include="*.tsx" components`
2. En cada uso, sustituye el overlay manual por `ResponsiveModal`, manteniendo el `CategoryMegaSelector` como hijo. El selector ya gestiona su propio header/footer, así que pasa `className="p-0 max-w-3xl"` para no duplicar paddings.
3. En móvil, dentro del Drawer, limita la altura del selector: el componente ya usa `h-[calc(100vh-2rem)]`; cámbialo para que en drawer sea `max-h-[85vh]` (ajusta la clase raíz del selector con una prop opcional si hace falta).
4. Arregla de paso el header del selector en móvil: la X de cerrar debe estar en la **misma fila** que el título (hoy se va a una segunda fila). En `category-mega-selector.tsx`, en el header, asegura que el contenedor del título y el botón X comparten una fila con `flex items-center justify-between` **sin** `flex-col` en móvil.

**Verificación:**
1. Escritorio: abrir "Filtrar categorías" en `/analisis` → se ve como modal centrado, igual que antes.
2. Móvil (DevTools, viewport 375px): el selector sube desde abajo como bottom sheet, se puede arrastrar hacia abajo para cerrar, la X está junto al título, y el footer (Seleccionar todas / Aplicar) es visible sin scroll.

---

# FASE 4 — Piloto de TanStack Query (React Query)

**Objetivo:** Sustituir la gestión manual de fetching (abort controllers, refs anti-carrera, revalidación al foco) por TanStack Query en 2 hooks piloto. Si el piloto va bien, el resto de hooks se migran en un plan posterior — **no migres todo de golpe**.

## Tarea 4.1 — Instalación y provider

1. `pnpm add @tanstack/react-query`
2. Crea el provider:
   ```tsx
   // components/providers/query-provider.tsx
   "use client"

   import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
   import { useState } from "react"

   export function QueryProvider({ children }: { children: React.ReactNode }) {
     const [client] = useState(
       () =>
         new QueryClient({
           defaultOptions: {
             queries: {
               staleTime: 30_000,        // 30s: evita refetch agresivo al navegar
               refetchOnWindowFocus: true, // mismo comportamiento que los hooks actuales
               retry: 1,
             },
           },
         }),
     )
     return <QueryClientProvider client={client}>{children}</QueryClientProvider>
   }
   ```
3. Envuelve la app en `app/layout.tsx` (dentro de los providers existentes, busca dónde están `AuthProvider`/`DelegationProvider` y añádelo al mismo nivel, por fuera de ellos).

## Tarea 4.2 — Migrar `use-category-breakdown.ts` (piloto 1, el más simple)

El hook actual (`hooks/use-category-breakdown.ts`, ~83 líneas) queda así (~25 líneas):

```typescript
"use client"

import { useQuery } from "@tanstack/react-query"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"

export function useCategoryBreakdown(from: string, to: string) {
  const { selectedDelegation } = useDelegationContext()

  const query = useQuery({
    queryKey: ["category-breakdown", selectedDelegation, from, to],
    queryFn: ({ signal }) =>
      DatabaseService.getCategoryBreakdown(selectedDelegation!, from, to, signal),
    enabled: Boolean(selectedDelegation && from && to),
  })

  return {
    breakdown: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: query.refetch,
  }
}
```

**Importante:** mantén la **misma forma del objeto devuelto** (`breakdown`, `loading`, `error`, `refresh`) para que `category-analysis.tsx` no necesite cambios. Esa es la clave de una migración segura.

## Tarea 4.3 — Migrar `use-categorias.ts` (piloto 2)

1. Lee primero el hook actual completo y anota su contrato de salida (qué propiedades devuelve).
2. Replica el patrón de 4.2: `queryKey: ["categorias", delegacionId, opciones]`, `queryFn` llamando a `DatabaseService.getCategoriasByDelegacion(...)`, mismo objeto de retorno.
3. Si el hook tiene suscripciones realtime de Supabase (busca `.channel(` dentro), mantenlas en un `useEffect` aparte que haga `queryClient.invalidateQueries({ queryKey: ["categorias"] })` cuando llegue un evento.

**Verificación de la fase:**
1. `/analisis` carga el desglose por categorías correctamente, y al cambiar el periodo se actualiza.
2. Navega a otra página y vuelve a `/analisis`: los datos aparecen **al instante** (caché) y se revalidan en segundo plano. Esto es una mejora visible respecto a antes.
3. Cambia de delegación en el selector superior: los datos cambian.
4. `npx tsc --noEmit` limpio.

---

# FASE 5 — Trocear `category-list.tsx` (1.520 líneas)

**Objetivo:** Dividir el archivo más grande del proyecto en módulos manejables **sin cambiar comportamiento**. Es un refactor mecánico: mover código, no reescribirlo.

## Reglas para todo el troceo

- **Nunca** cambies lógica y muevas código en el mismo commit. Primero mover, verificar, luego (si acaso) mejorar.
- Cada componente extraído va a `components/categories/` con su nombre kebab-case.
- Los tipos compartidos van a un `components/categories/types.ts`.
- Después de cada extracción: `npx tsc --noEmit` + prueba manual de la página `/categorias`.

## Tarea 5.1 — Mapear el archivo

1. Abre `components/categories/category-list.tsx` y haz un inventario de qué contiene (componentes internos, dialogs, formularios, helpers). Apúntalo como comentario en el PR.
2. Identifica los bloques con límites claros: típicamente habrá un formulario de crear/editar categoría, dialogs de confirmación, la fila/tarjeta de categoría, lógica de drag & drop de orden, y el contenedor principal.

## Tarea 5.2 — Extraer de fuera hacia dentro

Orden recomendado (de menor a mayor riesgo):
1. **Tipos e interfaces** → `components/categories/types.ts`
2. **Funciones helper puras** (sin estado) → `components/categories/utils.ts`
3. **Sub-componentes hoja** (los que no tienen hijos complejos: badges, filas, items) → un archivo por componente.
4. **Dialogs/formularios** (crear categoría, editar, eliminar) → un archivo por dialog.
5. El archivo original queda como **orquestador**: estado + composición de las piezas. Meta: <400 líneas.

## Tarea 5.3 — Repetir con `transaction-manager.tsx` (1.060 líneas) — opcional si hay tiempo

Mismo método. Candidatos obvios a extraer: la toolbar de acciones, el panel de selección múltiple, y los dos bloques de filtros (que tras la Tarea 0.2 ya estarán unificados).

**Verificación de la fase:** la página `/categorias` funciona igual que antes: crear, editar, reordenar (drag & drop), activar/desactivar, ver movimientos relacionados. Haz las 5 acciones a mano.

---

# FASE 6 — Mejoras visuales menores (independientes, hacer en cualquier orden)

## Tarea 6.1 — Indicador de clicable en "Detalle por categoría"

En `components/dashboard/category-analysis.tsx`, las filas de la tabla son clicables (abren el panel de movimientos) pero nada lo indica hasta hacer hover.

1. En `CategoryDataRow`, añade un chevron al final de la fila:
   ```tsx
   import { ChevronRight } from "lucide-react"
   // Nueva celda al final de la fila (y añade su <TableHead /> vacío en la cabecera):
   <TableCell className="w-8 pr-2">
     {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
   </TableCell>
   ```
2. ⚠️ Recuerda añadir la celda también a la fila de cabecera del grupo (vista agrupada) y al `TableFooter` (celda vacía) para que las columnas cuadren.

## Tarea 6.2 — KPI Balance destacado con comparativa

En el dashboard, las 3 tarjetas KPI pesan igual. Destacar el Balance:
1. En `category-analysis.tsx` (y/o el resumen del dashboard), añade a la tarjeta Balance un borde de acento: `className="border-primary/40"` y el importe en `text-2xl` (los otros en `text-xl`).
2. (Opcional, más trabajo) Comparativa con el periodo anterior: calcula el rango anterior con la misma duración, pide el breakdown de ese rango con el hook existente y muestra `+X% vs periodo anterior` bajo el importe. Si los datos del periodo anterior están vacíos, no muestres nada (evita "+∞%").

## Tarea 6.3 — Accesibilidad de chips de categoría

1. En `category-mega-selector.tsx` y `category-selector.tsx`, verifica que **todo** chip seleccionado muestra el icono Check además del cambio de color (hay sitios donde ya está; unifica).
2. Añade `aria-pressed={isSelected}` a los chips-botón para lectores de pantalla.
3. Revisa contraste: los textos `text-muted-foreground` sobre `bg-muted/20` en modo oscuro. Usa el inspector de accesibilidad de Chrome (Lighthouse → Accessibility) en `/transacciones` y `/analisis`; corrige los avisos de contraste subiendo la opacidad del texto (`text-muted-foreground` → `text-foreground/70` donde falle).

## Tarea 6.4 — Toasts de confirmación consistentes

`sonner` ya está instalado. Auditar acciones sin feedback:
1. Busca las mutaciones: crear/editar/borrar movimiento, cambiar categoría, crear categoría, subir archivo.
2. Donde no haya toast, añade:
   ```typescript
   import { toast } from "sonner"
   // tras éxito:
   toast.success("Movimiento guardado")
   // en catch:
   toast.error("No se pudo guardar el movimiento")
   ```
3. Comprueba que `<Toaster />` de sonner está montado en `app/layout.tsx` (si no, añádelo).

## Tarea 6.5 — Mejorar el editor de fechas de transacciones ⭐ (pedido por el usuario)

**Problemas (confirmados en el código):**
- **A. El calendario se abre en el mes de HOY**, no en el mes de la fecha de la transacción que estás editando. Causa: los `<Calendar>` reciben `selected` pero **no** `defaultMonth`/`month`, y react-day-picker usa la fecha actual por defecto para decidir qué mes mostrar.
- **B. No hay botón "Hoy"** en el popover del calendario para saltar rápido a la fecha actual.
- **C. Editar la fecha por texto es incómodo:** al teclear en medio del campo, `maskDateInput` (en `lib/utils/date-input.ts`) reformatea toda la cadena y el cursor **salta al final**, dando sensación de que "se borra y se sobreescribe".

**Hay 3 copias casi idénticas de este editor** → la mejor solución es **extraer un componente reutilizable `DateField`** y usarlo en los 3 sitios. Mata los 3 problemas de una vez y elimina duplicación.

**Archivos afectados:**
- `components/transactions/transaction-detail.tsx` (líneas ~480-536, ojo: hay **dos** bloques de fecha en este archivo)
- `components/transactions/transaction-create-panel.tsx` (líneas ~200-245)
- `components/transactions/transaction-form.tsx` (líneas ~156-213) — esta variante usa formato `yyyy-MM-dd` y validación más vieja; al migrar a `DateField` queda unificada con las otras dos (formato `DD/MM/AAAA`).
- Helpers existentes: `lib/utils/date-input.ts` (`maskDateInput`, `parseDateInputToIso`, `formatIsoDateToInput`)
- Calendar base: `components/ui/calendar.tsx` (react-day-picker)

**Pasos:**

1. **Crea el componente `components/ui/date-field.tsx`:**

   ```tsx
   "use client"

   import { useEffect, useRef, useState } from "react"
   import { es } from "date-fns/locale"
   import { CalendarIcon } from "lucide-react"
   import { Button } from "@/components/ui/button"
   import { Input } from "@/components/ui/input"
   import { Calendar } from "@/components/ui/calendar"
   import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
   import { formatIsoDateToInput, maskDateInput, parseDateInputToIso } from "@/lib/utils/date-input"

   interface DateFieldProps {
     /** Fecha en ISO "yyyy-mm-dd" (o null/"" si vacía). */
     value: string | null
     /** Se llama con la nueva fecha ISO "yyyy-mm-dd" cuando es válida. */
     onChange: (isoDate: string) => void
     id?: string
     className?: string
   }

   export function DateField({ value, onChange, id, className }: DateFieldProps) {
     const [open, setOpen] = useState(false)
     const [text, setText] = useState(() => formatIsoDateToInput(value))
     const inputRef = useRef<HTMLInputElement>(null)
     // nº de dígitos antes del cursor, para restaurar el caret tras enmascarar
     const caretDigitsRef = useRef<number | null>(null)

     // Mantener el texto en sync cuando cambia el value desde fuera (y no estamos escribiendo)
     useEffect(() => {
       setText(formatIsoDateToInput(value))
     }, [value])

     // Restaurar la posición del cursor después de reformatear (soluciona el "salto al final")
     useEffect(() => {
       if (caretDigitsRef.current === null || !inputRef.current) return
       const targetDigits = caretDigitsRef.current
       caretDigitsRef.current = null
       let pos = 0
       let seen = 0
       for (const ch of text) {
         if (seen >= targetDigits) break
         if (/\d/.test(ch)) seen++
         pos++
       }
       inputRef.current.setSelectionRange(pos, pos)
     }, [text])

     const selectedDate = value ? new Date(value) : undefined

     const commit = (date: Date) => {
       const y = date.getFullYear()
       const m = String(date.getMonth() + 1).padStart(2, "0")
       const d = String(date.getDate()).padStart(2, "0")
       onChange(`${y}-${m}-${d}`)
     }

     return (
       <div className={`flex gap-2 ${className ?? ""}`}>
         <Input
           id={id}
           ref={inputRef}
           type="text"
           inputMode="numeric"
           autoComplete="off"
           placeholder="DD/MM/AAAA"
           className="flex-1 h-9"
           value={text}
           onChange={(e) => {
             const el = e.target
             // contar dígitos a la izquierda del cursor ANTES de enmascarar
             const rawLeft = el.value.slice(0, el.selectionStart ?? el.value.length)
             caretDigitsRef.current = rawLeft.replace(/\D/g, "").length
             const masked = maskDateInput(el.value)
             setText(masked)
             const iso = parseDateInputToIso(masked)
             if (iso) onChange(iso)
           }}
           onBlur={() => setText(formatIsoDateToInput(value))}
         />
         <Popover open={open} onOpenChange={setOpen}>
           <PopoverTrigger asChild>
             <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" title="Abrir calendario">
               <CalendarIcon className="h-4 w-4" />
             </Button>
           </PopoverTrigger>
           <PopoverContent className="w-auto p-0 z-[80]" align="start">
             <Calendar
               mode="single"
               selected={selectedDate}
               // ⬇️ ESTA línea es la que hace que se abra en el mes de la transacción, no en hoy
               defaultMonth={selectedDate ?? new Date()}
               onSelect={(date) => {
                 if (date) {
                   commit(date)
                   setOpen(false)
                 }
               }}
               locale={es}
               initialFocus
             />
             <div className="border-t p-2">
               <Button
                 type="button"
                 variant="ghost"
                 size="sm"
                 className="w-full"
                 onClick={() => {
                   commit(new Date())
                   setOpen(false)
                 }}
               >
                 Hoy
               </Button>
             </div>
           </PopoverContent>
         </Popover>
       </div>
     )
   }
   ```

   Notas para no fallar:
   - `defaultMonth={selectedDate ?? new Date()}` es la clave del punto A. Como el `<Popover>` desmonta el contenido al cerrarse, cada apertura recalcula `defaultMonth` con la fecha actual de la transacción. (Si en pruebas vieras que NO se actualiza, es que el popover mantiene el contenido montado: en ese caso usa `month`/`onMonthChange` controlados y resetea `month` al abrir con `onOpenChange`.)
   - La restauración del caret (punto C) cuenta **dígitos**, no caracteres, porque las `/` se insertan/mueven solas.

2. **Sustituye los 3 editores por `<DateField>`.** En cada sitio, el estado de fecha vive como ISO `yyyy-mm-dd` en `formData.fecha` (en `transaction-detail` y `transaction-create-panel` ya es string ISO; en `transaction-form` es un objeto `Date` → conviértelo). Ejemplo en `transaction-detail.tsx`:

   ```tsx
   // ANTES: ~55 líneas de <Input> + <Popover> + <Calendar> + estados dateInput/isFormDateOpen
   // DESPUÉS:
   <DateField
     id="fecha"
     value={formData.fecha}
     onChange={(iso) =>
       setFormData((prev) =>
         prev.fecha === iso ? prev : { ...prev, fecha: iso, descripcion: appendHistoryNote(prev, "date") },
       )
     }
   />
   ```
   - Borra los estados que ya no se usan (`dateInput`, `isFormDateOpen`, `handleDateSelection` si solo servía para esto) **solo si no se referencian en otro sitio** (búscalo antes con grep).
   - ⚠️ En `transaction-detail.tsx` hay **dos** bloques de fecha (líneas ~389 y ~528). Migra los dos.
   - En `transaction-form.tsx`, donde `formData.fecha` es un `Date`: pasa `value={formData.fecha ? format(formData.fecha, "yyyy-MM-dd") : null}` y en `onChange={(iso) => setFormData({ ...formData, fecha: new Date(iso) })}`.

**Verificación:**
1. Edita una transacción antigua (ej. de hace 3 meses) y abre el calendario → debe mostrar **el mes de esa transacción**, no junio de 2026.
2. El botón **"Hoy"** aparece bajo el calendario y al pulsarlo pone la fecha de hoy y cierra el popover.
3. Escribe en el campo con el cursor **en medio** (ej. cambia solo el mes de `09/06/2026` a `09/12/2026`): el cursor ya no salta al final de forma molesta.
4. Funciona en las 3 pantallas: detalle/edición, creación rápida y el formulario completo.
5. `npx tsc --noEmit` limpio.

---

# FASE 7 — Tests mínimos viables

**Objetivo:** Crear la infraestructura de tests y cubrir solo las utilidades puras (bajo coste, detecta regresiones reales). NO intentar testear componentes todavía.

1. Instala: `pnpm add -D vitest @vitest/coverage-v8`
2. Crea `vitest.config.ts`:
   ```typescript
   import { defineConfig } from "vitest/config"
   import path from "path"

   export default defineConfig({
     test: {
       include: ["**/*.test.ts"],
       environment: "node",
     },
     resolve: {
       alias: { "@": path.resolve(__dirname, ".") },
     },
   })
   ```
3. Añade el script a `package.json`: `"test": "vitest run"`.
4. Escribe tests para:
   - `toLocalDateString` (creada en la Tarea 0.1): casos normales + 1 de enero + 31 de diciembre.
   - `applyAbsoluteAmountFilter` de `hooks/use-movimientos.ts` (es exportada y pura): rangos con from+to, solo from, solo to, valores negativos. Usa un mock-builder simple que registre las llamadas a `.gte/.lte/.or`.
   - Las funciones de rango de `timeframe-filter.tsx` (extráelas a `lib/utils/date.ts` si no lo están): "este curso escolar" en fechas límite (agosto vs septiembre).
   - Cualquier helper de `lib/utils/` (formateo de moneda, etc.).

**Verificación:** `pnpm test` en verde. A partir de aquí, ejecutar tests antes de cada commit.

---

# Resumen de prioridades y estimación

| # | Fase | Riesgo | Esfuerzo | Valor |
|---|------|--------|----------|-------|
| 0 | Bugs confirmados (fechas UTC, doble filtros, lockfile, logs, keys) | Bajo | 0,5-1 día | ⭐⭐⭐ Crítico — el bug de fechas afecta a datos mostrados |
| 1 | Tipos Supabase generados | Bajo | 1-2 días | ⭐⭐⭐ Detecta bugs latentes |
| 2 | loading/error/skeletons | Muy bajo | 0,5 día | ⭐⭐ UX visible |
| 3 | Bottom sheets móvil | Medio | 1 día | ⭐⭐⭐ Móvil |
| 4 | React Query piloto (2 hooks) | Medio | 1 día | ⭐⭐ Base para el futuro |
| 5 | Trocear category-list | Bajo (mecánico) | 1-2 días | ⭐⭐ Mantenibilidad |
| 6 | Visual menor (chevron, KPI, a11y, toasts) | Muy bajo | 0,5-1 día | ⭐⭐ Pulido |
| 7 | Tests mínimos | Muy bajo | 0,5 día | ⭐⭐ Red de seguridad |

**Orden de ejecución recomendado: 0 → 1 → 2 → 7 → 3 → 4 → 6 → 5.**
(Los tests van pronto —fase 7 tras la 2— porque protegen las utilidades de fecha que acabas de arreglar en la fase 0.)

---

# Checklist global antes de dar por terminado el plan

- [ ] `npx tsc --noEmit` sin errores
- [ ] `pnpm lint` sin errores
- [ ] `pnpm test` en verde
- [ ] `pnpm build` compila sin errores
- [ ] Probado en escritorio (1280px) y móvil (375px): transacciones, análisis, categorías, cuentas
- [ ] Probado en modo claro y oscuro
- [ ] El warning de lockfiles ya no sale al arrancar
- [ ] No quedan `console.log` (`grep -rn "console\.log" components lib hooks app`)
- [ ] Los filtros de periodo devuelven fechas correctas (Network tab: `gte=2025-09-01` para curso escolar)
