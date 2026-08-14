-- 061_proveedores_globales.sql
--
-- Los proveedores pasan a ser de todo MCM.
--
-- El problema: si cada delegación se crea su propia ficha de Mercadona, hay
-- dieciocho Mercadonas, el logo lo tiene que poner dieciocho veces alguien, y
-- ninguna pregunta interdelegacional ("¿cuánto gasta MCM en Mercadona?") se
-- puede responder.
--
-- La solución: una sola fila de proveedor para toda la organización
-- (`es_global = true`, `delegacion_id = null`) y una tabla puente,
-- `contacto_delegacion`, que dice qué delegaciones lo usan. Tener fila ahí es
-- lo que hace que un proveedor aparezca en tu lista; si tu delegación nunca le
-- ha comprado, no lo ves. Es el mismo patrón que `categoria_orden_delegacion`.
--
-- Lo que NO se globaliza: personas MCM y destinatarios MCM. Ahí hay nombres de
-- socios, voluntarios y familias destinatarias. Son datos personales y no tienen
-- por qué cruzar de una delegación a otra.

-- ---------------------------------------------------------------------------
-- 1. Clave canónica: lo que hace imposible tener dos Mercadonas
-- ---------------------------------------------------------------------------

alter table public.contacto
  add column if not exists clave_normalizada text,
  add column if not exists actualizado_por   uuid references auth.users(id);

/**
 * Nombre de proveedor reducido a su forma canónica: minúsculas, sin acentos,
 * sin puntuación y sin forma jurídica.
 *
 *   'MERCADONA, S.A.' → 'mercadona'
 *   'Mercadona'       → 'mercadona'
 *   'Leroy  Merlín'   → 'leroy merlin'
 *
 * Vive en la base de datos, y no en la app, a propósito: la calcula un trigger,
 * así que el invariante se cumple venga la escritura de la web, de la API
 * externa, del servidor MCP o de una consola SQL. `lib/utils/proveedor-logo.ts`
 * tiene una versión en TypeScript, pero solo para buscar el dominio del logo y
 * para sugerir coincidencias mientras escribes: si alguna vez se separan, lo
 * único que pasa es que no se encuentra un dominio, nunca que entre un
 * duplicado.
 */
create or replace function public.mcm_clave_proveedor(nombre text)
returns text
language plpgsql
immutable
as $$
declare
  base      text;
  palabras  text[];
  salida    text[] := '{}';
  palabra   text;
  anterior  text;
  n         int;
  sufijos   text[] := array[
    'slu','slp','sll','sal','sau','sa','sl','scp','sc','cb','coop','scoop',
    'sccl','aie','ute','srl','ltd','limited','inc','llc','gmbh','bv','nv','srls'
  ];
begin
  if nombre is null then
    return '';
  end if;

  base := lower(translate(
    nombre,
    'ÁÀÄÂÃÅáàäâãåÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÑñÇç',
    'aaaaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuunncc'
  ));
  -- La puntuación pasa a espacio, no se borra: 'a.b' no debe volverse 'ab'.
  base := btrim(regexp_replace(base, '[^a-z0-9]+', ' ', 'g'));

  if base = '' then
    return '';
  end if;

  -- Formas jurídicas escritas con palabras, antes de trocear.
  base := btrim(regexp_replace(
    base, '\s+(sociedad limitada|sociedad anonima|sl unipersonal)$', '', 'g'
  ));

  palabras := regexp_split_to_array(base, '\s+');

  -- 'S.A.' quedó como 's a' al pasar la puntuación a espacios, así que las
  -- rachas de letras sueltas se vuelven a pegar: sin esto 'MERCADONA, S.A.' no
  -- coincidiría con el sufijo 'sa' y quedarían dos claves del mismo proveedor.
  foreach palabra in array palabras loop
    n := coalesce(array_length(salida, 1), 0);
    anterior := case when n > 0 then salida[n] else null end;

    if length(palabra) = 1
       and anterior is not null
       and length(anterior) <= 2
       and anterior ~ '^[a-z]+$'
    then
      salida[n] := anterior || palabra;
    else
      salida := salida || palabra;
    end if;
  end loop;

  -- Los sufijos se quitan solo del final, y nunca si son lo único que queda:
  -- hay proveedores que se llaman literalmente 'SA' o 'Coop'.
  loop
    n := coalesce(array_length(salida, 1), 0);
    exit when n <= 1 or not (salida[n] = any(sufijos));
    salida := salida[1:n - 1];
  end loop;

  return array_to_string(salida, ' ');
end;
$$;

create or replace function public.contacto_calcular_clave()
returns trigger
language plpgsql
as $$
begin
  new.clave_normalizada := nullif(public.mcm_clave_proveedor(new.nombre), '');
  return new;
end;
$$;

drop trigger if exists contacto_clave_normalizada on public.contacto;
create trigger contacto_clave_normalizada
  before insert or update of nombre on public.contacto
  for each row execute function public.contacto_calcular_clave();

update public.contacto
   set clave_normalizada = nullif(public.mcm_clave_proveedor(nombre), '')
 where clave_normalizada is null;

