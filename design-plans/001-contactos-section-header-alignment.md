# Align the Contactos section header with the shared section-header composition

Written against: 0bc851b

## Evidence chain

- Surface: `/contactos` header — `components/contactos/contactos-manager.tsx:105-115`
- Problem: The header deviates from the composition every other section uses: bar-to-title gap `gap-3` (siblings: `gap-4`), title `text-3xl sm:text-4xl` (siblings: `text-4xl`), subtitle `text-sm ml-5` (siblings: `text-base ml-6 pl-4`).
- Design evidence: Two agreeing exemplars of the same repeated composition: `app/cuentas/page.tsx:8-16` and `components/categories/category-list.tsx:1313-1322` (also `app/transacciones/page.tsx:10-15` for bar+title). All use `gap-4`, `text-4xl font-extrabold`, subtitle `text-muted-foreground text-base ml-6 pl-4`.
- Owner: inline composition in `components/contactos/contactos-manager.tsx` (no shared header component exists).
- Scope and affected surfaces: only the Contactos header.
- Uncertainty: none for the values; the exemplars fully determine the target.

## Design decision

Make the Contactos header identical in scale and alignment to the Cuentas/Categorías exemplar so all top-level sections present the same hierarchy: `gap-4` between accent bar and title, `text-4xl font-extrabold` title (drop `text-3xl sm:`), subtitle `text-base ml-6 pl-4` (drop `text-sm` and `ml-5`; keep `max-w-2xl` and `text-muted-foreground`).

## Reuse

- Exemplar: `app/cuentas/page.tsx:8-16`

No new primitive: extracting a shared `SectionHeader` is out of scope for this plan (would touch 4+ surfaces); this plan only corrects the deviant instance.

## Changes

1. `components/contactos/contactos-manager.tsx:107-115`
   - Change: bar row `gap-3` → `gap-4`; h1 classes `text-3xl font-extrabold sm:text-4xl` → `text-4xl font-extrabold`; subtitle `ml-5 max-w-2xl pl-4 text-sm text-muted-foreground` → `ml-6 max-w-2xl pl-4 text-base text-muted-foreground`.
   - Preserve: gradient classes on the h1 exactly as siblings have them; the subtitle copy; the surrounding flex layout and action buttons.
   - Verify: header of `/contactos` visually matches `/cuentas` in title size and subtitle indentation.

## Scope

- Inherit: `/contactos` only.
- Verify: none (inline classes).
- Exclude: extracting a shared header component; changing sibling pages.

## Validation

- Product: open `/contactos`; title and subtitle align like `/cuentas`.
- Interface: check mobile width — title wraps acceptably at `text-4xl` (same behavior siblings accept).
- System: no new pattern introduced.
- Repository: `grep -n "text-3xl" components/contactos/contactos-manager.tsx` → no match.

## Stop conditions

- Stop if siblings have diverged from the cited classes since 0bc851b (re-derive the exemplar first).

## Design documentation

- None.
