# Auditoría de Seguridad — MCM Bank

**Fecha:** 2026-02-17
**Alcance:** Análisis estático (Semgrep), auditoría de dependencias (npm audit), revisión manual del código fuente
**Rama:** `claude/security-audit-scan-w50hm`

---

> ⚠️ **Documento histórico**: esta auditoría corresponde a la fecha indicada y puede quedar desactualizada tras nuevos despliegues o cambios de dependencias.

## Resumen ejecutivo

| Severidad | Hallazgos |
|-----------|-----------|
| **CRÍTICA** | 3 |
| **ALTA** | 6 |
| **MEDIA** | 6 |
| **BAJA** | 3 |
| **INFO** | 5 (Semgrep) |

---

## 1. Análisis estático — Semgrep

**Herramienta:** Semgrep v1.151.0, config `auto`
**Resultado:** 5 hallazgos, todos de severidad INFO

| Regla | Archivo | Línea | Descripción |
|-------|---------|-------|-------------|
| `unsafe-formatstring` | `hooks/use-debug-calls.ts` | 45 | Concatenación de cadena no literal en `console.log` |
| `unsafe-formatstring` | `hooks/use-delegaciones-original.ts` | 19 | Ídem |
| `unsafe-formatstring` | `hooks/use-local-storage.ts` | 16 | Ídem |
| `unsafe-formatstring` | `hooks/use-local-storage.ts` | 25 | Ídem |
| `unsafe-formatstring` | `hooks/use-transacciones-original.ts` | 31 | Ídem |

**Evaluación:** Riesgo bajo. Son `console.log` con variables concatenadas, no utilizables para inyección en entorno browser. Recomendable eliminar los logs en producción.

---

## 2. Auditoría de dependencias — npm audit

### 2.1 Vulnerabilidades encontradas

