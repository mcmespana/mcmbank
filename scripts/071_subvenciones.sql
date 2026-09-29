-- 071 — Subvenciones: qué movimientos se han justificado en cada una
--
-- Hoy esto vive en un Excel enorme en la oficina técnica. La primera piedra es
-- la pregunta que más cuesta responder con ese Excel: "¿este gasto ya lo he
-- usado en otra subvención?". Por eso lo único que hace falta de momento es:
--
--   - la ficha de la subvención (quién financia, cuándo se pidió, cuánto se
--     concedió…), y
--   - la lista de movimientos imputados a ella, de cualquier delegación.
--
-- Decisiones que conviene no deshacer sin pensarlo:
--
--   1. **Una subvención no es de una delegación.** No lleva `delegacion_id`:
--      la pide la organización y se justifica con gastos de varias
--      delegaciones. La delegación de cada gasto sale de su movimiento.
--
--   2. **Un movimiento, una subvención** (UNIQUE sobre `movimiento_id`). Es la
--      regla que evita la doble justificación, y está en la base de datos y no
--      en la web porque la API y el MCP también escriben aquí. Si algún día un
--      gasto tiene que repartirse entre dos subvenciones (50 % y 50 %), se
--      añade `importe_imputado`, se quita el UNIQUE y se sustituye por un
--      trigger que impida pasar del 100 %. La tabla ya tiene la forma para
--      eso: una fila por par (subvención, movimiento).
--
--   3. **Borrar un movimiento justificado se rechaza** con un mensaje que dice
--      en qué subvención está. Con `ON DELETE CASCADE` desaparecería de la
--      justificación en silencio, y quien lo borra —un tesorero— ni siquiera
--      puede ver la subvención. Para borrarlo, primero hay que quitarlo de la
--      subvención, que es una decisión de la oficina técnica.
--
--   4. **Solo gestores centrales**, en las dos tablas. Los tesoreros no ven ni
--      las subvenciones ni qué movimientos suyos están imputados.

-- ---------------------------------------------------------------------------
-- subvencion
-- ---------------------------------------------------------------------------

create table if not exists public.subvencion (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) > 0),
  -- Texto libre por ahora ("Generalitat Valenciana · IVAJ"). Si hace falta
  -- agrupar por financiador, se convierte en tabla propia.
  financiador text not null check (length(btrim(financiador)) > 0),
  convocatoria text,
  expediente text,
  ejercicio integer check (ejercicio between 2000 and 2100),
  estado text not null default 'solicitada'
    check (estado in ('en_preparacion', 'solicitada', 'concedida', 'denegada', 'justificada', 'cerrada')),
  fecha_solicitud date,
  importe_solicitado numeric(12, 2) check (importe_solicitado is null or importe_solicitado >= 0),
  fecha_concesion date,
  importe_concedido numeric(12, 2) check (importe_concedido is null or importe_concedido >= 0),
  -- Periodo en el que los gastos son imputables. La pantalla avisa de los
  -- movimientos que caen fuera, pero no los rechaza: hay convocatorias con
  -- excepciones y la última palabra es de quien justifica.
  periodo_desde date,
  periodo_hasta date,
  fecha_limite_justificacion date,
  notas text,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint subvencion_periodo_valido
    check (periodo_desde is null or periodo_hasta is null or periodo_desde <= periodo_hasta)
);

comment on table public.subvencion is
  'Subvenciones de la organización. No son de una delegación: se justifican con movimientos de varias (subvencion_movimiento). Solo gestores centrales.';

create index if not exists idx_subvencion_estado on public.subvencion(estado);

drop trigger if exists trg_subvencion_touch on public.subvencion;
create trigger trg_subvencion_touch
  before update on public.subvencion
  for each row execute function public.touch_actualizado_en();

-- ---------------------------------------------------------------------------
-- subvencion_movimiento
-- ---------------------------------------------------------------------------

