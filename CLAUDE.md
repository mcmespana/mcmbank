# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCM Bank is a Next.js 16 financial dashboard web application for managing income, expense tracking, and account balances for delegations of "Movimiento Consolación para el Mundo". The app uses Supabase for authentication and database, with React 19, TypeScript, and Tailwind CSS 3.

## Essential Commands

### Development
```bash
pnpm install          # Install dependencies (requires Node >= 20, .nvmrc targets 24)
pnpm dev              # Start dev server at http://localhost:3000
pnpm build            # Production build (TypeScript errors are ignored via next.config.mjs)
pnpm start            # Serve production build
```

### Code Quality
```bash
pnpm lint             # Run ESLint in check mode
pnpm lint:fix         # Run ESLint with auto-fix
```

### Node Version
The project requires Node.js >= 20 (`.nvmrc` specifies Node 24). Use `nvm use` to activate.

### Dependency Management
The project uses **pnpm** as its package manager. If you make dependency changes with npm, always run `npx pnpm install` afterwards to keep `pnpm-lock.yaml` in sync (Vercel uses it for deployment).

## Architecture & Data Model

### Database Schema
The app uses Supabase with a hierarchical structure:
- **organizacion** → **delegacion** → **cuenta** → **movimiento**
- **categoria**: Expense/income categories (can be global or delegation-specific)
- **categoria_orden_delegacion**: Per-delegation category ordering/visibility overrides
- **membresia**: User-delegation role assignments
- **perfil**: User profiles (auto-created on sign-in via AuthContext)
- **movimiento_archivo**: File attachments for transactions
- **propuesta_mejora**: Improvement proposals (ideas and bug reports)
- **propuesta_mejora_comentario**: Comments on proposals
- **propuesta_mejora_voto**: Votes/reactions on proposals

Type definitions for all tables are in `lib/types/database.ts` (Row/Insert/Update types for each table).

### Supabase Client Patterns
The app uses three different Supabase client patterns:
1. **Client-side** (`lib/supabase/client.ts`): Browser client for client components
2. **Server-side** (`lib/supabase/server.ts`): Server client using cookies for RSC and Server Actions
3. **Admin** (`lib/supabase/admin.ts`): Admin client with service role key (use sparingly)

Always import the appropriate client based on component type (client vs server component).

### Authentication Flow
- **AuthContext** (`contexts/auth-context.tsx`): Client-side auth state management; auto-creates user profile on sign-in
- **Middleware** (`proxy.ts` → `lib/supabase/middleware.ts`): Session refresh on every request
- Protected routes: `/transacciones`, `/categorias`, `/cuentas`, `/delegaciones`, `/movimientos` — redirect to `/auth/login` if unauthenticated
- Authenticated users accessing `/auth` pages are redirected to `/`
- Server actions for auth in `lib/actions/auth.ts`
- Demo user: `admin@movimientoconsolacion.com` / password `1234`

### Delegation Context
The app uses a **DelegationContext** (`contexts/delegation-context.tsx`) that:
- Manages the currently selected delegation across the entire app
- Auto-selects the first delegation when user logs in
- Persists selection to localStorage
- Provides `selectedDelegation`, `setSelectedDelegation()`, `delegations`, `loading`, `error`
- Used by all data hooks to filter records by delegation

### Provider Hierarchy
All providers are composed in `contexts/app-providers.tsx`:
```
ThemeProvider → AuthProvider → DelegationProvider → MovimientosCacheProvider
```
Also includes: `ThemeStateWatcher`, `ConnectionMonitor`, `Toaster` (Sonner).

## Key Architectural Patterns

### Data Fetching Strategy
- **Hooks** (`hooks/`): Custom hooks for data fetching with useState + useEffect patterns
- **Services** (`lib/services/`): Abstraction layer over Supabase queries
  - `database.ts`: Client-side database operations (`DatabaseService`)
  - `server-database.ts`: Server-side database operations (`ServerDatabaseService`)
  - `file-service.ts`: File upload/download via Supabase Storage
  - `improvement-proposals.ts`: Proposal CRUD, voting, and comments
- **Query utilities** (`lib/db/`): Query execution with timeout handling (`query.ts`) and telemetry (`telemetry.ts`)
- **Caching**: TTL-based caching in hooks (e.g., `useCuentas` uses 30s TTL), plus `MovimientosCacheContext` for transaction caching
- **Performance**: Debounced state updates, query revalidation on focus with jitter, pagination support (100 items default)

