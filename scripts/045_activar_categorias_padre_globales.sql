-- 045_activar_categorias_padre_globales.sql
--
-- Contexto / bug:
--   Varias categorías GLOBALES de primer nivel quedaron con esta_activa = false
--   mientras sus subcategorías seguían activas. Como el árbol de categorías solo
--   renderiza hijos bajo un padre visible, en toda delegación SIN un override
--   propio (categoria_orden_delegacion con esta_activa = true) el padre se ocultaba
--   y, con él, TODAS sus subcategorías activas (quedaban huérfanas e invisibles).
--
--   Caso reportado: delegación "MCM Burriana" no veía "Actividades 25-26" (ni sus
--   21 subcategorías activas) porque la categoría global está inactiva y Burriana
--   no tenía override. Otras delegaciones la veían solo gracias a un override.
--
-- Padres globales inactivos con hijos activos detectados:
--   - Actividades 25-26   (21 hijos activos)
--   - Compras Material    (3 hijos activos)
--   - Cuotas              (3 hijos activos)
--
-- Este script los reactiva a nivel global. Tras esto se ven en todas las
-- delegaciones que no las tengan explícitamente ocultas mediante un override
-- (categoria_orden_delegacion con esta_activa = false).
--
-- Nota: la tabla "categoria" tiene una columna legacy "activa" (siempre true, sin
-- uso en el código actual); la columna real usada por la app es "esta_activa".

update public.categoria c
set esta_activa = true
where c.es_global = true
  and c.categoria_padre_id is null
  and c.esta_activa = false
  and exists (
    select 1
    from public.categoria h
    where h.categoria_padre_id = c.id
      and h.esta_activa = true
  );

-- Verificación: no deberían quedar padres globales inactivos con hijos activos.
-- select p.nombre, p.esta_activa,
--        count(*) filter (where h.esta_activa) as hijos_activos
-- from public.categoria p
-- join public.categoria h on h.categoria_padre_id = p.id
-- where p.es_global = true and p.esta_activa = false
-- group by p.nombre, p.esta_activa;
