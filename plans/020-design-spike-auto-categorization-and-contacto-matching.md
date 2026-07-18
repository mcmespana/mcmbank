# Plan 020: Design spike — auto-categorization rules engine (`regla`) and contacto↔movimiento matching on sync

> **Executor instructions**: This is a DESIGN/SPIKE plan, not a build plan.
> The deliverable is a written design document plus at most a throwaway
> prototype — no production code changes. Follow the steps, honor STOP
> conditions, and update the status row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat d759ec9..HEAD -- lib/enable-banking/ scripts/040_create_contacto.sql lib/types/database.ts`
> On drift, re-verify the "Current state" facts before designing against them.

## Status

- **Priority**: P3 (highest-value direction bet, but design before build)
- **Effort**: M for the spike (the build it specifies will be L)
- **Risk**: LOW (no production changes in this plan)
- **Depends on**: none (reads only). The build that follows will want plans 015/017/018 landed.
- **Category**: direction
- **Planned at**: commit `d759ec9`, 2026-07-18

## Why this matters

Enable Banking sync is live (nightly cron, `scripts/039_enable_banking_cron.sql`)
and **every synced movement lands uncategorized**: the insert shape built
by `mapTransactionToMovimiento` (`lib/enable-banking/dedup.ts:123-137`)
has no `categoria_id` field at all. As synced volume grows, delegations
face a hand-categorization backlog that erodes the dashboard's value
(`sin_categoria` is literally a tracked metric in `get_financial_summary`).

Two pieces of infrastructure already exist but are unused:

1. A `regla` table exists **in the live database** (RLS enabled, zero
   policies, advisor lint `rls_enabled_no_policy`) with columns including
   `condiciones jsonb`, `prioridad`, `categoria_id`, `activa`. Zero code
   references it (`grep -rn "regla" app components lib hooks` → only
   unrelated Spanish prose matches). The maintainer's own backlog agrees:
   `docs/ANALISIS_MEJORAS.md` item 63 — "Auto-categorización por reglas —
   el esquema de reglas existe parcialmente en BD pero no tiene UI de
   gestión".
2. The just-shipped contactos feature (PR #141) gives `contacto` an
   `iban` and a `categoria_id_predeterminada` (`scripts/040_create_contacto.sql`),
   but the sync path stores the counterparty only as free text
   (`contraparte`) — it never matches `counterparty` IBANs against
   `contacto.iban`, so neither the contact link nor its default category
   is applied on the largest source of new transactions.

This spike produces the design that turns those two dormant pieces into
one auto-categorization pipeline, with the apply/suggest tradeoff decided
explicitly by the maintainer.

## Current state (verified facts to design against)

- `lib/enable-banking/sync.ts` — orchestrates sync; calls
  `mapTransactionToMovimiento` (locate with `grep -n mapTransactionToMovimiento lib/enable-banking/sync.ts`;
  the file gained ~314 lines between 0bc851b and d759ec9 — re-read it) and
  upserts by `external_id`. Re-verify at spike time that no
  categoria/contacto logic has appeared in `lib/enable-banking/`.
- `lib/enable-banking/dedup.ts:37-46` — the counterparty IBAN/BBAN/name is
  already extracted for hashing (`tx.creditor_account?.iban`, etc.) — the
  same fields the matcher needs.
- `movimiento` has `contacto_id` (`lib/types/database.ts:128` area) and
  `categoria_id`; manual creation (`components/transactions/transaction-create-panel.tsx`)
  is the only place a contacto's default category is applied today.
- `regla` (live DB): confirm the exact live columns as spike step 1 —
  documentation dumps may be stale; the table has
  no policies, so any build must add RLS policies (follow the
  membership-scoped pattern established by plan 014).
- Category resolution convention:
  `DatabaseService.getCategoriasByDelegacion(delegacionId, { includeGlobal: true, includeInactive: false })`
  (`lib/services/database.ts`) — rules must only ever assign categories
  visible to that delegation.
- Import path (manual Excel) that should eventually share the pipeline:
  `components/transactions/transaction-import-panel.tsx` (being refactored
  by plan 018 into `lib/utils/import-parsing.ts`).

## Commands you will need

Read-only spike: `pnpm dev` for UI exploration; Supabase MCP tools (or SQL
editor) for live-schema inspection of `regla`. No build/test gates apply.

## Scope

**In scope (deliverables)**:
- `docs/DESIGN_AUTO_CATEGORIZACION.md` — the design document (Spanish, to
  match `docs/` convention).
- Optionally a throwaway matching-accuracy script under `plans/spikes/`
  (never imported by app code).

**Out of scope**:
- ANY production code, migration, or policy change.
- Building the rules CRUD UI.
- ML/LLM-based categorization — evaluate rule-based first; note LLM as
  future work at most.

## Git workflow

- Branch: `advisor/020-autocategorization-design`
- Single commit: `docs: design spike for auto-categorization rules and contacto matching`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Establish ground truth

Dump the live `regla` schema (columns, types, defaults, FKs) and record it
verbatim in the design doc. Inventory real uncategorized data: for 2-3
delegations, `select count(*) from movimiento where categoria_id is null`
split by `origen_sync`. Sample 50 uncategorized `contraparte`/`concepto`
values (anonymize in the doc: patterns, not literal names).

### Step 2: Design the `condiciones` DSL

Specify the jsonb rule format with concrete examples, covering at minimum:
substring/regex match on `concepto`/`contraparte`, IBAN equality, amount
sign/range, and combination semantics (AND within a rule, first-match-wins
by `prioridad`). Define evaluation order relative to contacto-IBAN
matching (recommendation to evaluate: contacto match first — it's exact —
then rules). Specify determinism and conflict rules (equal prioridad →
stable tiebreak).

### Step 3: Decide apply vs. suggest (the core product question)

Write up both modes with their consequences for a financial ledger:
- **Apply-on-sync**: `categoria_id` set during sync; needs an audit trail
  (who/what set it: proposal — a `categoria_origen` enum column:
  `manual | regla | contacto | import`) and a bulk "revisar
  auto-categorizados" view.
- **Suggest-only**: a `categoria_sugerida_id` column (or side table);
  one-click confirm in the transaction table.
Give a recommendation with rationale, but mark it as the maintainer's
decision — the doc must present both fully enough to choose.

### Step 4: Specify the integration points

For the chosen architecture, name exact seams (file + function) for:
sync-time hook in `lib/enable-banking/sync.ts`; manual-import hook (plan
018's `lib/utils/import-parsing.ts` consumer); backfill job over existing
uncategorized rows (batched, delegation-scoped, dry-run mode first);
rules CRUD (where in the UI: propose `/configuracion` section vs. new
route, following the `components/categories/` manager pattern); RLS
policies `regla` needs (membership-scoped, plan 014's pattern). Include a
rough build breakdown (S/M/L per piece) so the follow-up build plans can
be cut from this doc.

### Step 5 (optional but recommended): Matching-accuracy probe

Throwaway script: for one delegation, run the proposed contacto-IBAN match
+ 3-5 hand-written sample rules against existing categorized movements and
report precision (how often the rule's category equals the human's).
Numbers go in the doc; script goes in `plans/spikes/`.

## Test plan

N/A (design spike). The doc's quality gate is the review checklist in
Done criteria.

## Done criteria

- [ ] `docs/DESIGN_AUTO_CATEGORIZACION.md` exists and contains: live `regla` schema, uncategorized-volume numbers, DSL spec with ≥ 4 worked examples, both apply/suggest modes with a recommendation, integration-seam list with file paths, RLS policy sketch, build breakdown
- [ ] Zero production files modified (`git status` shows only `docs/` and optionally `plans/spikes/`)
- [ ] Open questions for the maintainer listed explicitly at the top of the doc
- [ ] `plans/README.md` status row updated

## STOP conditions

- The live `regla` table doesn't exist or its columns differ wildly from
  the documented dump — record what IS there and continue; but if it's
  absent entirely, the doc's schema section becomes a proposal (say so).
- You cannot get read access to live data volumes — write the design with
  the volume section marked "pendiente de datos" rather than inventing
  numbers.

## Maintenance notes

- The follow-up build plans cut from this doc should be numbered 021+ in
  a future planning pass, each with the standard executor format.
- DIR-04 (org-level `gestor_central` dashboard) and DIR-05 (proposal
  status notifications via Resend) were surfaced by the same audit and
  remain unplanned — see the index's deferred list.