-- ---------------------------------------------------------------------------
-- 2. Tabla puente: qué delegaciones usan cada contacto, y sus matices
-- ---------------------------------------------------------------------------

/**
 * Adopción de un contacto por una delegación, más lo que es de esa delegación y
 * no del proveedor.
 *
 * El reparto: lo objetivo (nombre, CIF, IBAN, web, logo) vive en `contacto` y lo
 * comparten todos; lo opinable vive aquí. La categoría, sobre todo: una ficha
 * global no puede apuntar a una categoría de Castellón sin romperles la
 * sugerencia a las demás delegaciones.
 *
 * Los campos son sobrescrituras: null significa "usa el valor de la ficha".
 */
create table if not exists public.contacto_delegacion (
  contacto_id                 uuid        not null references public.contacto(id)   on delete cascade,
  delegacion_id               uuid        not null references public.delegacion(id) on delete cascade,
  categoria_id_predeterminada uuid                 references public.categoria(id)  on delete set null,
  alias                       text,
  notas                       text,
  archivado                   boolean     not null default false,
  creado_por                  uuid                 references auth.users(id),
  creado_en                   timestamptz not null default now(),
  primary key (contacto_id, delegacion_id)
);

create index if not exists contacto_delegacion_delegacion_idx
  on public.contacto_delegacion (delegacion_id);

comment on table public.contacto_delegacion is
  'Qué delegaciones usan cada contacto global, y las sobrescrituras propias de cada una. Tener fila aquí es lo que hace visible un proveedor global en una delegación.';

-- ---------------------------------------------------------------------------
-- 3. Migración de los proveedores que ya existen
-- ---------------------------------------------------------------------------

-- Antes de tocar nada: si dos delegaciones tuvieran ya el mismo proveedor, hay
-- que fusionarlos a mano (decidir qué CIF e IBAN se quedan). Es preferible que
-- la migración se pare a que junte fichas por su cuenta.
do $$
declare
  duplicados text;
begin
  select string_agg(clave_normalizada || ' (' || cnt || ')', ', ')
    into duplicados
  from (
    select clave_normalizada, count(*) as cnt
      from public.contacto
     where tipo = 'proveedor' and clave_normalizada is not null
     group by clave_normalizada
    having count(*) > 1
  ) d;

  if duplicados is not null then
    raise exception
      'Hay proveedores repetidos que hay que fusionar antes de globalizar: %', duplicados;
  end if;
end;
$$;

-- Cada proveedor local queda adoptado por su delegación, llevándose lo que era
-- suyo y no del proveedor.
insert into public.contacto_delegacion (
  contacto_id, delegacion_id, categoria_id_predeterminada, notas, archivado, creado_por, creado_en
)
select c.id, c.delegacion_id, c.categoria_id_predeterminada, c.notas, c.archivado, c.creado_por, c.creado_en
  from public.contacto c
 where c.tipo = 'proveedor'
   and c.delegacion_id is not null
on conflict (contacto_id, delegacion_id) do nothing;

-- Y también las delegaciones que ya tienen movimientos o facturas con un
-- proveedor: si le has pagado, lo usas.
insert into public.contacto_delegacion (contacto_id, delegacion_id)
select distinct m.contacto_id, m.delegacion_id
  from public.movimiento m
  join public.contacto c on c.id = m.contacto_id
 where c.tipo = 'proveedor' and m.contacto_id is not null and m.delegacion_id is not null
on conflict (contacto_id, delegacion_id) do nothing;

insert into public.contacto_delegacion (contacto_id, delegacion_id)
select distinct f.contacto_id, f.delegacion_id
  from public.factura f
  join public.contacto c on c.id = f.contacto_id
 where c.tipo = 'proveedor' and f.contacto_id is not null
on conflict (contacto_id, delegacion_id) do nothing;

update public.contacto
   set es_global = true,
       delegacion_id = null
 where tipo = 'proveedor';

-- Ahora sí: dos Mercadonas dejan de ser un despiste posible.
create unique index if not exists contacto_proveedor_global_clave_uq
  on public.contacto (clave_normalizada)
  where tipo = 'proveedor' and es_global and clave_normalizada is not null;

-- ---------------------------------------------------------------------------
-- 4. Adopción automática, en la base de datos
-- ---------------------------------------------------------------------------

/**
 * Vincular un proveedor a un movimiento o a una factura equivale a adoptarlo.
 *
 * Va en un trigger y no en la app porque hay cuatro caminos de escritura (web,
 * API externa, servidor MCP e importación de Excel) y cualquiera que se olvidara
 * dejaría un proveedor invisible en la pantalla de quien lo acaba de usar.
 */
create or replace function public.contacto_adoptar_al_vincular()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contacto_id is null or new.delegacion_id is null then
    return new;
  end if;

  insert into public.contacto_delegacion (contacto_id, delegacion_id)
  select new.contacto_id, new.delegacion_id
    from public.contacto c
   where c.id = new.contacto_id and c.es_global
  on conflict (contacto_id, delegacion_id) do nothing;

  return new;
end;
$$;

