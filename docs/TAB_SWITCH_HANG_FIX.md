# Fix: cuelgues en cambio de pestaña / minimizar Chrome

> **TL;DR** — `@supabase/auth-js` registra su propio listener de
> `visibilitychange` que dispara una recuperación de sesión interna
> (`_recoverAndRefresh`). En ciertas condiciones (red zombie post-suspend
> de Chrome, contención de `navigator.locks`, etc.) ese flujo interno se
> queda atascado y bloquea `_getAccessToken()`. Como toda query
> `supabase.from(...).select(...)` espera el access token, **todas las
> consultas se quedan colgadas hasta su timeout sin llegar siquiera a
> `window.fetch`**.
>
> Solución: bloqueo permanente del registro de listeners de
> `visibilitychange`/`pageshow`/`focus` por parte del cliente Supabase.
> Solo nuestro propio listener (en `useAppStatus`) puede registrarse, vía
> el helper `addOurVisibilityListener`.

---

## Síntomas

- App carga bien tras `F5`.
- Usuario cambia de pestaña en Chrome (o minimiza la ventana) durante unos
  segundos y vuelve.
- Cualquier página que renderiza datos (Categorías, Cuentas, Movimientos,
  Dashboard) muestra **"Cargando…" indefinidamente**.
- Hasta que el usuario hace `F5` (a veces `Ctrl+F5` para limpiar cache),
  no se recupera.
- En consola se ve:
  ```
  [useCategorias] error after 12001ms: Error: categorias timeout after 12000ms
  [useMovimientos] Request timed out after 15000ms
  ```
- En el panel **Network** filtrando por `supabase.co`: **no aparecen
  peticiones nuevas** durante el cuelgue. Las queries no llegan a la red.

## Diagnóstico

Pasamos por varias hipótesis antes de aterrizar la causa real:

| # | Hipótesis | Resultado |
|---|-----------|-----------|
| 1 | Race entre `setUser` (auth) y `appStatusEmitter.emit()` | Fix aplicado, no resuelve |
| 2 | Hooks bailan en `!user` al perder estado | Sí ocurría, mitigado pero no causa raíz |
| 3 | `navigator.locks` deadlock por suspend | Mitigado con `noLock`, no resuelve |
| 4 | Vercel CDN servía HTML cacheado con chunks viejos | Mitigado con `force-dynamic`, no resuelve |
| 5 | `getSession()` cuelga 8s+ en lock | Mitigado quitando `getSession()` inicial |
| 6 | `refreshSession()` cuelga por red zombie | Mitigado eliminando refresh en visibility |
| 7 | Fetches zombie tras suspend Chrome | Mitigado con `abortAllInFlight` |
| ✅ | **Listener interno de Supabase wedge auth state machine** | **Causa raíz** |

### La señal definitiva

Con logs `console.log` añadidos en cada checkpoint, después de cambiar de
pestaña vimos en consola:

```
[useCategorias] querying Supabase…
[DatabaseService.getCategoriasByDelegacion] awaiting query…
[useMovimientos] fetch start { delegacionId: '…', pageIndex: 0 }
[auth] onAuthStateChange: SIGNED_IN { userId: '…', elapsedMs: 44658 }
```

Pero **NUNCA** `[fetch] GET /rest/v1/categoria → start`. La query estaba
ejecutándose dentro del SDK de Supabase pero no llegaba a `window.fetch`.
Doce segundos después saltaba el timeout de seguridad.

El evento `onAuthStateChange: SIGNED_IN` disparándose tras un simple
cambio de pestaña era el indicador clave: Supabase estaba ejecutando un
flujo de "reconexión" sin que nosotros lo pidiéramos.

### Cómo Supabase JS provoca esto

`@supabase/auth-js` (dependencia interna de `@supabase/ssr`) registra un
listener de `visibilitychange` cuando el cliente se inicializa
perezosamente (en la primera llamada a `onAuthStateChange` o cualquier
método de auth). Cada vez que la pestaña gana foco, ese listener llama a
`_recoverAndRefresh()` que:

1. Lee la sesión persistida de cookies.
2. Si el access token está cerca de expirar, intenta `refreshSession()`
   — `POST /auth/v1/token`.
3. Si el `POST` no responde (red zombie tras suspend de Chrome), todo el
   flujo se queda en `await`.
4. **Mientras tanto, cualquier `_getAccessToken()` posterior espera al
   mutex interno de auth**. Por eso `supabase.from(...).select(...)` no
   llega ni a `fetch`: está dentro de la fase pre-query bloqueada.

Configurar `autoRefreshToken: false` no ayuda — ese flag desactiva el
*timer* de refresh, no el listener de visibility.

## Solución

### 1. Bloqueo permanente del listener (`lib/supabase/client.ts`)

Monkey-patch a `document.addEventListener` y `window.addEventListener`
**antes** de crear el cliente de Supabase. Cualquier intento de registrar
un listener de `visibilitychange` / `pageshow` / `focus` se descarta
silenciosamente, salvo que nuestra bandera interna esté activa.

```typescript
let _allowOurVisibilityRegistration = false

function installVisibilityBlock() {
  if (typeof document === "undefined" || typeof window === "undefined") return
  const origDocAdd = document.addEventListener.bind(document)
  const origWinAdd = window.addEventListener.bind(window)

  ;(document as any).addEventListener = function (type, listener, options) {
    if (type === "visibilitychange" && !_allowOurVisibilityRegistration) return
    return origDocAdd(type, listener, options)
  }
  ;(window as any).addEventListener = function (type, listener, options) {
    if (
      (type === "visibilitychange" || type === "pageshow" || type === "focus")
      && !_allowOurVisibilityRegistration
    ) return
    return origWinAdd(type, listener, options)
  }
}
installVisibilityBlock()
```