### Core Hooks
| Hook | Purpose |
|------|---------|
| `use-movimientos.ts` | Transactions with filters (pagination, search, date range, amounts, categories) |
| `use-cuentas.ts` | Accounts with TTL caching |
| `use-categorias.ts` | Categories with override system |
| `use-delegaciones.ts` | User's delegations |
| `use-user-delegaciones.ts` | User-specific delegation memberships |
| `use-delegation-role.ts` | Current user role in delegation |
| `use-is-admin.ts` | Admin check |
| `use-perfil.ts` | User profile |
| `use-improvement-proposals.ts` | Proposals CRUD, voting, commenting |
| `use-movimiento-archivos.ts` | Transaction file attachments |
| `use-delegation-counts.ts` | Counts of items per delegation |
| `use-app-status.ts` | App status with debounced revalidation |
| `use-local-storage.ts` | Persistent localStorage state |
| `use-debounced-state.ts` | Debounced state updates |
| `use-debug-calls.ts` | Debug excessive hook calls |

### Category System
Categories have a sophisticated override system:
- Global categories (`es_global: true`) are shared across all delegations
- Delegation-specific categories belong to one delegation
- Per-delegation overrides stored in `categoria_orden_delegacion` for custom ordering and visibility
- Type `CategoriaConOrdenEfectivo` includes computed fields: `orden_efectivo`, `esta_activa_efectiva`, `has_override`
- Smart sorting: by effective order, then alphabetically
- Always use `DatabaseService.getCategoriasByDelegacion()` to get properly sorted/filtered categories

### Improvement Proposals System
Full feature for submitting ideas and bug reports:
- **Types**: `"idea"` and `"error"` (`lib/types/improvement-proposals.ts`)
- **Status workflows**:
  - Ideas: `nueva_idea` → `en_estudio` → `lo_haremos` → `en_desarrollo` → `hechisimo`
  - Errors: `error_detectado` → `resolviendo` → `resuelto`
- **Features**: Comments, voting/reactions, author tracking, Kanban board view
- **Components**: `components/improvement-proposals/` (7 components including board, cards, dialogs)
- **Service**: `lib/services/improvement-proposals.ts`

### File Uploads
- Files uploaded to Supabase Storage buckets
- Metadata tracked in `movimiento_archivo` table
- Use `file-service.ts` for upload/download operations
- Support for invoices (`es_factura` flag) and multiple attachments per transaction
- UI components: `file-dropzone.tsx`, `file-attachment-dropzone.tsx`, `transaction-files.tsx`

## File Structure & Aliases

The project uses `@/*` import alias mapping to root directory:
```typescript
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
```

Always prefer absolute imports with `@/` over relative imports (`../../`).

### Key Directories
```
app/                        # Next.js App Router pages
  auth/                     # Login, sign-up, callback, error pages
  transacciones/            # Transaction management page
  cuentas/                  # Account management page
  categorias/               # Category management page
  configuracion/            # Configuration/settings page
  diagnostico/              # Diagnostic center page
  propuestas/               # Improvement proposals page
  api/                      # API routes (admin/users, supabase-sanity)
components/                 # Reusable React components
  ui/                       # 31 UI primitives (Radix UI + custom styling)
  auth/                     # Login/sign-up forms, animated background
  dashboard/                # Dashboard widgets (overview, charts, trends, insights)
  transactions/             # Transaction management (24 components: forms, tables, filters, import)
  cuentas/                  # Account management (manager, edit form, delete dialog)
  categories/               # Category management (list, edit form, delete dialog)
  improvement-proposals/    # Proposals system (board, cards, comments, creation)
  configuracion/            # Configuration page component
  diagnostics/              # Diagnostic center component
  debug/                    # Debug call stats viewer
lib/                        # Business logic, utilities, types
  supabase/                 # Supabase clients (client, server, admin, middleware, redirect)
  services/                 # Data service layer (database, server-database, file-service, improvement-proposals)
  types/                    # TypeScript types (database.ts, improvement-proposals.ts)
  utils/                    # Utilities (format, category-colors, export-to-excel, date-input, etc.)
  db/                       # Query execution and telemetry (query.ts, telemetry.ts)
  actions/                  # Server actions (auth.ts)
contexts/                   # React Context providers (auth, delegation, cache, app-providers)
hooks/                      # Custom React hooks (15+ hooks for data, state, and debugging)
public/                     # Static assets (logos, bank-logos/)
styles/                     # Global CSS (Tailwind configured)
scripts/                    # SQL migrations and debug utilities
docs/                       # End-user documentation in Spanish
```

### App Routes
| Route | Purpose |
|-------|---------|
| `/` | Dashboard with financial overview |
| `/transacciones` | Transaction management (protected) |
| `/cuentas` | Account management (protected) |
| `/categorias` | Category management (protected) |
| `/configuracion` | Settings and configuration |
| `/diagnostico` | Diagnostic center |
| `/propuestas` | Improvement proposals |
| `/auth/login` | Login page |
| `/auth/sign-up` | Registration page |
| `/auth/callback` | OAuth callback |
| `/api/admin/users` | Admin user management API |
| `/api/supabase-sanity` | Supabase health check API |

