-- 063_saldo_por_contacto.sql
--
-- Saldo por proveedor: a quién le paga la delegación, cuánto, y por qué
-- actividad. Es lo que responde de un vistazo "¿a quién le estamos pagando?".
--
-- Sigue el patrón de `get_category_breakdown`: SECURITY DEFINER más
-- `assert_delegacion_member`, que comprueba `auth.uid()`. Ojo con eso desde la
-- API externa o el MCP: allí se trabaja con el service role y esta función
-- fallaría siempre; ese camino tiene que agregar en JS, como hace
-- `lib/api/resumen.ts`.
--
-- `p_categorias` es el filtro por actividad. NULL o vacío significa "todas".

create or replace function public.get_saldo_por_contacto(
  p_delegacion_id uuid,
  p_desde         date default null,
  p_hasta         date default null,
  p_categorias    uuid[] default null
)
returns table (
  contacto_id                uuid,
  movimientos                bigint,
  ingresos                   numeric,
  gastos                     numeric,
  neto                       numeric,
  primera_fecha              date,
  ultima_fecha               date,
  categoria_principal_id     uuid,
  categoria_principal_importe numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  perform assert_delegacion_member(p_delegacion_id);

  return query
  with movimientos_filtrados as (
    select m.contacto_id, m.categoria_id, m.importe, m.fecha
      from movimiento m
      join cuenta cu on cu.id = m.cuenta_id
     where m.delegacion_id = p_delegacion_id
       and m.contacto_id is not null
       and m.ignorado = false
       and cu.activa = true
       and (p_desde is null or m.fecha >= p_desde)
       and (p_hasta is null or m.fecha <= p_hasta)
       and (p_categorias is null or cardinality(p_categorias) = 0
            or m.categoria_id = any(p_categorias))
  ),
  -- La actividad principal es aquella en la que más dinero se mueve con ese
  -- proveedor, no la que más veces aparece: cinco cafés no mandan sobre un
  -- autobús. Se mide en valor absoluto para que ingresos y gastos cuenten igual.
  actividad_principal as (
    select distinct on (mf.contacto_id)
           mf.contacto_id,
           mf.categoria_id,
           sum(abs(mf.importe)) as total
      from movimientos_filtrados mf
     group by mf.contacto_id, mf.categoria_id
     order by mf.contacto_id, sum(abs(mf.importe)) desc, mf.categoria_id
  )
  select
    mf.contacto_id,
    count(*)::bigint                                                          as movimientos,
    coalesce(sum(case when mf.importe > 0 then mf.importe else 0 end), 0)     as ingresos,
    coalesce(sum(case when mf.importe < 0 then abs(mf.importe) else 0 end), 0) as gastos,
    coalesce(sum(mf.importe), 0)                                              as neto,
    min(mf.fecha)                                                             as primera_fecha,
    max(mf.fecha)                                                             as ultima_fecha,
    ap.categoria_id                                                           as categoria_principal_id,
    ap.total                                                                  as categoria_principal_importe
  from movimientos_filtrados mf
  left join actividad_principal ap on ap.contacto_id = mf.contacto_id
  group by mf.contacto_id, ap.categoria_id, ap.total
  order by coalesce(sum(case when mf.importe < 0 then abs(mf.importe) else 0 end), 0) desc,
           count(*) desc;
end;
$function$;

comment on function public.get_saldo_por_contacto is
  'Saldo por contacto de una delegación, con filtro opcional de fechas y de categorías (actividad). Devuelve también su actividad principal por importe.';

revoke all on function public.get_saldo_por_contacto(uuid, date, date, uuid[]) from anon;
grant execute on function public.get_saldo_por_contacto(uuid, date, date, uuid[]) to authenticated;
