# Plan 013: Investigate and fix upload-affordance inconsistency, contacto selector stacking, and duplicated create-new logic

> **Executor instructions**: This plan has more investigation than the
> others — several findings here are LOW-confidence smells, not confirmed
> bugs. Investigate each before changing code; if investigation shows no
> real problem, say so in `plans/README.md` and mark it resolved-as-
> non-issue rather than forcing a change. Run every verification command.
> Update the status row in `plans/README.md` when done.
>
> **Drift check**: `git diff --stat 0bc851b..HEAD -- components/transactions/transaction-files.tsx components/contactos/contacto-selector.tsx components/transactions/transaction-create-panel.tsx components/transactions/transaction-detail.tsx`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt (UX consistency)
- **Planned at**: commit `0bc851b`, 2026-07-16

## Why this matters

Three lower-confidence UX findings that need a quick look before deciding
whether they're worth fixing:

1. The file-upload affordance in `transaction-files.tsx` switches between a
   full `FileAttachmentDropzone` (when zero files exist) and a compact
   `AddFileButton` (once one exists) — visually inconsistent, though this
   may be intentional progressive disclosure rather than a bug.
2. `ContactoSelector`'s popover uses a hardcoded `z-[80]` with no
   documented z-index scale in the app, and it's used inside both
   `transaction-detail.tsx` and `transaction-create-panel.tsx`, both
   themselves rendered inside `Dialog`/`Sheet` overlays — a plausible
   stacking-order bug, unverified.
3. `ContactoSelector`'s `onCreateNew` callback is wired independently in
   two call sites (`transaction-create-panel.tsx`,
   `transaction-detail.tsx`) — possible behavior divergence, unverified.

## Current state

- `components/transactions/transaction-files.tsx` — the conditional
  dropzone/button rendering (search for `FileAttachmentDropzone` and
  `AddFileButton` in this file, both the "FACTURAS" and "OTROS ARCHIVOS"
  sections appear to duplicate this pattern).
- `components/contactos/contacto-selector.tsx` — the `z-[80]` on
  `PopoverContent` (search for `z-[` in this file to find the exact line).
