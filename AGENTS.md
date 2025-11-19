# 🧑‍💻 Guía rápida para colaborar en MCM Bank

Este documento reúne las normas de trabajo para todo el repositorio. Si editas archivos en subcarpetas con su propio `AGENTS.md`, respeta primero el más específico.

## 📦 Arquitectura del proyecto
- `app/`: Rutas del App Router de Next.js (`layout.tsx`, `page.tsx` y features como `auth/`, `cuentas/`, `transacciones/`).
- `components/`: Componentes reutilizables (UI base, dashboards, formularios, etc.).
- `lib/`: Lógica de negocio (`services/`, `utils/`, `supabase/`, `types/`). Usa siempre el alias `@/` (ej. `@/lib/utils`).
- `hooks/`, `contexts/`: Hooks personalizados y providers de React.
- `public/`: Assets estáticos (logos, placeholders).
- `scripts/`: Utilidades y SQL para inicializar/diagnosticar datos.
- `styles/`: Estilos globales; Tailwind configurado en `tailwind.config.ts`.

## 🧰 Comandos esenciales
- Instalar dependencias: `pnpm install` (o `npm install`). El proyecto requiere Node `>= 20`; puedes usar `.nvmrc` → `nvm use`.
  > **IMPORTANTE:** Si realizas cambios importantes en dependencias usando `npm`, ejecuta SIEMPRE `npx pnpm install` después para sincronizar el archivo `pnpm-lock.yaml`, ya que Vercel lo prioriza para el despliegue.
- Desarrollo local: `pnpm dev` (Next.js en `http://localhost:3000`).
- Build de producción: `pnpm build`.
- Servir la build: `pnpm start`.
- Linter: `pnpm lint`.

## ✨ Estilo de código
- TypeScript estricto, componentes de React como funciones.
- Nombres de archivo en kebab-case (`amount-display.tsx`), componentes exportados en PascalCase y variables/funciones en camelCase.
- Usa Tailwind CSS y utilidades como `cn(...)` de `@/lib/utils` para combinar clases.
- Prefiere imports absolutos con `@/` en lugar de rutas relativas profundas.
- Respeta el formateo por defecto de ESLint/Next (indentación de 2 espacios).

## 🧪 Testing
- Todavía no hay runner configurado. Si agregas tests, usa React Testing Library + Vitest.
- Ubica las pruebas junto al archivo (`*.test.tsx`) o bajo `components/__tests__/`.
- Enfócate en paths críticos (auth, transacciones, servicios en `lib/`).
- Una vez configurado, ejecuta con `pnpm test` (añade `"test": "vitest"` al package.json cuando corresponda).

## 📦 Commits y PRs
- Mensajes cortos e imperativos (≤72 caracteres). Puedes usar Convencional Commits (`feat(cuentas): resumen`) pero no es obligatorio.
- Referencia issues cuando aplique (`Fix delegación filter (#123)`).
- PRs: explica objetivo, enlaza issues, adjunta capturas para cambios de UI y describe pasos de QA. Evita mezclar refactors sin relación.

## 🔐 Variables y seguridad
- Configura `.env.local` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`. No subas secretos al repo.
- Diferencia cliente vs. servidor: solo expón claves con prefijo `NEXT_PUBLIC_`. Si una clave se filtra, rótala desde Supabase.

¡Gracias por mantener coherente el proyecto! 💙
