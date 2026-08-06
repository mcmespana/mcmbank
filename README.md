# 🏦 MCM Bank

¡Hola! Este repositorio contiene la versión web del panel financiero usado por las delegaciones del Movimiento Consolación para el Mundo. La app permite llevar un control limpio de ingresos, gastos y balances por actividades, con importaciones bancarias guiadas y dashboards listos para compartir.

## 🚀 TL;DR para arrancar
1. Clona el repo y entra en la carpeta del proyecto.
2. Asegura Node.js 20 (`nvm use` si tienes el archivo `.nvmrc`).
3. Instala dependencias con `pnpm install` (habilita pnpm ejecutando `corepack enable` una vez).
4. Crea `.env.local` con tus claves de Supabase (ver más abajo).
5. Ejecuta `pnpm dev` y abre `http://localhost:3000`.

> 🧪 Para probar la app necesitas un usuario con membresía en alguna delegación.
> Pide acceso al equipo de la oficina técnica; las credenciales **no se guardan
> en el repositorio**.

## 📋 Requisitos
- **Node.js ≥ 20** (el repo incluye `.nvmrc`).
- **pnpm ≥ 8** (viene con Node 20 usando Corepack).
- **Cuenta Supabase** para obtener `URL` y `anon key`.

## 🛠️ Instalación paso a paso
```bash
# 1. Clonar y entrar
 git clone https://github.com/mcmespana/mcmbank.git
 cd mcmbank

# 2. Seleccionar la versión de Node recomendada
 nvm use

# 3. Habilitar pnpm (solo la primera vez)
 corepack enable

# 4. Instalar dependencias
 pnpm install
```

### Variables de entorno
Copia `.env.example` a `.env.local` en la raíz y rellena los valores reales:

```bash
cp .env.example .env.local
```

Mínimo para arrancar en local (Supabase):
```bash
NEXT_PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="tu-clave-anon"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL="http://localhost:3000/auth/callback"
```

El resto de variables (`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`,
`MCM_API_KEY`, las de Enable Banking y las de la integración con Google) solo
son necesarias para funcionalidades concretas (admin, avisos por email, API
externa, sincronización bancaria, memorias económicas) — ver `.env.example`
para la lista completa con comentarios, y `docs/ENABLE_BANKING.md` para el
detalle de las variables de Enable Banking.

> 💡 Después de añadir o cambiar variables, reinicia el servidor de desarrollo.

### Ejecutar la app
```bash
# Servidor de desarrollo
pnpm dev

# Compilar para producción
pnpm build

# Servir la build localmente
pnpm start
```

### Calidad y mantenimiento
```bash
# Linter en modo lectura
pnpm lint

# Linter con autofix
pnpm lint:fix
```

## 🧭 Estructura esencial del proyecto
- `app/`: Rutas App Router de Next.js (auth, cuentas, transacciones, etc.).
- `components/`: Componentes reutilizables (UI, dashboard, formularios).
- `lib/`: Servicios, utilidades y clientes Supabase (`@/lib/...`).
- `hooks/` y `contexts/`: Hooks personalizados y providers de React.
- `docs/`: Manual funcional para las delegaciones (`docs/README.md`).
- `scripts/`: Utilidades y scripts de soporte (ej. comprobaciones de Supabase).

## 📚 Recursos útiles
- Manual funcional: `docs/README.md` y capítulos numerados para cada módulo.
- Guía rápida de categorías, cuentas y movimientos en `docs/03-categorias.md`, `docs/04-cuentas.md` y `docs/06-movimientos.md`.
- Configuración detallada del proyecto y convenciones internas en `AGENTS.md`.

## 🤝 Cómo contribuir
1. Crea una rama descriptiva (`git checkout -b feat/nueva-funcionalidad`).
2. Sigue las convenciones de código descritas en `AGENTS.md` (TypeScript estricto, Tailwind + `cn`).
3. Verifica el linting y documenta cualquier comando/test que ejecutes.
4. Abre un PR incluyendo contexto, capturas si hay cambios de UI y pasos de QA.

¡Gracias por aportar a la transparencia financiera del movimiento! 💙