- `components/transactions/transaction-create-panel.tsx` and
  `components/transactions/transaction-detail.tsx` — both render
  `ContactoSelector` with an `onCreateNew` prop; both are themselves
  rendered inside a `Dialog` or `Sheet` (confirm which, and that
  component's own z-index, by reading the relevant parent render tree).

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Typecheck | `npx tsc --noEmit`   | exit 0               |
| Lint      | `pnpm lint`          | exit 0               |
| Dev server (manual) | `pnpm dev`  | starts on :3000      |

## Scope

**In scope**:
- `components/transactions/transaction-files.tsx` (investigate + possibly fix, Step 1)
- `components/contactos/contacto-selector.tsx` (investigate + possibly fix, Step 2)
- `components/transactions/transaction-create-panel.tsx` and
  `components/transactions/transaction-detail.tsx` (investigate + possibly
  extract shared logic, Step 3)

**Out of scope**:
- Any change to `ContactoSelector`'s core selection logic — only the
  z-index and (if divergent) the `onCreateNew` wiring are in scope.
- Redesigning the file-attachment UI beyond making the affordance visually
  stable — no new features here.

## Git workflow

- Branch: `advisor/013-ux-investigate-upload-selector`
- Conventional commits, one per finding investigated/fixed (e.g.
  `fix(ux): keep upload affordance stable regardless of existing files`,
  `fix(ux): resolve contacto selector stacking under nested dialogs`,
  `refactor(contactos): extract shared create-new-contact handler`)
- Do NOT push or open a PR unless explicitly instructed.
- If a finding turns out to be a non-issue, make no code change for it and
  say so explicitly in your final summary and in the relevant row of
  `plans/README.md`.

## Steps

### Step 1: Investigate and (if warranted) fix the upload-affordance switch

Read `components/transactions/transaction-files.tsx` in full. Determine:
does switching from a full dropzone to a compact button once a file exists
read as intentional progressive disclosure (reasonable — "you already have
one file, here's a small add-another control") or as visually jarring
(the control changes shape/position unexpectedly)? Render both states in
the browser (`pnpm dev`, open a transaction with zero files, then one with
one+ files) and make a judgment call.

- If it looks fine: no change, note it as reviewed-and-fine in your summary.
- If it looks jarring: replace both conditional branches with a single,
  always-rendered compact upload affordance (a small button/dropzone
  combo) positioned consistently above the file list regardless of whether
  files already exist.

**Verify**: `npx tsc --noEmit` → exit 0 if changed; visual check either way, described in your summary.

### Step 2: Investigate and (if warranted) fix the z-index stacking

Read `components/contactos/contacto-selector.tsx`'s `z-[80]` usage, and
read how `transaction-detail.tsx` and `transaction-create-panel.tsx` render
their parent `Dialog`/`Sheet` (check the Radix component or shadcn wrapper
they use — `components/ui/dialog.tsx` or `components/ui/sheet.tsx` — for
that component's own default z-index, typically set via Tailwind or a CSS
variable).

Manual check: `pnpm dev`, open a transaction detail view (or the create
panel) that contains a `ContactoSelector`, click it to open the popover,
confirm it renders visibly above the parent dialog/sheet, not hidden
behind it.

- If it renders correctly: no change needed, note as reviewed-and-fine.
- If it's hidden/clipped: fix by either raising `z-[80]` to a value
  confirmed higher than the parent overlay's z-index, or removing the
  hardcoded z-index and relying on Radix's default Portal behavior (which
  typically renders popovers in a top-level portal already positioned
  above other content) — read how other popovers/selects in the app handle
  this (e.g. `components/ui/select.tsx` or `components/ui/popover.tsx`) and
  match that pattern rather than inventing a new one-off value.

**Verify**: `npx tsc --noEmit` → exit 0 if changed; visual confirmation described in your summary.

### Step 3: Investigate whether `onCreateNew` diverges between call sites

Read both `onCreateNew` handler implementations in
`transaction-create-panel.tsx` and `transaction-detail.tsx` in full.
Compare: do they pre-fill the same fields (e.g. does the typed search text
become the new contact's name in both)? Does the created contact get
applied back to the form the same way in both?

- If they're functionally equivalent (just written twice): extract a
  shared hook, e.g. `hooks/use-create-contacto-inline.ts`, and have both
  components use it instead of independent implementations.
- If they're genuinely different by design (e.g. one pre-fills more
  context because it has more available at that point in the flow): leave
  them separate, but add a one-line comment in each noting the intentional
  difference so a future reader doesn't "fix" it into a bug.

**Verify**: `npx tsc --noEmit` → exit 0; if extracted, manually test creating a new contact inline from both the transaction-create panel and the transaction-detail view, confirming both still work correctly.

## Test plan

No test runner configured. Each step's manual browser check is the
verification; record what was found (issue confirmed and fixed vs.
reviewed-and-fine) for all three items in your summary.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] Each of the three findings has an explicit resolution recorded (fixed, or reviewed-and-fine with reasoning) in your summary and in `plans/README.md`
- [ ] If the upload affordance was changed, both zero-file and has-files states look visually stable
- [ ] If the z-index was changed, the popover renders correctly above its parent dialog in both call sites
- [ ] If `onCreateNew` was extracted, inline contact creation still works from both call sites
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any of the three investigations reveals a more significant underlying
  bug than described here (e.g. the z-index issue is actually caused by a
  broader Portal/stacking-context problem affecting multiple components,
  not just this one) — report the broader issue rather than patching only
  the one symptom.

## Maintenance notes

- This plan is intentionally conservative — several of these findings were
  LOW-confidence smells at audit time. It's fine, even expected, for this
  plan's final summary to report "1 of 3 fixed, 2 reviewed and found fine."
