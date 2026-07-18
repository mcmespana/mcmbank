# Plan 012: UX — consistent confirmation dialogs and visible error feedback on file actions

> **Executor instructions**: Follow this plan step by step, run every
> verification command, and stop per STOP conditions rather than
> improvising. Update `plans/README.md`'s status row when done.
>
> **Drift check**: `git diff --stat 0bc851b..HEAD -- components/cuentas/cuentas-manager.tsx components/transactions/file-list.tsx components/transactions/transaction-files.tsx`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt (UX consistency)
- **Planned at**: commit `0bc851b`, 2026-07-16

## Why this matters

Three small, related UX inconsistencies found in the same audit pass:

1. Disconnecting a bank account uses the browser's native `window.confirm()`
   (`components/cuentas/cuentas-manager.tsx`) while every other destructive
   action in the app (account deletion, file deletion, contact deletion)
   uses a styled `Dialog` component — jarring, unstyled, and can be
   silently auto-dismissed by browser "prevent dialogs" settings.
2. When deleting a file fails, the error is only logged to the console —
   the confirmation dialog just stops spinning with no visible explanation,
   and the actual error message renders in a separate top-level banner the
   user may not see behind the still-open modal.
3. File upload and description-edit failures are also only logged to the
   console, with no toast or inline feedback — a failed upload looks
   identical to a slow one until the user gives up waiting.

## Current state

- `components/cuentas/cuentas-manager.tsx` — find the `confirm(...)` call
  guarding the bank-disconnect action (`grep -n "confirm(" components/cuentas/cuentas-manager.tsx`).
- `components/cuentas/delete-account-dialog.tsx` — the existing styled
  `Dialog` pattern to mirror (confirm/cancel buttons, loading state while
  the delete request is in flight).