| Paquete | Versión instalada | Severidad | CVE / Advisory | Descripción | Fix disponible |
|---------|-------------------|-----------|----------------|-------------|----------------|
| **next** | 16.1.4 | ALTA | [GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f) | DoS vía Image Optimizer `remotePatterns` | Sí → 16.1.6 |
| **next** | 16.1.4 | ALTA | [GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf) | DoS vía deserialización HTTP en React Server Components | Sí → 16.1.6 |
| **next** | 16.1.4 | ALTA | [GHSA-5f7q-jpqc-wp7h](https://github.com/advisories/GHSA-5f7q-jpqc-wp7h) | Consumo de memoria ilimitado vía PPR Resume Endpoint | Sí → 16.1.6 |
| **qs** | 6.14.1 | BAJA | [GHSA-w7fw-mjwx-w883](https://github.com/advisories/GHSA-w7fw-mjwx-w883) | Bypass de `arrayLimit` en comma parsing → DoS | Sí → 6.15.0 |
| **xlsx** | 0.18.5 | ALTA | [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) | Prototype Pollution en SheetJS | No (npm) |
| **xlsx** | 0.18.5 | ALTA | [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) | ReDoS en SheetJS | No (npm) |

### 2.2 Acciones recomendadas

1. **Actualizar Next.js** a `^16.1.6` en `package.json` (corrige 3 CVEs HIGH)
2. **xlsx (SheetJS):** La versión de npm (0.18.5) está abandonada. Opciones:
   - Instalar desde CDN oficial: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
   - Migrar a **ExcelJS** como alternativa mantenida
   - Usar paquete scoped: `@e965/xlsx`
3. **qs:** Se actualizará automáticamente con `npm audit fix`

### 2.3 Uso excesivo de `"latest"` en package.json

**17 dependencias** usan `"latest"` como versión, lo cual es una mala práctica de seguridad porque:
- Hace los builds no reproducibles
- Permite que una versión maliciosa o con breaking changes se instale automáticamente
- Dificulta la auditoría y el lockfile

**Dependencias afectadas:** `@hello-pangea/dnd`, `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-popover`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slot`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@supabase/ssr`, `@supabase/supabase-js`, `@vercel/analytics`, `cmdk`, `date-fns`, `frimousse`, `geist`, `lucide-react` (parcial), `next-themes`, `path`, `react-day-picker`, `react-dropzone`, `recharts`, `sonner`, `url`, `xlsx`

**Recomendación:** Fijar todas las versiones con `^x.y.z` usando las versiones actualmente instaladas.

---

## 3. Revisión manual — Hallazgos críticos

### 3.1 CRÍTICA: Endpoints de admin sin autenticación

**Archivos:**
- `app/api/admin/users/route.ts` (líneas 4-89)
- `app/api/admin/users/[id]/route.ts` (líneas 4-65)

**Problema:** Los endpoints `GET /api/admin/users`, `POST /api/admin/users`, `PUT /api/admin/users/[id]` y `DELETE /api/admin/users/[id]` no verifican la identidad ni el rol del usuario que realiza la petición. Utilizan `createAdminClient()` que opera con la `service_role_key` de Supabase, bypaseando completamente RLS.

**Vector de ataque:** Cualquier persona (incluso sin cuenta) puede:
- Listar todos los usuarios del sistema con sus emails y membresías
- Crear usuarios nuevos con cualquier rol (incluido `gestor_central`)
- Cambiar la contraseña de cualquier usuario existente
- Eliminar cualquier cuenta de usuario
- Asignarse membresías en cualquier delegación

**Remediación requerida:**
```typescript
// Añadir al inicio de cada handler:
import { createClient } from "@/lib/supabase/server"

const supabase = createClient()
const { data: { user }, error } = await supabase.auth.getUser()
if (!user) {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 })
}

// Verificar rol de admin
const { data: membership } = await supabase
  .from("membresia")
  .select("rol")
  .eq("usuario_id", user.id)
  .eq("rol", "gestor_central")
  .single()

if (!membership) {
  return NextResponse.json({ error: "No autorizado" }, { status: 403 })
}
```

### 3.2 CRÍTICA: Endpoint de diagnóstico expuesto

**Archivo:** `app/api/supabase-sanity/route.ts` (líneas 28-52)

**Problema:** `GET /api/supabase-sanity` no requiere autenticación y expone:
- Nombres de tablas de la base de datos
- Conteo de filas por tabla
- Datos de muestra (3 primeras filas de cada tabla)

**Remediación:** Eliminar el endpoint o protegerlo con autenticación + verificación de rol admin.

### 3.3 CRÍTICA: Rutas incompletas en middleware de protección

**Archivo:** `lib/supabase/middleware.ts` (línea 57)

```typescript
const protectedRoutes = ["/transacciones", "/categorias", "/cuentas", "/delegaciones", "/movimientos"]
```

**Rutas NO protegidas que deberían estarlo:**
- `/configuracion` — Página de administración de usuarios
- `/diagnostico` — Página de diagnóstico del sistema
- `/propuestas` — Propuestas de mejora
- `/api/admin/*` — Endpoints de administración (los más críticos)
- `/` — Página principal (redirige client-side pero no server-side)

**Remediación:**
```typescript
const protectedRoutes = [
  "/transacciones", "/categorias", "/cuentas", "/delegaciones",
  "/movimientos", "/configuracion", "/diagnostico", "/propuestas",
  "/api/admin"
]
```

---

## 4. Revisión manual — Hallazgos de severidad alta

### 4.1 ALTA: Autorización basada solo en cliente

**Archivos:**
- `hooks/use-is-admin.ts` — Comprobación de admin solo client-side
- `hooks/use-delegation-role.ts` — Comprobación de rol solo client-side
- `components/configuracion/config-page.tsx` — Página de admin sin protección server-side

**Problema:** Las verificaciones de rol (`gestor_central`, `tesorero`, etc.) se realizan exclusivamente en el cliente mediante queries directas a Supabase. Un usuario malicioso puede:
- Inspeccionar/modificar las respuestas en DevTools
- Navegar directamente a rutas protegidas
- Realizar operaciones sin pasar por las comprobaciones UI

**Nota:** Si Supabase RLS está correctamente configurado, esto mitiga parte del riesgo, pero no todo (especialmente los endpoints admin que usan `service_role_key`).

### 4.2 ALTA: Aislamiento de delegaciones insuficiente (server-side)

**Archivos:**
- `contexts/delegation-context.tsx` (línea 22-24) — `delegacionId` almacenado en `localStorage`
- `hooks/use-movimientos.ts` — Operaciones CRUD filtran por delegación solo client-side
- `lib/services/database.ts` — Queries sin verificación de membresía

**Problema:** El `delegacionId` seleccionado se almacena en `localStorage` y se usa como filtro en las queries. Un usuario podría cambiar este valor para acceder a datos de delegaciones a las que no pertenece.

**Dependencia crítica:** La seguridad depende enteramente de que las políticas RLS de Supabase estén correctamente configuradas para filtrar por membresía del usuario. No hay verificación server-side adicional.

### 4.3 ALTA: Validación de email débil

**Archivo:** `app/api/admin/users/route.ts` (línea 44)

```typescript
const emailRegex = /.+@.+\..+/
```

Este regex acepta emails claramente inválidos como `@.a`, `  @  .  `, etc.

**Corrección:**
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

### 4.4 ALTA: `ignoreBuildErrors: true` en Next.js config

**Archivo:** `next.config.mjs` (línea 5)

```javascript
typescript: {
  ignoreBuildErrors: true,
}
```

Esto permite que errores de TypeScript pasen a producción, lo cual puede ocultar bugs de seguridad relacionados con tipos incorrectos.

### 4.5 ALTA: Bypass de middleware si Supabase no está configurado

**Archivo:** `lib/supabase/middleware.ts` (líneas 13-17)

```typescript
if (!isSupabaseConfigured) {
  return NextResponse.next({ request })
}
```

Si las variables de entorno de Supabase no están configuradas (error de despliegue), el middleware permite el acceso a todas las rutas sin autenticación.

### 4.6 ALTA: Exposición de información de error en APIs

**Archivos:** `app/api/admin/users/route.ts`, `app/api/admin/users/[id]/route.ts`, `app/api/supabase-sanity/route.ts`

Los mensajes de error de Supabase se devuelven directamente al cliente, exponiendo información interna (nombres de tablas, tipos de constraints, etc.).

---

## 5. Revisión manual — Hallazgos de severidad media

### 5.1 MEDIA: Sin security headers configurados

**Archivo:** `next.config.mjs`

Faltan headers de seguridad críticos:
- `Content-Security-Policy` (CSP)
- `X-Frame-Options` / `frame-ancestors`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy`
- `Permissions-Policy`

**Remediación recomendada para `next.config.mjs`:**
```javascript
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ]
  },
}
```

### 5.2 MEDIA: Sin rate limiting en endpoints

No hay rate limiting configurado en ningún endpoint, lo que permite:
- Fuerza bruta en login (aunque Supabase tiene protección propia)
- Enumeración masiva de usuarios vía `/api/admin/users`
- Creación masiva de cuentas vía `/api/admin/users` POST
- DoS vía queries pesadas

### 5.3 MEDIA: Página de diagnóstico expone variables de entorno

**Archivo:** `components/diagnostics/diagnostic-center.tsx` (líneas 35-38)

```typescript
env: {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}
```

Aunque son variables `NEXT_PUBLIC_`, mostrarlas explícitamente facilita el reconocimiento.

### 5.4 MEDIA: Logging excesivo con datos sensibles

**145+ sentencias `console.log`/`console.error`** en el código, incluyendo:
- URLs de OAuth y variables de entorno (`components/auth/login-form.tsx:49-55`)
- IDs de usuario en callbacks de autenticación (`app/auth/callback/route.ts:27,36,41`)
- Datos de operaciones de base de datos

**Recomendación:** Implementar un sistema de logging condicional que no emita en producción:
```typescript
const log = process.env.NODE_ENV === 'development' ? console.log : () => {}
```

### 5.5 MEDIA: Propuestas de mejora sin aislamiento de delegación

**Archivo:** `hooks/use-improvement-proposals.ts` (líneas 116-195)

Las propuestas de mejora se cargan globalmente sin filtro de delegación. Cualquier usuario autenticado puede ver y modificar el estado de todas las propuestas.

### 5.6 MEDIA: Emails hardcodeados

**Archivo:** `lib/actions/auth.ts` (líneas 96-97)

```typescript
from: "MCM Bank Accesos <no-reply@movimientoconsolacion.com>",
to: ["ajmcm@movimientoconsolacion.com"],
```

Deberían moverse a variables de entorno para facilitar el mantenimiento.

---

## 6. Revisión manual — Hallazgos de severidad baja

### 6.1 BAJA: `@typescript-eslint/no-explicit-any` desactivado

**Archivo:** `eslint.config.js` (línea 28)

Permite el uso de `any` en todo el proyecto, reduciendo la seguridad de tipos.

### 6.2 BAJA: Imagen no optimizada

**Archivo:** `next.config.mjs` (línea 8)

```javascript
images: { unoptimized: true }
```

Desactiva la optimización de imágenes de Next.js, lo que además de afectar rendimiento, evita las protecciones integradas del Image Optimizer.

### 6.3 BAJA: Credenciales de demo en documentación

**Archivos:** `CLAUDE.md` (línea 52), `README.md` (línea 12)

```
Demo user: admin@movimientoconsolacion.com / password 1234
```

Aceptable para desarrollo, pero se debe verificar que estas credenciales no funcionan en producción.

---

## 7. Revisión de versiones instaladas

| Dependencia | Versión instalada | Última estable | Estado |
|-------------|-------------------|----------------|--------|
| Node.js | 22.22.0 | 22.x LTS | OK |
| Next.js | 16.1.4 | 16.1.6 | **Actualizar** (3 CVEs HIGH) |
| React | 19.2.3 | 19.2.3 | OK |
| React DOM | 19.2.3 | 19.2.3 | OK |
| TypeScript | 5.9.3 | 5.9.x | OK |
| Tailwind CSS | 3.4.19 | 3.4.x | OK |
| @supabase/supabase-js | 2.91.0 | 2.91.x | OK |
| @supabase/ssr | 0.8.0 | 0.8.x | OK |
| ESLint | 9.39.2 | 9.39.x | OK |
| xlsx | 0.18.5 | — | **Reemplazar** (abandonado, 2 CVEs HIGH) |
| qs | 6.14.1 | 6.15.0 | **Actualizar** (1 CVE LOW) |
| Zod | 3.25.76 | 3.25.x | OK |
| PostCSS | 8.5.6 | 8.5.x | OK |

---

## 8. Recomendaciones priorizadas

### Prioridad 1 — Inmediata (CRÍTICA)

1. **Proteger endpoints `/api/admin/*`**: Añadir autenticación + verificación de rol `gestor_central` a todos los handlers
2. **Actualizar Next.js** a `>=16.1.6` para corregir 3 CVEs de severidad alta
3. **Proteger o eliminar `/api/supabase-sanity`**: Endpoint de diagnóstico accesible sin autenticación

### Prioridad 2 — Corto plazo (ALTA)

4. **Ampliar rutas protegidas** en middleware: añadir `/configuracion`, `/diagnostico`, `/propuestas`, `/api/admin`
5. **Reemplazar `xlsx`** por una alternativa mantenida (CDN SheetJS o ExcelJS)
6. **Eliminar `ignoreBuildErrors: true`** del `next.config.mjs`
7. **Implementar verificación de autorización server-side** para operaciones de datos sensibles
8. **Mejorar validación de email** en el endpoint de creación de usuarios

### Prioridad 3 — Medio plazo (MEDIA)

9. **Configurar security headers** en Next.js (CSP, HSTS, X-Frame-Options, etc.)
10. **Implementar rate limiting** en endpoints críticos (admin, auth)
11. **Eliminar logs sensibles** en producción
12. **Fijar versiones** de todas las dependencias que usan `"latest"`
13. **Eliminar exposición de env vars** en la página de diagnóstico
14. **Mover emails hardcodeados** a variables de entorno

### Prioridad 4 — Largo plazo (BAJA)

15. **Habilitar `@typescript-eslint/no-explicit-any`** gradualmente
16. **Configurar optimización de imágenes** de Next.js
17. **Implementar audit logging** para operaciones privilegiadas
18. **Verificar políticas RLS** de Supabase para todas las tablas

---

## 9. Aspectos positivos

- Variables de entorno correctamente gestionadas (no hay secrets hardcodeados)
- `.gitignore` bien configurado (excluye `.env*`)
- Supabase service role key no expuesta al cliente
- No se usa `dangerouslySetInnerHTML` ni `eval()`
- Validación de redirección para prevenir open redirect (`lib/supabase/redirect.ts`)
- TypeScript strict mode habilitado
- Gestión de cookies delegada a Supabase SSR (HttpOnly, Secure por defecto)
- Middleware refresca sesión en cada request

---

*Informe generado automáticamente. Revisar hallazgos y aplicar remediaciones según prioridad.*