All non-auth routes use `<AppLayout>` for consistent navigation (sidebar + topbar).

## Styling Conventions

- **Tailwind CSS 3** for all styling with class-based dark mode
- Use `cn()` utility from `@/lib/utils` to merge className strings:
  ```typescript
  import { cn } from "@/lib/utils"
  <div className={cn("base-class", condition && "conditional-class")} />
  ```
- Component library: Radix UI primitives + custom styling (shadcn/ui pattern via `components.json`)
- Dark mode support via `next-themes` with system preference detection
- Color system for accounts and categories using Tailwind color names (`lib/utils/category-colors.ts`)
- Icon library: `lucide-react`
- Toast notifications via `sonner`

## Code Style

- **TypeScript strict mode** enabled (target ES6, module ESNext)
- File naming: kebab-case (`transaction-table.tsx`)
- Components: PascalCase exports, functional components
- Variables/functions: camelCase
- 2-space indentation (ESLint configured)
- ESLint 9 flat config (`eslint.config.js`): extends `next/core-web-vitals` and `next/typescript`
  - `@typescript-eslint/no-explicit-any`: off
  - `@typescript-eslint/no-unused-vars`: warn
  - Ignored paths: `.next/`, `node_modules/`, `scripts/`, `*.min.js`
- No test runner configured yet (use React Testing Library + Vitest if adding tests)

## Configuration Notes

- **`next.config.mjs`**: TypeScript build errors are ignored (`ignoreBuildErrors: true`), images are unoptimized
- **`components.json`**: shadcn/ui configuration with RSC enabled
- **Vercel Analytics**: Integrated via `@vercel/analytics`
- **Husky + lint-staged**: Listed in devDependencies but git hooks are not yet installed

## Environment Variables

Required in `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL="http://localhost:3000/auth/callback"
```

Optional:
```bash
NEXT_PUBLIC_SKIP_PROFILE_CREATION=true  # Temporarily skip profile table creation
```

**Security**: Never commit secrets. Only use `NEXT_PUBLIC_` prefix for client-safe variables. If a key is leaked, rotate it from the Supabase dashboard.

## Working with Transactions (Movimientos)

Transactions are the core data type. Key fields:
- `fecha`: Transaction date
- `concepto`: Description/concept
- `importe`: Amount (positive for income, negative for expenses)
- `categoria_id`: Category assignment
- `cuenta_id`: Account reference
- `ignorado`: Whether to exclude from reports
- `concepto_hash`: For duplicate detection during imports

Import flow uses Excel/CSV parsing (`lib/utils/export-to-excel.ts`) with guided column mapping UI (`components/transactions/transaction-import-panel.tsx`).

## Common Workflows

### Adding a New Page
1. Create `app/your-page/page.tsx`
2. Wrap with `<AppLayout>` component for consistent navigation
3. Use delegation context if filtering by delegation
4. Add navigation link in `components/sidebar.tsx`

### Creating a New Database Query
1. Add method to `DatabaseService` (`lib/services/database.ts`) for client-side
2. Or `ServerDatabaseService` (`lib/services/server-database.ts`) for server-side
3. Create a custom hook in `hooks/` that uses the service
4. Handle loading, error, and empty states in UI

### Working with Categories
Always fetch categories using:
```typescript
const categorias = await DatabaseService.getCategoriasByDelegacion(delegacionId, {
  includeGlobal: true,    // Include global categories
  includeInactive: false, // Exclude inactive categories
})
```
This returns `CategoriaConOrdenEfectivo[]` with proper ordering and visibility.

### Adding a Database Migration
1. Create a new SQL file in `scripts/` with the next sequence number (e.g., `036_your_migration.sql`)
2. Update type definitions in `lib/types/database.ts` to match the new schema
3. Add corresponding service methods and hooks if needed

## Documentation

- **User manual**: `docs/README.md` and numbered chapters (`docs/01-acceso.md` through `docs/07-diagnostico.md`)
- **Pending work (single backlog)**: `docs/ANALISIS_MEJORAS.md` — la lista única de desarrollos pendientes (seguridad, rendimiento, bugs, UI, funcionalidades y deuda técnica)
- **Technical docs**: `docs/SUMMARY.md`, `docs/NEXTJS_16_UPGRADE.md`, `docs/OPTIMIZACIONES_REALIZADAS.md` (registro histórico de lo ya optimizado)
- **Agent guidelines**: `AGENTS.md` for contributor coding conventions (in Spanish)
- **README**: `README.md` for setup and quick start (in Spanish)

## Git Workflow

- Conventional commit messages preferred but not enforced: `feat(cuentas): add IBAN validation`
- Keep PRs focused; include screenshots for UI changes
- Reference issues in commits when applicable