- `components/transactions/file-list.tsx` — the delete-file flow's catch
  block (only `console.error`, dialog doesn't surface the error) and the
  save-edit flow's catch block (same pattern).
- `components/transactions/transaction-files.tsx` — the upload flow's catch
  block (`handleFileUpload`, only `console.error`).
- `sonner`'s `toast` — already used elsewhere in the app, e.g.
  `components/contactos/contacto-form.tsx` (`grep -n "toast" components/contactos/contacto-form.tsx`
  for the exact import and call pattern to mirror).

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|----------------------|----------------------|
| Typecheck | `npx tsc --noEmit`   | exit 0               |
| Lint      | `pnpm lint`          | exit 0               |
| Dev server (manual) | `pnpm dev`  | starts on :3000      |

## Scope

**In scope**:
- `components/cuentas/cuentas-manager.tsx` — replace `confirm()` with a
  styled dialog for bank disconnect.
- New component (if needed): `components/cuentas/cuenta-disconnect-dialog.tsx`
  (mirroring `delete-account-dialog.tsx`'s structure), or inline the dialog
  in `cuentas-manager.tsx` if that's more consistent with how other
  in-file dialogs there are structured — check the file first.
- `components/transactions/file-list.tsx` — surface delete/edit errors
  inside the relevant dialog/inline location instead of only console.
- `components/transactions/transaction-files.tsx` — add `toast.error`/
  `toast.success` on upload failure/success.

**Out of scope**:
- Any change to the actual delete/upload logic in
  `hooks/use-movimiento-archivos.ts` or `lib/services/file-service.ts` —
  this plan is UI-feedback only.
- The signed-URL fix from plan 002 — unrelated concern, don't conflate.

## Git workflow

- Branch: `advisor/012-ux-confirmations-error-feedback`
- Conventional commits (e.g. `fix(ux): use styled dialog for bank disconnect confirmation`, `fix(ux): surface file upload/delete errors to the user`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Replace `window.confirm` with a styled dialog for bank disconnect

Read `components/cuentas/delete-account-dialog.tsx` in full as the
structural template (props shape, `Dialog`/`AlertDialog` usage, loading
state on the confirm button, cancel behavior). Read
`components/cuentas/cuenta-sync-dialog.tsx` too, since it's the closest
existing dialog specifically for bank-connection actions and may share
useful patterns (e.g. how it displays the account name/bank name).

Create the disconnect confirmation as either a new
`cuenta-disconnect-dialog.tsx` component or an inline dialog within
`cuentas-manager.tsx`, matching whichever pattern the file's other actions
(delete) already use for consistency. Replace the `confirm(...)` call site
with opening this dialog; wire its confirm action to the existing
disconnect logic (don't change the disconnect API call itself, just how
it's triggered).

**Verify**: `npx tsc --noEmit` → exit 0; `pnpm lint` → exit 0. Manual: `pnpm dev`, go to `/cuentas`, trigger disconnect on a connected account (or a test one), confirm the new styled dialog appears instead of a browser confirm popup, and both confirm/cancel work correctly.

### Step 2: Surface file-delete errors inside the delete dialog

In `components/transactions/file-list.tsx`, find the delete handler's catch
block. Instead of only `console.error(...)`, capture the error into local
component state and render it inside the still-open confirmation dialog
(e.g. an `Alert`/`AlertDescription` below the confirm/cancel buttons), and
do NOT close the dialog automatically on failure — let the user see the
error and retry or cancel explicitly.

**Verify**: `npx tsc --noEmit` → exit 0. Manual verification of an actual failure is hard to force without a real permission/network error — note in your summary that this was verified by code review (the error state is correctly captured and rendered) rather than by triggering a live failure, unless you find an easy way to simulate one (e.g. temporarily throwing in the hook during local testing, then reverting).

### Step 3: Add toast feedback on upload/edit success and failure

In `components/transactions/transaction-files.tsx`'s `handleFileUpload`
catch block, and `components/transactions/file-list.tsx`'s `handleSaveEdit`
catch block, import `toast` from `sonner` (match the import path used in
`components/contactos/contacto-form.tsx`) and add:
- `toast.error(<message>)` in each catch block, using the caught error's
  message if it's a meaningful user-facing string, otherwise a generic
  fallback like `"No se pudo subir el archivo. Inténtalo de nuevo."`.
- `toast.success("Archivo subido correctamente")` after a successful upload
  in `handleFileUpload`.

Keep the existing `console.error` calls too (useful for debugging), just
add the toast alongside them, don't replace logging entirely.

**Verify**: `npx tsc --noEmit` → exit 0; `pnpm lint` → exit 0. Manual: `pnpm dev`, upload a valid file to a transaction, confirm a success toast appears; attempt uploading a file type outside the allowed MIME list (per `lib/services/file-service.ts`'s `ALLOWED_MIME_TYPES`) and confirm an error toast appears instead of silent failure.

## Test plan

No test runner configured. The manual checks in each step are the
verification.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] Bank disconnect uses a styled dialog, not `window.confirm`
- [ ] File-delete failure is visibly surfaced inside the dialog (verified by code review at minimum)
- [ ] File upload shows a success toast on success and an error toast on failure (manually verified with a valid and an invalid file)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- No existing `Dialog`/`AlertDialog` pattern can be found to mirror for
  Step 1 — don't invent a new dialog styling approach; report and ask
  instead of introducing a fourth confirmation pattern into the app.
- `sonner`'s `toast` isn't actually configured/mounted in this app despite
  being a dependency (check `contexts/app-providers.tsx` for a `<Toaster />`
  per `CLAUDE.md`'s provider hierarchy) — if it's missing, that's a
  bigger gap than this plan's scope; report rather than adding toast calls
  that silently do nothing.

## Maintenance notes

- If plan 002 (signed URLs) lands around the same time, the error-handling
  code in `file-list.tsx`/`transaction-files.tsx` touched by both plans may
  overlap slightly — whichever executor runs second should re-read the
  file fresh rather than assuming the other plan's changes aren't there
  (the drift check at the top of each plan handles this).
