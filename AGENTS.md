# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router routes (`layout.tsx`, `page.tsx`, feature folders like `auth/`, `cuentas/`, `transacciones/`).
- `components/`: Reusable UI and feature components (e.g., `ui/`, `dashboard/`).
- `lib/`: App logic (`services/`, `utils/`, `supabase/`, `types/`). Use `@/` alias (e.g., `@/lib/utils`).
- `hooks/`, `contexts/`: React hooks and context providers.
- `public/`: Static assets (logos, placeholders).
- `scripts/`: Utilities and SQL files for data/setup.
- `styles/`: Global styles; Tailwind configured in `tailwind.config.ts`.

## Build, Test, and Development Commands
- Install: `pnpm install` (or `npm install`). Node `>=20` (repo uses `.nvmrc` → `nvm use`).
- Dev: `pnpm dev` → runs at `http://localhost:3000`.
- Build: `pnpm build` → Next.js production build.
- Start: `pnpm start` → serve the built app.
- Lint: `pnpm lint` → Next.js/ESLint checks.

## Coding Style & Naming Conventions
- Language: TypeScript (strict). React function components.
- Files: kebab-case for filenames (`amount-display.tsx`); PascalCase for component exports; camelCase for vars/functions.
- Styling: Tailwind CSS. Prefer `cn(...)` from `@/lib/utils` to merge classes.
- Imports: use `@/` alias for internal modules; absolute over relative when possible.
- Formatting/Linting: Next.js ESLint defaults; keep consistent 2‑space indentation.

## Testing Guidelines
- No test runner is configured yet. When adding tests, prefer React Testing Library + Vitest.
- Location: co-locate as `*.test.tsx` next to source or under `components/__tests__/`.
- Coverage: target critical paths (auth, transactions, services in `lib/`).
- Run: add `"test": "vitest"` and use `pnpm test` once configured.

## Commit & Pull Request Guidelines
- History is informal (short Spanish/English messages). Prefer imperative, concise subjects (≤72 chars) and descriptive bodies.
- Reference issues (e.g., `Fix delegación filter (#123)`). Optional Conventional Commits: `feat(cuentas): resumen`.
- PRs: include scope/goal, linked issues, screenshots for UI changes, and test/QA steps. Keep diffs focused; avoid unrelated formatting.

## Security & Configuration
- Env: define in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`). Do not commit secrets.
- Client vs server: only expose keys with `NEXT_PUBLIC_`. Rotate leaked keys via Supabase.
