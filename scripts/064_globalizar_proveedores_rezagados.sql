-- 064_globalizar_proveedores_rezagados.sql
--
-- Recoge los proveedores que se quedaron fuera del modelo nuevo.
--
-- Por qué hace falta: entre que se aplicó `061_proveedores_globales.sql` y que
-- se despliega el código que crea los proveedores como globales, la app en
-- producción sigue creándolos locales. Cada uno de esos es un proveedor que
-- esquiva el índice único (solo cubre los globales), así que más adelante podría
-- convivir un "Copigraf" local con otro global.
--
-- ESTE SCRIPT ESTÁ HECHO PARA EJECUTARSE VARIAS VECES. Conviene volver a
-- lanzarlo justo después de desplegar, para barrer lo que se haya creado
-- mientras tanto. Si no queda nada por migrar, no hace nada.
--
-- Los colisiones no se fusionan solas: decidir qué CIF, qué IBAN y qué logo
-- sobreviven cuando dos delegaciones tienen el mismo proveedor es una decisión
-- de personas. El script se para y los enumera.

do $$
declare
  choques text;
begin
  -- ¿Algún proveedor local se llama igual que uno que ya es global?
  select string_agg(distinct l.nombre, ', ')
    into choques
    from public.contacto l
    join public.contacto g
      on g.tipo = 'proveedor'
     and g.es_global
     and g.clave_normalizada = l.clave_normalizada
   where l.tipo = 'proveedor'
     and not l.es_global
     and l.clave_normalizada is not null;

  if choques is not null then
    raise exception
      'Estos proveedores locales ya existen como globales y hay que fusionarlos a mano: %', choques;
  end if;

  -- ¿Y entre ellos mismos, dos delegaciones con el mismo proveedor local?
  select string_agg(clave_normalizada, ', ')
    into choques
    from (
      select clave_normalizada
        from public.contacto
       where tipo = 'proveedor' and not es_global and clave_normalizada is not null
       group by clave_normalizada
      having count(*) > 1
    ) d;

  if choques is not null then
    raise exception
      'Hay proveedores locales repetidos entre delegaciones; fusiónalos antes: %', choques;
  end if;
end;
$$;

-- La adopción se crea ANTES de globalizar, porque después `delegacion_id` ya es
-- null y se habría perdido de quién era.
insert into public.contacto_delegacion (
  contacto_id, delegacion_id, categoria_id_predeterminada, notas, archivado, creado_por, creado_en
)
select c.id, c.delegacion_id, c.categoria_id_predeterminada, c.notas, c.archivado, c.creado_por, c.creado_en
  from public.contacto c
 where c.tipo = 'proveedor'
   and not c.es_global
   and c.delegacion_id is not null
on conflict (contacto_id, delegacion_id) do nothing;

-- Y las delegaciones que ya le hayan pagado, aunque la ficha fuera de otra.
insert into public.contacto_delegacion (contacto_id, delegacion_id)
select distinct m.contacto_id, m.delegacion_id
  from public.movimiento m
  join public.contacto c on c.id = m.contacto_id
 where c.tipo = 'proveedor' and m.delegacion_id is not null
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
 where tipo = 'proveedor'
   and not es_global;
