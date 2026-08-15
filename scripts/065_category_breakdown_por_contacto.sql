-- 065_category_breakdown_por_contacto.sql
--
-- El desglose por categorías del dashboard admite ahora filtrar por contacto,
-- para que el filtro de contacto de Análisis filtre de verdad y no solo se
-- pinte. `p_contacto_id` a null se comporta exactamente como antes.
--
-- Se hace DROP + CREATE en vez de CREATE OR REPLACE porque cambia la lista de
-- argumentos: con REPLACE quedarían dos funciones (una de 3 y otra de 4
-- parámetros) y una llamada de 3 argumentos podría resolver a la que no toca.

drop function if exists public.get_category_breakdown(uuid, date, date);

create function public.get_category_breakdown(
  p_delegacion_id uuid,
  p_desde         date,
  p_hasta         date,
  p_contacto_id   uuid default null
)
returns table (
  categoria_id     uuid,
  categoria_nombre text,
  categoria_emoji  text,
  categoria_color  text,
  ingresos         numeric,
  gastos           numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  perform assert_delegacion_member(p_delegacion_id);

  return query
  select * from (
    select
      m.categoria_id,
      c.nombre                                                                 as c_nombre,
      c.emoji                                                                  as c_emoji,
      c.color                                                                  as c_color,
      coalesce(sum(case when m.importe > 0 then m.importe else 0 end), 0)      as s_ingresos,
      coalesce(sum(case when m.importe < 0 then abs(m.importe) else 0 end), 0) as s_gastos
    from movimiento m
    join cuenta cu on cu.id = m.cuenta_id
    left join categoria c on c.id = m.categoria_id
    where m.delegacion_id = p_delegacion_id
      and m.ignorado = false
      and cu.activa = true
      and m.fecha between p_desde and p_hasta
      and (p_contacto_id is null or m.contacto_id = p_contacto_id)
    group by m.categoria_id, c.nombre, c.emoji, c.color
  ) sub
  order by (sub.s_ingresos + sub.s_gastos) desc;
end;
$function$;

comment on function public.get_category_breakdown is
  'Desglose de ingresos y gastos por categoría de una delegación en un periodo, con filtro opcional por contacto.';

revoke all on function public.get_category_breakdown(uuid, date, date, uuid) from anon;
grant execute on function public.get_category_breakdown(uuid, date, date, uuid) to authenticated;
