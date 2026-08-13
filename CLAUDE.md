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
- **aviso**: Notices and tasks per delegation (technical office ↔ treasurers)
- **aviso_lectura**: Read receipts for notices (one row per aviso/user)

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
- Credentials are never stored in this repo. To test a flow that needs a login, ask the user to enter it themselves.

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
ThemeProvider → QueryProvider → AuthProvider → DelegationProvider
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
- **Caching**: TTL-based caching in hooks (e.g., `useCuentas` uses 30s TTL); `useMovimientos` handles its own pagination/abort/dedupe internally
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
| `use-avisos.ts` | Notices/tasks per delegation, unread + pending counters |
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

### Notices & Tasks (Avisos y tareas)
Short notes between the central technical office (`gestor_central`) and each delegation's treasurers:
- **Types**: `"tarea"` (has `estado` pendiente/hecha, plus optional `responsable_id`, `fecha_limite`, `urgente`) and `"nota"` (informational; `hecha` = archived)
- **Recipient** (`destinatario`): `"oficina_tecnica"` or `"delegacion"`
- **Responsable**: who a task is assigned to. Eligible people are the receiving side's members — tesoreros of the delegation if `destinatario` is `"delegacion"`, gestor_central users (global) if it's `"oficina_tecnica"` — same pool as the email recipients. Resolved via `perfil`, which any authenticated user can read (`membresia` is readable by any authenticated user too)
- **Isolation**: every aviso belongs to a delegation; RLS only grants access to `membresia` holders of that delegation, so delegation A never sees B's notes
- **Unread**: `aviso_lectura` holds one row per (aviso, user); the badge counts avisos with no receipt for the current user
- **Email**: `POST /api/avisos/notificar` sends it with Resend (needs `RESEND_API_KEY`) to the treasurers of the delegation or to all central managers, never to the author
- **Panel tabs**: filtered by the aviso's `destinatario`, not by who wrote it — "Para vosotros/nosotros" (directed to the delegation) and "Enviados"/"Pedido a la oficina" (directed to oficina técnica) are the same two buckets, worded differently depending on `miLado`; "Hechas" is the completed/archived history
- **UI**: floating 44px button bottom-right, mounted once in `components/app-layout.tsx` (`components/avisos/`), opens with ⌘/Ctrl+I. On mobile the panel becomes a full-screen overlay (not a route) so closing it returns to the exact same page
- **Types/service/hook**: `lib/types/avisos.ts`, `lib/services/avisos.ts`, `hooks/use-avisos.ts`

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
  ui/                       # 41 UI primitives (Radix UI + custom styling), incl. PageHeader,
                             # FilterTabs, ListRow (+ ListHeaderRow), ActionMenu, FileThumbnail
  auth/                     # Login/sign-up forms, animated background
  dashboard/                # Dashboard widgets (overview, charts, trends, insights)
  transactions/             # Transaction management (24 components: forms, tables, filters, import)
  cuentas/                  # Account management (manager, edit form, delete dialog)
  categories/               # Category management (list, edit form, delete dialog)
  improvement-proposals/    # Proposals system (board, cards, comments, creation)
  avisos/                   # Notices & tasks (floating widget, panel, composer, item)
  configuracion/            # Configuration page component
  diagnostics/              # Diagnostic center component
  debug/                    # Debug call stats viewer
lib/                        # Business logic, utilities, types
  supabase/                 # Supabase clients (client, server, admin, middleware, redirect)
  services/                 # Data service layer (database, server-database, file-service, avisos)
  api/                      # Shared core of the external API + MCP server (see below)
  mcp/                      # MCP protocol layer (protocol, args, tools, server)
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
| `/api/avisos/notificar` | Sends a notice/task by email via Resend |
| `/api/admin/users` | Admin user management API |
| `/api/supabase-sanity` | Supabase health check API |
| `/api/v1/*` | External REST API (see below) |
| `/api/mcp` | MCP server (JSON-RPC over HTTP) |
| `/api/v1/openapi.json`, `/docs/api`, `/llms.txt` | Machine- and human-readable API docs |

All non-auth routes use `<AppLayout>` for consistent navigation (sidebar + topbar).

## External API and MCP server

`/api/v1/*` (REST) and `/api/mcp` (MCP) are two front doors onto the **same**
core in `lib/api/`. Anything doable through one is doable through the other, and
neither route handler contains business logic — they parse input, check the key,
and call the core. Add a capability once, in `lib/api/`, then expose it in both.

Both are aimed at central-office admins who work across **all** delegations, so
they use the **admin (service role) client** and bypass RLS. Everything is
scoped explicitly in the query instead: `resolveAmbitoDelegaciones()` returns
`null` for "all delegations" and a resolved list otherwise.