### 2. Helper para nuestros propios listeners

```typescript
export function addOurVisibilityListener(
  type: "visibilitychange" | "pageshow" | "focus",
  listener: EventListener,
  target: "document" | "window" = "document",
): () => void {
  _allowOurVisibilityRegistration = true
  try {
    if (target === "window") window.addEventListener(type, listener)
    else document.addEventListener(type, listener)
  } finally {
    _allowOurVisibilityRegistration = false
  }
  return () => { /* idem para remove */ }
}
```

### 3. `useAppStatus` usa el helper

```typescript
const unsubVis = addOurVisibilityListener("visibilitychange", handleVisibilityChange, "document")
const unsubShow = addOurVisibilityListener("pageshow", handlePageShow, "window")
```

Nuestro `handleVisibilityChange` se encarga de:
1. `abortAllInFlight()` — matar fetches zombie.
2. `_bumpFocusVersion()` — disparar `useEffect([focusVersion])` en todos
   los hooks de datos para que vuelvan a consultar limpiamente.

## Cambios secundarios (defensa en profundidad)

Aunque el bloqueo del listener arregla la causa raíz, mantenemos varias
defensas que ayudan en casos raros:

| Cambio | Archivo | Razón |
|--------|---------|-------|
| `noLock` (identity) en `auth.lock` | `lib/supabase/client.ts` | Elimina contención de `navigator.locks` |
| `autoRefreshToken: false` | `lib/supabase/client.ts` | Sin refresh paralelo en cascada al resumir |
| Sin `getSession()` inicial | `contexts/auth-context.tsx` | Solo `onAuthStateChange` (canal de eventos) |
| `addEventListener` block permanente | `lib/supabase/client.ts` | **Causa raíz** |
| `abortAllInFlight()` global | `lib/db/in-flight.ts` | Mata fetches zombie en visibility change |
| `useFocusVersion` con `useSyncExternalStore` | `hooks/use-app-status.ts` | Hooks reaccionan via React render, no callbacks externos |
| Stale-while-revalidate | `useDelegations`, `useCategorias` | Datos viejos visibles mientras refresca |
| Self-heal en `useDelegations` | `hooks/use-delegations.ts` | Si React `user=null`, lee userId de Supabase storage |
| `force-dynamic` en root layout | `app/layout.tsx` | Evita HTML cacheado por Vercel CDN |
| Banner de recuperación | `components/stuck-recovery-banner.tsx` | Última línea: botones manuales si todo falla |

## Validación

Después del fix, en consola al cargar app:
```
(no logs)              ← Supabase no consigue registrar listener
```

Al cambiar de pestaña:
```
(no [auth] SIGNED_IN inesperado)
[fetch] GET /rest/v1/categoria → start
[fetch] GET /rest/v1/categoria ← 200 (87ms)
```

Datos cargan normal. Persisten al cambiar de pestaña múltiples veces.

## Riesgos

1. **Si Supabase actualiza su lib y cambia cómo registra listeners**
   (p.ej. usa `Document.body.addEventListener` o `EventTarget` directo),
   el bloqueo deja de funcionar. Probar tras cada `pnpm update`.
2. **El bloqueo afecta a todo `addEventListener` global**. Otras libs
   que registren `visibilitychange` también quedan suprimidas. A día de
   hoy ningún otro consumidor del proyecto lo necesita; revisar si
   añadimos analytics que dependan de visibility.
3. **Cross-tab token sync deshabilitado** (por `noLock`). Si un usuario
   abre dos pestañas de la app y ambas refrescan token a la vez, una
   round-trip puede fallar y reintentar. Aceptable vs. el bug original.

## Archivos clave

```
lib/supabase/client.ts                 ← bloqueo + cliente Supabase
hooks/use-app-status.ts                ← visibility handler propio + focus version
lib/db/in-flight.ts                    ← registro global de AbortControllers
hooks/use-categorias.ts                ← timeout duro + stale-while-revalidate
hooks/use-delegations.ts               ← self-heal con timeout
hooks/use-movimientos.ts               ← registra AC en in-flight
contexts/auth-context.tsx              ← solo onAuthStateChange, sin getSession()
contexts/movimientos-cache-context.tsx ← AC + timeout en cache provider
components/stuck-recovery-banner.tsx   ← UI de último recurso
app/layout.tsx                         ← force-dynamic
next.config.mjs                        ← Cache-Control: no-store en HTML
```

## Historial de la rama

Branch: `test-reiniciar-conexion`. Commits relevantes (más reciente arriba):

1. `chore: clean up diagnostic logs`
2. `fix(auth): block Supabase's visibilitychange listener globally` ← **fix definitivo**
3. `diag: switch all diagnostic logs to console.log`
4. `diag: install fetch interceptor`
5. `diag: comprehensive logging + disable Supabase autoRefreshToken`
6. `fix(auth): drop refreshSession on tab focus + register movimientos AC`
7. `fix(auth): identity lock + nuclear storage reset`
8. `fix(auth): drop getSession() init`
9. `fix(cache): force-dynamic root + stuck-state recovery banner`
10. `fix(auth): forceConnectionReset re-inits auth + useDelegations self-heals`
11. `feat(ui): add manual reconnect button` (revertido)
12. `fix(auth): eliminate refresh collision + BFCache/online recovery`
13. `fix(auth): kill zombie fetches + stale-while-revalidate`
14. `fix(auth): replace emitter with useSyncExternalStore`
15. `fix(auth): tab-focus infinite loading after session recovery`
16. `fix(auth): mount useAppStatus in ConnectionMonitor`