drop trigger if exists movimiento_adoptar_contacto on public.movimiento;
create trigger movimiento_adoptar_contacto
  after insert or update of contacto_id on public.movimiento
  for each row execute function public.contacto_adoptar_al_vincular();

drop trigger if exists factura_adoptar_contacto on public.factura;
create trigger factura_adoptar_contacto
  after insert or update of contacto_id on public.factura
  for each row execute function public.contacto_adoptar_al_vincular();

-- ---------------------------------------------------------------------------
-- 5. Que borrar no pueda hacer daño en otra delegación
-- ---------------------------------------------------------------------------

/**
 * `movimiento.contacto_id` y `factura.contacto_id` son ON DELETE SET NULL, así
 * que borrar el Mercadona compartido dejaría sin proveedor los movimientos de
 * todas las demás delegaciones, en silencio. Esto lo impide: si el proveedor lo
 * usa alguien más, no se borra. Para dejar de verlo está archivarlo, que es una
 * decisión de tu delegación y no le quita nada a nadie.
 */
create or replace function public.contacto_impedir_borrado_compartido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delegaciones int;
begin
  if not old.es_global then
    return old;
  end if;

  select count(distinct delegacion_id) into delegaciones
    from (
      select delegacion_id from public.contacto_delegacion where contacto_id = old.id
      union
      select delegacion_id from public.movimiento where contacto_id = old.id and delegacion_id is not null
      union
      select delegacion_id from public.factura    where contacto_id = old.id
    ) usos;

  if delegaciones > 1 then
    raise exception
      'No se puede borrar "%": lo usan % delegaciones. Archívalo en la tuya en su lugar.',
      old.nombre, delegaciones;
  end if;

  return old;
end;
$$;

drop trigger if exists contacto_borrado_compartido on public.contacto;
create trigger contacto_borrado_compartido
  before delete on public.contacto
  for each row execute function public.contacto_impedir_borrado_compartido();

-- ---------------------------------------------------------------------------
-- 6. Permisos
-- ---------------------------------------------------------------------------

-- Cualquier tesorero puede dar de alta y corregir un proveedor compartido: es
-- justo lo que se busca —que quien ponga el logo o el CIF se lo ahorre a las
-- otras diecisiete delegaciones—. Las personas MCM y los destinatarios siguen
-- necesitando gestor_central para hacerse globales, porque ahí hay datos
-- personales. Y borrar un global se queda en gestor_central.

drop policy if exists "Users can insert contactos in their delegations" on public.contacto;
create policy "Users can insert contactos in their delegations"
  on public.contacto for insert
  with check (
    (
      es_global = false
      and exists (
        select 1 from public.membresia mb
         where mb.delegacion_id = contacto.delegacion_id and mb.usuario_id = auth.uid()
      )
    )
    or (
      es_global = true
      and tipo = 'proveedor'
      and exists (
        select 1 from public.membresia mb
         where mb.usuario_id = auth.uid() and mb.rol in ('tesorero', 'gestor_central')
      )
    )
    or (
      es_global = true
      and exists (
        select 1 from public.membresia mb
         where mb.usuario_id = auth.uid() and mb.rol = 'gestor_central'
      )
    )
  );

drop policy if exists "Users can update contactos in their delegations" on public.contacto;
create policy "Users can update contactos in their delegations"
  on public.contacto for update
  using (
    (
      es_global = false
      and exists (
        select 1 from public.membresia mb
         where mb.delegacion_id = contacto.delegacion_id and mb.usuario_id = auth.uid()
      )
    )
    or (
      es_global = true
      and tipo = 'proveedor'
      and exists (
        select 1 from public.membresia mb
         where mb.usuario_id = auth.uid() and mb.rol in ('tesorero', 'gestor_central')
      )
    )
    or (
      es_global = true
      and exists (
        select 1 from public.membresia mb
         where mb.usuario_id = auth.uid() and mb.rol = 'gestor_central'
      )
    )
  );

-- La tabla puente: cada delegación manda en sus propias filas.
alter table public.contacto_delegacion enable row level security;

drop policy if exists "Ver adopciones de mis delegaciones" on public.contacto_delegacion;
create policy "Ver adopciones de mis delegaciones"
  on public.contacto_delegacion for select
  using (
    (select public.is_gestor_central())
    or exists (
      select 1 from public.membresia mb
       where mb.delegacion_id = contacto_delegacion.delegacion_id and mb.usuario_id = auth.uid()
    )
  );

drop policy if exists "Gestionar adopciones de mis delegaciones" on public.contacto_delegacion;
create policy "Gestionar adopciones de mis delegaciones"
  on public.contacto_delegacion for all
  using (
    (select public.is_gestor_central())
    or exists (
      select 1 from public.membresia mb
       where mb.delegacion_id = contacto_delegacion.delegacion_id
         and mb.usuario_id = auth.uid()
         and mb.rol in ('tesorero', 'gestor_central')
    )
  )
  with check (
    (select public.is_gestor_central())
    or exists (
      select 1 from public.membresia mb
       where mb.delegacion_id = contacto_delegacion.delegacion_id
         and mb.usuario_id = auth.uid()
         and mb.rol in ('tesorero', 'gestor_central')
    )
  );