| Module | Responsibility |
|--------|----------------|
| `lib/api/external-auth.ts` | API-key check with two scopes: `MCM_API_KEY` (read+write), `MCM_API_KEY_READONLY` and `CRON_SECRET` (read only) |
| `lib/api/actor.ts` | Resolves the real user that signs each write (`usuario_email` → `x-mcm-usuario-email` → `MCM_API_USER_EMAIL`). Never picks an arbitrary user |
| `lib/api/delegaciones.ts` | Natural-language delegation lookup ("Sevilla", "MCM-SEV", UUID); ambiguity returns the candidates |
| `lib/api/catalogos.ts` | Cached cuenta/categoria/contacto maps, joined in memory instead of embedded in every query |
| `lib/api/movimientos-public.ts` | Movement search (multi-delegation, with whole-set totals), fetch and update |
| `lib/api/facturas.ts` | Invoice CRUD, linking, and the scoring used to reconcile invoices against movements |
| `lib/api/avisos.ts` | Notices and tasks, including the email notification |
| `lib/api/archivos.ts` | Base64 upload to Storage + registration, signed URLs, deletion |
| `lib/api/resumen.ts` | Per-delegation financial rollup |
| `lib/api/errors.ts` | `ApiError` with HTTP status; unexpected errors are logged in full and truncated to one line in the response |
| `lib/api/route-helpers.ts` | `conApi()` wrapper: auth + query parsing + `{ ok: true, ... }` shape |
| `lib/mcp/tools.ts` | The 27 MCP tools, each a thin wrapper over `lib/api/` |
| `lib/mcp/auth.ts` | Accepts either an API key or an OAuth access token; OAuth pins the acting user |
| `lib/oauth/` | OAuth 2.1 authorization server: config, PKCE, DB-backed store, authorize-request validation |

### OAuth for claude.ai connectors

claude.ai custom connectors cannot send a static header, so `/api/mcp` is also
an OAuth 2.1 authorization server (`scripts/058_mcp_oauth.sql` adds the three
tables). The payoff is bigger than the web: each admin signs in as themselves,
so writes are attributed to the real person and `MCM_API_USER_EMAIL` becomes
unnecessary.

The discovery chain is what makes a connector self-configure: `/api/mcp` answers
401 with `WWW-Authenticate: ... resource_metadata=...` →
`/.well-known/oauth-protected-resource` → `/.well-known/oauth-authorization-server`
→ dynamic registration → consent → token. Those `.well-known` paths are
**rewrites** in `next.config.mjs`: Next's router ignores dot-prefixed folders,
so the handlers live under `app/api/well-known/`.

Rules this code keeps, and that a change must not break:

- **PKCE S256 only, no client secrets.** Clients are public apps; PKCE is the
  only thing binding a code to whoever requested it.
- **Exact `redirect_uri` match.** On a client/redirect failure the page renders
  an error instead of redirecting — redirecting to an unvalidated destination is
  the classic OAuth hole. `lib/oauth/autorizacion.ts` encodes that as
  fatal-vs-redirigible, and both the page and the POST run the same validator.
- **Only `gestor_central` may consent** — the MCP server bypasses RLS across all
  delegations.
- **Codes are single-use; refresh tokens rotate.** Reuse of either revokes every
  token for that client+user.
- **Only SHA-256 of codes/tokens is stored.** The three tables have RLS on with
  no policies: service role only.
- With an OAuth token, `actorForzado` pins the user and tool arguments cannot
  override authorship. With an API key, `usuario_email` still applies.

Conventions worth keeping:

- **Never write through the aggregation RPCs** (`get_financial_summary`,
  `get_saldos_por_cuenta`…): they call `assert_delegacion_member`, which checks
  `auth.uid()` and therefore always fails for the service role. Aggregate in JS
  (paged, ordered by `id` so pages don't overlap) as `lib/api/resumen.ts` does.
- **Client-only modules stay out**: `lib/services/database.ts` and
  `file-service.ts` are `"use client"`. Server equivalents live in `lib/api/`.
- **Paged aggregation must order by a unique column.** Ordering by `fecha`
  makes rows repeat or vanish across pages and the totals come out wrong.
- **Error messages are read by models too.** Say what is missing and put the
  valid values or the candidates in `detalles` so the caller can self-correct.
- API-uploaded files cap at 3 MB (Vercel's ~4.5 MB request body, +33% for
  base64); the app's own limit is still 20 MB.

Docs: `docs/manual/21.-api-externa-solo-pros.md`,
`docs/manual/22.-servidor-mcp.md`, `docs/API_PRUEBA_RAPIDA.md`.

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
- No hidden or truncated navigation labels on mobile (no `hidden sm:inline`, no `.slice(0, 3)` tab
  abbreviations): use `FilterTabs` (`components/ui/filter-tabs.tsx`), which scrolls horizontally
  instead of truncating

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

- **User manual**: `docs/README.md` and numbered chapters (`docs/01-acceso.md` through `docs/14-avisos-tareas.md`, see `docs/SUMMARY.md` for the full index)
- **Pending work (single backlog)**: `docs/ANALISIS_MEJORAS.md` — la lista única de desarrollos pendientes (seguridad, rendimiento, bugs, UI, funcionalidades y deuda técnica)
- **Technical docs**: `docs/SUMMARY.md`, `docs/NEXTJS_16_UPGRADE.md`, `docs/OPTIMIZACIONES_REALIZADAS.md` (registro histórico de lo ya optimizado)
- **Agent guidelines**: `AGENTS.md` for contributor coding conventions (in Spanish)
- **README**: `README.md` for setup and quick start (in Spanish)

## Git Workflow

- Conventional commit messages preferred but not enforced: `feat(cuentas): add IBAN validation`
- Keep PRs focused; include screenshots for UI changes
- Reference issues in commits when applicable
