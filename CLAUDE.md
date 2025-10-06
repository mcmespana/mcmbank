# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCM Bank is a Next.js 15 financial dashboard web application for managing income, expense tracking, and account balances for delegations of "Movimiento Consolación para el Mundo". The app uses Supabase for authentication and database, with React 19, TypeScript, and Tailwind CSS.

## Essential Commands

### Development
```bash
pnpm install          # Install dependencies (requires Node >= 20)
pnpm dev              # Start dev server at http://localhost:3000
pnpm build            # Production build
pnpm start            # Serve production build
```

### Code Quality
```bash
pnpm lint             # Run ESLint in check mode
pnpm lint:fix         # Run ESLint with auto-fix
```

### Node Version
The project requires Node.js >= 20. Use `nvm use` to activate the version specified in `.nvmrc`.

## Architecture & Data Model

### Database Schema
The app uses Supabase with a hierarchical structure:
- **organizacion** → **delegacion** → **cuenta** → **movimiento**
- **categoria**: Expense/income categories (can be global or delegation-specific)
- **categoria_orden_delegacion**: Per-delegation category ordering/visibility overrides
- **membresia**: User-delegation role assignments
- **perfil**: User profiles
- **movimiento_archivo**: File attachments for transactions
- **propuesta_mejora**: Improvement proposals with comments and votes

### Supabase Client Patterns
The app uses three different Supabase client patterns:
1. **Client-side** (`lib/supabase/client.ts`): Browser client for client components
2. **Server-side** (`lib/supabase/server.ts`): Server client using cookies for RSC and Server Actions
3. **Admin** (`lib/supabase/admin.ts`): Admin client with service role key (use sparingly)

Always import the appropriate client based on component type (client vs server component).

### Authentication Flow
- **AuthContext** (`contexts/auth-context.tsx`): Client-side auth state management
- **Middleware** (`middleware.ts`): Session refresh on every request via `lib/supabase/middleware.ts`
- Protected routes redirect to `/auth/login` if unauthenticated
- Demo user: `admin@movimientoconsolacion.com` / password `1234`

### Delegation Context
The app uses a **DelegationContext** (`contexts/delegation-context.tsx`) that:
- Manages the currently selected delegation across the entire app
- Auto-selects the first delegation when user logs in
- Provides `selectedDelegation`, `setSelectedDelegation`, `getCurrentDelegation()`
- Used by all data hooks to filter records by delegation

Most hooks accept a `delegacionId` parameter and will use it to filter data. The delegation context ensures consistent filtering across the app.

## Key Architectural Patterns

### Data Fetching Strategy
- **Hooks** (`hooks/`): Custom hooks for data fetching (e.g., `use-movimientos.ts`, `use-cuentas.ts`, `use-categorias.ts`)
- **Services** (`lib/services/`): Abstraction layer over Supabase queries
  - `database.ts`: Client-side database operations
  - `server-database.ts`: Server-side database operations
- Most hooks use React Query patterns (useState + useEffect) with proper cleanup
- Real-time subscriptions via Supabase channels for live updates

### Category System
Categories have a sophisticated override system:
- Global categories (`es_global: true`) are shared across all delegations
- Delegation-specific categories belong to one delegation
- Per-delegation overrides stored in `categoria_orden_delegacion` for custom ordering and visibility
- Type `CategoriaConOrdenEfectivo` includes computed fields: `orden_efectivo`, `esta_activa_efectiva`, `has_override`
- Always use `DatabaseService.getCategoriasByDelegacion()` to get properly sorted/filtered categories

### File Uploads
- Files uploaded to Supabase Storage buckets
- Metadata tracked in `movimiento_archivo` table
- Use `file-service.ts` for upload/download operations
- Support for invoices (`es_factura` flag) and multiple attachments per transaction

## File Structure & Aliases

The project uses `@/*` import alias mapping to root directory:
```typescript
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
```

Always prefer absolute imports with `@/` over relative imports (`../../`).

### Key Directories
- `app/`: Next.js App Router pages and layouts
- `components/`: Reusable React components (UI primitives in `ui/`)
- `lib/`: Business logic, utilities, types
  - `lib/supabase/`: Supabase client configurations
  - `lib/services/`: Data service layer
  - `lib/types/`: TypeScript type definitions
  - `lib/utils/`: Utility functions
- `contexts/`: React Context providers
- `hooks/`: Custom React hooks
- `public/`: Static assets
- `styles/`: Global CSS (Tailwind configured)
- `docs/`: End-user documentation in Spanish

## Styling Conventions

- **Tailwind CSS** for all styling
- Use `cn()` utility from `@/lib/utils` to merge className strings:
  ```typescript
  import { cn } from "@/lib/utils"
  <div className={cn("base-class", condition && "conditional-class")} />
  ```
- Component library: Radix UI primitives + custom styling
- Dark mode support via `next-themes`
- Color system for accounts and categories using Tailwind color names

## Code Style

- **TypeScript strict mode** enabled
- File naming: kebab-case (`transaction-table.tsx`)
- Components: PascalCase exports, functional components
- Variables/functions: camelCase
- 2-space indentation (ESLint configured)
- No tests configured yet (consider React Testing Library + Vitest if adding tests)

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

**Security**: Never commit secrets. Only use `NEXT_PUBLIC_` prefix for client-safe variables.

## Working with Transactions (Movimientos)

Transactions are the core data type. Key fields:
- `fecha`: Transaction date
- `concepto`: Description/concept
- `importe`: Amount (positive for income, negative for expenses)
- `categoria_id`: Category assignment
- `cuenta_id`: Account reference
- `ignorado`: Whether to exclude from reports
- `concepto_hash`: For duplicate detection during imports

Import flow uses Excel/CSV parsing (`lib/utils/export-to-excel.ts`) with guided mapping UI.

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

## Documentation

- **User manual**: `docs/README.md` and numbered chapters (`docs/01-acceso.md`, etc.)
- **Agent guidelines**: `AGENTS.md` for contributor coding conventions
- **README**: `README.md` for setup and quick start

## Git Workflow

- Conventional commit messages preferred but not enforced: `feat(cuentas): add IBAN validation`
- Keep PRs focused; include screenshots for UI changes
- No pre-commit hooks currently configured
- Reference issues in commits when applicable
