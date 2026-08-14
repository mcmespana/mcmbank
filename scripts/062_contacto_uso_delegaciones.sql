-- 062_contacto_uso_delegaciones.sql
--
-- "Mercadona · lo usan 4 delegaciones": el dato que convence a alguien de
-- adoptar el proveedor que ya existe en vez de crearse el suyo.
--
-- Hace falta una vista porque las políticas de `contacto_delegacion` solo dejan
-- ver las filas de tus propias delegaciones —y con razón, porque ahí van el
-- alias y las notas de cada una—, así que contando desde la tabla el resultado
-- sería siempre 0 o 1.
--
-- La vista se ejecuta con los permisos de su propietario (`security_invoker =
-- off`) y expone EXCLUSIVAMENTE un recuento por contacto: ni qué delegación es,
-- ni sus notas, ni su alias. Es el mínimo que responde a la pregunta.

create or replace view public.contacto_uso_delegaciones as
  select contacto_id,
         count(distinct delegacion_id)::int as delegaciones
    from public.contacto_delegacion
   group by contacto_id;

alter view public.contacto_uso_delegaciones set (security_invoker = off);

comment on view public.contacto_uso_delegaciones is
  'Cuántas delegaciones usan cada contacto. Deliberadamente ejecuta como su propietario para saltar la RLS de contacto_delegacion: solo devuelve un recuento, nunca qué delegación ni sus datos.';

revoke all on public.contacto_uso_delegaciones from anon;
grant select on public.contacto_uso_delegaciones to authenticated;
