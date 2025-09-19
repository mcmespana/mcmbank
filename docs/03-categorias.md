# 3. Categorías

Las categorías nos ayudan a clasificar los movimientos y comparar entre Delegaciones Locales.

- Las categorías principales están definidas a nivel nacional para que todos usemos las mismas.
- Cada MCM Local puede crear las subcategorías que necesite. Por ejemplo, dentro de **"Actividades Curso 25-26"** cada delegación añadirá sus propias actividades.
- 📸 *Captura de la lista de categorías*

## Crear o editar

1. Desde el menú lateral entra en **Categorías**.
2. Pulsa **Crear categoría** o el icono ✏️ para editar.
3. Elige un nombre, un emoji y un color. Usa las flechas para ordenar y arrastra solo si quieres crear una subcategoría.

> 🗑️ Si borras una categoría, los movimientos asociados quedarán sin categorizar.

## SQL: campo `activa`

Para habilitar el botón de ocultar categorías necesitas añadir un campo booleano en la tabla `categoria`:

```sql
alter table public.categoria
add column if not exists activa boolean not null default true;

update public.categoria
set activa = coalesce(activa, true);
```
