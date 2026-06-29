-- 046_eliminar_columna_legacy_categoria_activa.sql
--
-- ⚠️ EJECUTAR DESPUÉS DE DESPLEGAR esta rama.
--
-- La tabla "categoria" tenía DOS columnas de estado:
--   - "activa"      -> legacy, default true, sin uso en la aplicación.
--   - "esta_activa" -> la columna real que usa la app.
-- Esta duplicidad era ambigua y propensa a errores. Se elimina "activa".
--
-- IMPORTANTE: el código anterior a esta rama todavía enviaba "activa" al crear
-- categorías. Por eso la columna se restaura temporalmente (default true) y este
-- DROP debe ejecutarse solo cuando el nuevo código (que ya no usa "activa") esté
-- desplegado, para no romper la creación de categorías durante la transición.
--
-- Nota: la tabla "cuenta" tiene su propia columna "activa" (distinta) que SÍ se
-- usa y NO debe tocarse.

alter table public.categoria drop column if exists activa;