create table if not exists public.subvencion_movimiento (
  subvencion_id uuid not null references public.subvencion(id) on delete cascade,
  -- RESTRICT a propósito (ver 3. arriba); el trigger de más abajo da el
  -- mensaje legible antes de que salte la FK.
  movimiento_id uuid not null references public.movimiento(id) on delete restrict,
  notas text,
  asignado_por uuid references auth.users(id) on delete set null,
  asignado_en timestamptz not null default now(),
  primary key (subvencion_id, movimiento_id),
  -- Un movimiento solo puede justificar una subvención (ver 2. arriba).
  constraint subvencion_movimiento_unico unique (movimiento_id)
);

comment on table public.subvencion_movimiento is
  'Movimientos imputados a una subvención. Un movimiento solo puede estar en una (UNIQUE movimiento_id).';

create index if not exists idx_subvencion_movimiento_subvencion
  on public.subvencion_movimiento(subvencion_id);

-- ---------------------------------------------------------------------------
-- Borrar un movimiento justificado: rechazado, con el nombre de la subvención
-- ---------------------------------------------------------------------------

create or replace function public.mcm_movimiento_en_subvencion_no_se_borra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nombre text;
begin
  -- security definer: quien borra suele ser un tesorero, que por RLS no ve
  -- la subvención; sin esto el mensaje no podría decir cuál es.
  select s.nombre into v_nombre
    from public.subvencion_movimiento sm
    join public.subvencion s on s.id = sm.subvencion_id
   where sm.movimiento_id = old.id
   limit 1;

  if v_nombre is not null then
    raise exception 'Este movimiento está justificado en la subvención «%» y no se puede borrar. Pide a la oficina técnica que lo quite de la subvención primero.', v_nombre
      using errcode = '23503',
            hint = 'Subvenciones → abre la subvención → quita el movimiento.';
  end if;

  return old;
end;
$$;

revoke execute on function public.mcm_movimiento_en_subvencion_no_se_borra() from anon, authenticated;

drop trigger if exists movimiento_en_subvencion_no_se_borra on public.movimiento;
create trigger movimiento_en_subvencion_no_se_borra
  before delete on public.movimiento
  for each row execute function public.mcm_movimiento_en_subvencion_no_se_borra();

-- ---------------------------------------------------------------------------
-- Resumen por subvención (lo que pinta la lista)
-- ---------------------------------------------------------------------------

-- security_invoker: respeta la RLS de subvencion y de movimiento, así que un
-- no gestor central no ve filas.
create or replace view public.subvencion_resumen
with (security_invoker = on) as
select
  s.id as subvencion_id,
  count(m.id)::int as movimientos,
  count(distinct m.delegacion_id)::int as delegaciones,
  coalesce(sum(-m.importe) filter (where m.importe < 0), 0)::numeric(14, 2) as total_gastos,
  coalesce(sum(m.importe) filter (where m.importe > 0), 0)::numeric(14, 2) as total_ingresos
from public.subvencion s
left join public.subvencion_movimiento sm on sm.subvencion_id = s.id
left join public.movimiento m on m.id = sm.movimiento_id
group by s.id;

comment on view public.subvencion_resumen is
  'Recuento e importes imputados por subvención. total_gastos va en positivo (lo justificado).';

-- ---------------------------------------------------------------------------
-- RLS: solo gestores centrales
-- ---------------------------------------------------------------------------

alter table public.subvencion enable row level security;
alter table public.subvencion_movimiento enable row level security;

drop policy if exists "Gestores centrales gestionan subvenciones" on public.subvencion;
create policy "Gestores centrales gestionan subvenciones"
  on public.subvencion for all
  using ((select public.is_gestor_central()))
  with check ((select public.is_gestor_central()));

drop policy if exists "Gestores centrales imputan movimientos" on public.subvencion_movimiento;
create policy "Gestores centrales imputan movimientos"
  on public.subvencion_movimiento for all
  using ((select public.is_gestor_central()))
  with check ((select public.is_gestor_central()));

grant select, insert, update, delete on public.subvencion to authenticated;
grant select, insert, update, delete on public.subvencion_movimiento to authenticated;
grant select on public.subvencion_resumen to authenticated;
