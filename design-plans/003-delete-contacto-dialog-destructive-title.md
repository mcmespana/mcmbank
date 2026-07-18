# Align DeleteContactoDialog title with the destructive delete-dialog pattern

Written against: 0bc851b

## Evidence chain

- Surface: delete-confirmation dialog on `/contactos` — `components/contactos/delete-contacto-dialog.tsx:62-65`
- Problem: The delete dialog's title renders in default foreground with an **amber** AlertTriangle (`text-amber-500`), while the app's other delete dialogs for the same destructive task render the title and icon in red.
- Design evidence: `components/categories/delete-category-dialog.tsx:32` and `components/cuentas/delete-account-dialog.tsx:41` both use `<DialogTitle className="flex items-center gap-2 text-red-600">` with a red AlertTriangle for the identical task (irreversible entity deletion). Amber is used elsewhere in the contactos surface to mean "archived", not "destructive" (`contactos-manager.tsx:312`, archive hint alert `delete-contacto-dialog.tsx:78`), so the amber title icon contradicts the surface's own color semantics.
- Owner: inline `DialogTitle` styling; pattern exemplars above.
- Scope and affected surfaces: only `DeleteContactoDialog`.
- Uncertainty: none.

## Design decision

The delete-contacto title adopts the sibling destructive pattern: title text and AlertTriangle in `text-red-600`. The amber "archívalo mejor" hint alert stays amber — it correctly reuses the archive semantics.

## Reuse

- Exemplar: `components/cuentas/delete-account-dialog.tsx:41`

No new primitive.

## Changes

1. `components/contactos/delete-contacto-dialog.tsx:62-65`
   - Change: `<DialogTitle className="flex items-center gap-2">` → `<DialogTitle className="flex items-center gap-2 text-red-600">`; `<AlertTriangle className="h-5 w-5 text-amber-500" />` → `<AlertTriangle className="h-5 w-5" />` (inherits red from the title).
   - Preserve: dialog copy, archive-hint alert (amber), footer buttons and busy handling.
   - Verify: title reads red like the categories/cuentas delete dialogs.

## Scope

- Inherit: `/contactos` (card delete button and detail-sheet delete both open this dialog).
- Verify: dark mode — siblings use plain `text-red-600` too, so parity holds.
- Exclude: toast/feedback consistency (owned by `plans/012`); harmonizing all three dialogs onto a shared component.

## Validation

- Product: click delete on a contact card — dialog title appears in red with red icon.
- Interface: light and dark themes.
- System: `grep -n "text-amber-500" components/contactos/delete-contacto-dialog.tsx` → no match.
- Repository: `grep -n "text-red-600" components/contactos/delete-contacto-dialog.tsx` → one match on the DialogTitle.

## Stop conditions

- Stop if plan 012's executor has already restyled these dialogs to a shared token (`text-destructive`); follow that newer convention instead.

## Design documentation

- None.
