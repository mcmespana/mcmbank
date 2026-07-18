# Alinear el diálogo "¿Eliminar archivo?" con el patrón de título destructivo

Written against: 0bc851b (working tree includes design-plans 001–003 already executed)

> **Instrucciones para el ejecutor:** plan autocontenido; haz exactamente
> estos pasos y nada más. Si un grep de verificación falla, PARA y repórtalo
> en `design-plans/README.md`.

## Evidence chain

- Surface: diálogo de confirmación al borrar un archivo adjunto de un movimiento — `components/transactions/file-list.tsx:258-266`.
- Problem: Su título es texto plano sin icono, mientras que los otros diálogos de borrado irreversible de la app titulan en rojo con `AlertTriangle`: `components/categories/delete-category-dialog.tsx:32-35`, `components/cuentas/delete-account-dialog.tsx:41-44` y `components/contactos/delete-contacto-dialog.tsx:62-65` (los tres: `<DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" /> …`). Misma tarea (confirmar un borrado permanente), presentación contradictoria.
- Design evidence: los tres ejemplares concordantes citados.
- Owner: composición inline del `DialogTitle`; patrón ejemplar arriba.
- Scope and affected surfaces: solo `file-list.tsx`.
- Uncertainty: none.

## Design decision

El título del diálogo de borrar archivo adopta el patrón destructivo: rojo + AlertTriangle, sin cambiar copy ni botones.

## Reuse

- Exemplar: `components/cuentas/delete-account-dialog.tsx:41-44`
- Icono: `AlertTriangle` de `lucide-react`

## Changes (paso a paso)

1. `components/transactions/file-list.tsx` (~línea 261)
   - Busca EXACTAMENTE: `<DialogTitle>¿Eliminar archivo?</DialogTitle>`
   - Sustitúyelo por:
     ```tsx
     <DialogTitle className="flex items-center gap-2 text-red-600">
       <AlertTriangle className="h-5 w-5" />
       ¿Eliminar archivo?
     </DialogTitle>
     ```
   - Comprueba el import de lucide-react del fichero: si `AlertTriangle` no está entre los iconos importados, añádelo al import existente de `lucide-react`.

- Preserve: `DialogDescription`, botones (`Cancelar` outline, `Eliminar` destructive) y toda la lógica.
- Verify: ver Validation.

## Scope

- Inherit: diálogo de borrado de archivo en el detalle de movimiento.
- Verify: nada más.
- Exclude: los catch/toasts de errores de archivos (eso es del plan `plans/012`, no lo toques aquí).

## Validation

- Product: borrar un adjunto desde el detalle de un movimiento muestra el título en rojo con triángulo, igual que borrar una cuenta o categoría.
- Interface: modo claro y oscuro.
- System: `grep -n "text-red-600" components/transactions/file-list.tsx` → una coincidencia en el DialogTitle.
- Repository: `npx tsc --noEmit` → sin errores nuevos.

## Stop conditions

- Para si el ejecutor del plan `plans/012` ya ha migrado estos diálogos a un componente compartido o al token `text-destructive`; en ese caso sigue la convención nueva y anótalo en el README.

## Design documentation

- None.
