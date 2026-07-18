# Use ContactoTipoBadge (and the shared Global pill presentation) inside ContactoSelector

Written against: 0bc851b

## Evidence chain

- Surface: contact selector trigger and list, rendered inside movimientos forms — `components/contactos/contacto-selector.tsx:88-96` (tipo pill) and `:160-164` (Global pill).
- Problem: The selector reimplements the contact-type badge inline as an uppercase, borderless, emoji-less pill (`rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide`), and renders "Global" as an uppercase pill without the Globe icon. The same semantic elements are presented differently by the governing owner within the same task of identifying a contact.
- Design evidence: Owner `components/contactos/contacto-tipo-badge.tsx` (bordered, emoji, `font-medium`, non-uppercase) is used by both other consumers: `contactos-manager.tsx:305` (`size="sm" short`) and `contacto-detail-sheet.tsx:110` (`size="sm"`). The Global pill in both consumers is `inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground` with `<Globe className="h-2.5 w-2.5" />`, non-uppercase (`contactos-manager.tsx:307-309`, `contacto-detail-sheet.tsx:112-114`).
- Owner: `ContactoTipoBadge` in `components/contactos/contacto-tipo-badge.tsx`.
- Scope and affected surfaces: `ContactoSelector` consumers — `components/transactions/transaction-detail.tsx` and `components/transactions/transaction-create-panel.tsx`.
- Uncertainty: none; the `size="sm" short` variant exists precisely for tight spaces.

## Design decision

The selector must present tipo and Global exactly like the rest of the contactos surface: replace the inline tipo pill in the trigger with `<ContactoTipoBadge tipo={selected.tipo} size="sm" short />`, and replace the inline Global pill in list items with the shared presentation (Globe icon, non-uppercase, `text-[10px] text-muted-foreground bg-muted`).

## Reuse

- `ContactoTipoBadge` (`size="sm" short` variant)
- Exemplar: `components/contactos/contactos-manager.tsx:305-309`

No new primitive.

## Changes

1. `components/contactos/contacto-selector.tsx:88-96`
   - Change: replace the inline `<span className={cn("rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide", …bgClass, …textClass)}>{shortLabel}</span>` with `<ContactoTipoBadge tipo={selected.tipo} size="sm" short className="shrink-0" />`; import the component; the standalone emoji `<span aria-hidden>` before the name may stay (it mirrors the card avatar emoji), the badge brings its own emoji — remove the standalone emoji span to avoid double emoji.
   - Preserve: truncation of the contact name; `text-muted-foreground` placeholder state.
   - Verify: selected contact in movimientos form shows the same badge as its card on `/contactos`.
2. `components/contactos/contacto-selector.tsx:160-164`
   - Change: Global pill → `<span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"><Globe className="h-2.5 w-2.5" /> Global</span>`; import `Globe` from lucide-react; drop `uppercase tracking-wide`.
   - Preserve: pill position after the item text, `ml-2`.
   - Verify: Global marker matches the one on contact cards.

## Scope

- Inherit: both `ContactoSelector` call sites (transaction-detail, transaction-create-panel).
- Verify: trigger height `h-9` still fits the badge (badge sm is `py-0.5 text-[10px]`, fits).
- Exclude: `z-[80]` stacking and `onCreateNew` duplication (owned by `plans/013`).

## Validation

- Product: open a movimiento, pick a contact — badge presentation matches `/contactos` cards.
- Interface: long contact names still truncate; empty/placeholder state unchanged.
- System: no remaining inline tipo-pill styling in the selector — `grep -n "uppercase" components/contactos/contacto-selector.tsx` → no match.
- Repository: `grep -n "ContactoTipoBadge" components/contactos/contacto-selector.tsx` → import + usage present.

## Stop conditions

- Stop if the badge visually overflows the `h-9` trigger; report instead of inventing a new variant.

## Design documentation

- None.
