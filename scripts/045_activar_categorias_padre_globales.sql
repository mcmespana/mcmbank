-- 045_activar_categorias_globales.sql
--
-- Modelo de categorías: ALCANCE GLOBAL, sin overrides de visibilidad por
-- delegación. Las categorías globales están activas para todas las delegaciones;
-- si una global ya no se quiere, se elimina (el archivado de actividades será una
-- funcionalidad aparte en el futuro).
--
-- Bug corregido:
--   Varias categorías globales habían quedado con esta_activa = false. Como el
--   árbol solo renderiza hijos bajo un padre visible, esos padres (y sus
--   subcategorías activas) desaparecían en toda delegación sin un override propio.
--   Caso reportado: "Actividades 25-26" (con 21 subcategorías activas) no se veía
--   en MCM Burriana.
--
-- Reactiva TODAS las categorías globales que quedaron inactivas.

update public.categoria
set esta_activa = true
where es_global = true and esta_activa = false;

-- Verificación: debe devolver 0.
-- select count(*) from public.categoria where es_global = true and esta_activa = false;
