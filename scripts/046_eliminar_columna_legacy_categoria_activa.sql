-- 046_eliminar_columna_legacy_categoria_activa.sql
--
-- La tabla "categoria" tenía DOS columnas de estado:
--   - "activa"      -> legacy, default true, sin uso en la aplicación.
--   - "esta_activa" -> la columna real que usa la app.
-- Esta duplicidad era ambigua y propensa a errores. Se elimina "activa".
--
-- Nota: la tabla "cuenta" tiene su propia columna "activa" (distinta) que SÍ se
-- usa y NO debe tocarse.

alter table public.categoria drop column if exists activa;
