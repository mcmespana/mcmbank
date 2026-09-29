-- 072 — Subvenciones, segunda piedra: repartir un gasto, financiadores y la
-- ficha del Excel de la oficina técnica
--
-- Tres cambios, en este orden:
--
--   1. **Un gasto puede estar en varias subvenciones, con su parte.** Una
--      factura grande (el alojamiento de un campamento) se justifica 600 € en
--      el IVAJ y 400 € en la Diputación. Se quita el UNIQUE(movimiento_id) de
--      071 y cada imputación lleva `importe_imputado`. La regla que antes era
--      el UNIQUE ahora es un trigger: la suma de las partes no puede pasar del
--      importe del movimiento. Sigue en la base de datos porque la API y el MCP
--      también imputan.
--
--   2. **El financiador es una ficha**, no un texto: se repite todos los años
--      ("GVA IVAJ" 2023, 2024, 2025…) y es por lo que se ordena la lista —
--      arriba la Generalitat, abajo lo local y lo raro—. `ambito` da el grupo y
--      `orden` el puesto dentro del grupo.
--
--   3. **Los campos y estados del Excel "Plan Subvenciones"**, para poder
--      migrarlo (scripts/073) sin perder nada.
--
-- Idempotente: se puede ejecutar dos veces.

-- ---------------------------------------------------------------------------
-- 1. Financiadores
-- ---------------------------------------------------------------------------

create table if not exists public.financiador (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) > 0),
  -- Grupo en la lista. El orden de los grupos lo pone la aplicación
  -- (FINANCIADOR_AMBITOS en lib/types/database.ts), no el texto.
  ambito text not null default 'otro'
    check (ambito in ('autonomico', 'provincial', 'local', 'estatal', 'europeo', 'privado', 'otro')),
  -- Puesto dentro del grupo. Menor = más arriba.
  orden integer not null default 100,
  url text,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index if not exists financiador_nombre_unico on public.financiador (lower(btrim(nombre)));

comment on table public.financiador is
  'Quien convoca una subvención (GVA IVAJ, Ayto CS…). Se repite entre ejercicios. Solo gestores centrales.';

drop trigger if exists trg_financiador_touch on public.financiador;
create trigger trg_financiador_touch
  before update on public.financiador
  for each row execute function public.touch_actualizado_en();

alter table public.financiador enable row level security;

drop policy if exists "Gestores centrales gestionan financiadores" on public.financiador;
create policy "Gestores centrales gestionan financiadores"
  on public.financiador for all
  using ((select public.is_gestor_central()))
  with check ((select public.is_gestor_central()));

grant select, insert, update, delete on public.financiador to authenticated;

alter table public.subvencion
  add column if not exists financiador_id uuid references public.financiador(id) on delete restrict;

create index if not exists idx_subvencion_financiador on public.subvencion(financiador_id);

-- Lo que se escribió como texto en 071 pasa a ficha.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'subvencion' and column_name = 'financiador'
  ) then
    insert into public.financiador (nombre)
    select distinct btrim(financiador) from public.subvencion
     where financiador is not null and btrim(financiador) <> ''
    on conflict do nothing;

    update public.subvencion s
       set financiador_id = f.id
      from public.financiador f
     where s.financiador_id is null
       and lower(btrim(s.financiador)) = lower(btrim(f.nombre));

    alter table public.subvencion drop column financiador;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Campos y estados del Excel
-- ---------------------------------------------------------------------------

alter table public.subvencion
  -- Código corto con el que se la llama en la oficina: "GVA VOL", "IVAJ".
  add column if not exists codigo text,
  -- Quién la pide: "AJ" (la asociación), una delegación ("Castellón"), "ECE"…
  -- Texto porque no siempre es una delegación; `delegacion_id` se rellena
  -- cuando sí lo es.
  add column if not exists solicitante text,
  add column if not exists delegacion_id uuid references public.delegacion(id) on delete set null,
  add column if not exists fecha_convocatoria date,
  add column if not exists fecha_limite_solicitud date,
  add column if not exists fecha_justificacion_2 date,
  add column if not exists importe_cobrado numeric(12, 2) check (importe_cobrado is null or importe_cobrado >= 0),
  -- "J" del Excel: se ha completado todo el proceso y los requerimientos.
  -- Va aparte del estado: una subvención cobrada puede tener aún papeles
  -- pendientes, y al revés.
  add column if not exists justificacion_completa boolean not null default false,
  -- "🔁": sale cada año y nos vamos a ir presentando.
  add column if not exists recurrente boolean not null default false,
  add column if not exists url_carpeta text,
  -- Resto de enlaces (bases, readme, presupuesto…): [{ "nombre": "...", "url": "..." }].
  add column if not exists enlaces jsonb not null default '[]'::jsonb;

-- fecha_limite_justificacion de 071 es la primera fecha de justificación.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'subvencion' and column_name = 'fecha_limite_justificacion'
  ) then
    alter table public.subvencion rename column fecha_limite_justificacion to fecha_justificacion_1;
  end if;
end $$;

alter table public.subvencion add column if not exists fecha_justificacion_1 date;

comment on column public.subvencion.ejercicio is
  'Año de la convocatoria. NULL = "para estudiar": aún no hay convocatoria a la que presentarse.';
comment on column public.subvencion.convocatoria is
  'Nombre oficial de la convocatoria (largo, se enseña plegado).';

-- Estados: los del Excel, en su orden, con nombres nuestros.
alter table public.subvencion drop constraint if exists subvencion_estado_check;

