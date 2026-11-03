-- 076 · factura_email: estado 'reenviado'
--
-- Los correos a `facturas+aj@` (y a cualquier etiqueta de FACTURAS_REENVIO) no
-- crean facturas en MCM Bank: se reenvían a otro buzón (Holded) y aquí solo
-- queda la fila de `factura_email`. Hace falta que el CHECK admita el estado.
-- Ver docs/FACTURAS_EMAIL_IA.md.

ALTER TABLE public.factura_email DROP CONSTRAINT IF EXISTS factura_email_estado_check;
ALTER TABLE public.factura_email
    ADD CONSTRAINT factura_email_estado_check
    CHECK (estado IN ('procesado', 'reenviado', 'sin_delegacion', 'sin_adjuntos', 'error', 'ignorado'));

-- Rollback (solo si no hay filas 'reenviado'):
-- ALTER TABLE public.factura_email DROP CONSTRAINT IF EXISTS factura_email_estado_check;
-- ALTER TABLE public.factura_email
--     ADD CONSTRAINT factura_email_estado_check
--     CHECK (estado IN ('procesado', 'sin_delegacion', 'sin_adjuntos', 'error', 'ignorado'));