update public.subvencion set estado = case estado
  when 'en_preparacion' then 'por_solicitar'
  when 'denegada' then 'rechazada'
  when 'cerrada' then 'cobrada'
  else estado
end
where estado in ('en_preparacion', 'denegada', 'cerrada');

alter table public.subvencion alter column estado set default 'por_solicitar';
alter table public.subvencion
  add constraint subvencion_estado_check check (estado in (
    'no_convocada', 'por_solicitar', 'solicitada', 'concedida', 'por_justificar',
    'justificada', 'cobrada', 'cobrada_parcial', 'rechazada', 'renuncia'
  ));

create index if not exists idx_subvencion_ejercicio on public.subvencion(ejercicio);

-- ---------------------------------------------------------------------------
-- 3. Repartir un movimiento entre subvenciones
-- ---------------------------------------------------------------------------

alter table public.subvencion_movimiento
  add column if not exists importe_imputado numeric(12, 2);

-- Lo imputado en 071 era el movimiento entero.
update public.subvencion_movimiento sm
   set importe_imputado = abs(m.importe)
  from public.movimiento m
 where m.id = sm.movimiento_id
   and sm.importe_imputado is null;

alter table public.subvencion_movimiento alter column importe_imputado set not null;
alter table public.subvencion_movimiento drop constraint if exists subvencion_movimiento_importe_positivo;
alter table public.subvencion_movimiento
  add constraint subvencion_movimiento_importe_positivo check (importe_imputado > 0);

alter table public.subvencion_movimiento drop constraint if exists subvencion_movimiento_unico;
create index if not exists idx_subvencion_movimiento_movimiento
  on public.subvencion_movimiento(movimiento_id);

comment on column public.subvencion_movimiento.importe_imputado is
  'Parte del movimiento que se justifica en esta subvención, en positivo. Entre todas las subvenciones no puede pasar de abs(movimiento.importe).';
comment on table public.subvencion_movimiento is
  'Movimientos imputados a una subvención, con su parte. Un movimiento puede repartirse entre varias sin pasar del 100 %.';

create or replace function public.mcm_subvencion_movimiento_reparto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total numeric;
  v_otros numeric;
  v_libre numeric;
  v_donde text;
begin
  -- Bloquea el movimiento: dos imputaciones a la vez del mismo gasto (dos
  -- gestores, o la web y el MCP) no pueden pasarse del 100 % entre las dos.
  -- security definer porque un gestor central puede no tener permiso de
  -- UPDATE sobre movimientos de todas las delegaciones, y FOR UPDATE lo pide.
  select abs(importe) into v_total
    from public.movimiento
   where id = new.movimiento_id
   for update;

  if v_total is null then
    raise exception 'El movimiento % no existe.', new.movimiento_id using errcode = '23503';
  end if;

  select coalesce(sum(importe_imputado), 0),
         string_agg(s.nombre || ' (' || to_char(sm.importe_imputado, 'FM999G999G990D00') || ' €)', ', ')
    into v_otros, v_donde
    from public.subvencion_movimiento sm
    join public.subvencion s on s.id = sm.subvencion_id
   where sm.movimiento_id = new.movimiento_id
     and sm.subvencion_id <> new.subvencion_id;

  v_libre := v_total - v_otros;

  -- Sin importe: todo lo que quede libre. Es lo que hace la acción en lote.
  if new.importe_imputado is null then
    new.importe_imputado := v_libre;
  end if;

  if v_libre <= 0.005 then
    raise exception 'Este movimiento ya está imputado entero en otras subvenciones: %.', v_donde
      using errcode = '23514',
            hint = 'Para imputarlo aquí, baja antes su parte en alguna de ellas.';
  end if;

  if new.importe_imputado > v_libre + 0.005 then
    raise exception 'Solo quedan % € libres de este movimiento (ya hay % en otras subvenciones: %).',
      to_char(v_libre, 'FM999G999G990D00'), to_char(v_otros, 'FM999G999G990D00'), v_donde
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.mcm_subvencion_movimiento_reparto() from anon, authenticated;

drop trigger if exists subvencion_movimiento_reparto on public.subvencion_movimiento;
create trigger subvencion_movimiento_reparto
  before insert or update of importe_imputado, movimiento_id on public.subvencion_movimiento
  for each row execute function public.mcm_subvencion_movimiento_reparto();

-- El resumen suma lo imputado, no el importe entero del movimiento.
drop view if exists public.subvencion_resumen;
create view public.subvencion_resumen
with (security_invoker = on) as
select
  s.id as subvencion_id,
  count(m.id)::int as movimientos,
  count(distinct m.delegacion_id)::int as delegaciones,
  coalesce(sum(sm.importe_imputado) filter (where m.importe < 0), 0)::numeric(14, 2) as total_gastos,
  coalesce(sum(sm.importe_imputado) filter (where m.importe > 0), 0)::numeric(14, 2) as total_ingresos,
  count(m.id) filter (where sm.importe_imputado < abs(m.importe) - 0.005)::int as movimientos_parciales
from public.subvencion s
left join public.subvencion_movimiento sm on sm.subvencion_id = s.id
left join public.movimiento m on m.id = sm.movimiento_id
group by s.id;

comment on view public.subvencion_resumen is
  'Recuento e importes imputados por subvención. total_gastos es la suma de las partes imputadas de los gastos, en positivo.';

grant select on public.subvencion_resumen to authenticated;
