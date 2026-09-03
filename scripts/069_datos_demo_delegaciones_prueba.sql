-- 069_datos_demo_delegaciones_prueba.sql
--
-- Datos de demostración para las tres delegaciones de prueba
-- («-T MCM Nueva Yorki», «-T MCM Puerto Rico», «-T New Dele»).
--
-- Estas delegaciones existen para enseñar la aplicación y para formar a las
-- tesoreras nuevas, así que sus datos tienen que ser creíbles: un curso
-- completo (septiembre 2025 → agosto 2026) con sus cuotas, su campamento, su
-- subvención y su cierre en positivo. Lo que había antes eran movimientos
-- generados al azar —gastos en positivo, «Blablablablablabla», 4.102 € de
-- refrescos, categorías sorteadas— y una demo que no cuadra enseña a
-- desconfiar de la herramienta.
--
-- El script es IDEMPOTENTE: borra los movimientos, facturas, avisos y
-- contactos privados de esas tres delegaciones y los vuelve a construir. No
-- toca ninguna otra delegación, ni los proveedores globales (que comparten las
-- 18 delegaciones), ni la conexión bancaria de pruebas de Nueva Yorki.
--
-- Los importes se derivan de un md5 del concepto, así que dos ejecuciones
-- producen exactamente los mismos números: la demo es reproducible.

do $$
declare
  v_autor uuid;
  v_admin uuid;
  v_org uuid;
  v_ny uuid;
  v_pr uuid;
  v_nd uuid;
begin
  select id into v_autor from auth.users where email = 'demo@demo.com';
  select id into v_admin from auth.users where email = 'admin@movimientoconsolacion.com';
  v_autor := coalesce(v_autor, v_admin);

  if v_autor is null then
    raise exception 'No hay usuario al que atribuir los datos demo';
  end if;

  select id into v_ny from delegacion where nombre = '-T MCM Nueva Yorki';
  select id into v_pr from delegacion where nombre = '-T MCM Puerto Rico';
  select id into v_nd from delegacion where nombre = '-T New Dele';

  if v_ny is null or v_pr is null or v_nd is null then
    raise exception 'Faltan delegaciones de prueba (NY=%, PR=%, ND=%)', v_ny, v_pr, v_nd;
  end if;

  select organizacion_id into v_org from delegacion where id = v_ny;

  -- ------------------------------------------------------------------
  -- 1. Limpieza de lo que había
  -- ------------------------------------------------------------------

  -- Desvincular antes de borrar: el trigger de recálculo de estado de factura
  -- se dispara con el borrado del movimiento y no queremos que toque filas
  -- que están a punto de desaparecer.
  update movimiento set factura_id = null
  where delegacion_id in (v_ny, v_pr, v_nd) and factura_id is not null;

  delete from movimiento
  where cuenta_id in (select id from cuenta where delegacion_id in (v_ny, v_pr, v_nd))
     or delegacion_id in (v_ny, v_pr, v_nd);

  delete from factura where delegacion_id in (v_ny, v_pr, v_nd);
  delete from aviso where delegacion_id in (v_ny, v_pr, v_nd);
  -- Los pagos MCM apuntan al contacto con una FK sin cascada, así que van antes.
  delete from pago_mcm where delegacion_id in (v_ny, v_pr, v_nd);
  delete from contacto_delegacion where delegacion_id in (v_ny, v_pr, v_nd);
  delete from contacto where es_global = false and delegacion_id in (v_ny, v_pr, v_nd);

  -- ------------------------------------------------------------------
  -- 2. Cuentas
  -- ------------------------------------------------------------------
  -- Cada delegación acaba con tres: la cuenta corriente por la que entra y
  -- sale casi todo, una segunda cuenta para las actividades grandes
  -- (campamento) y la caja de efectivo.

  -- Nueva Yorki: la cuenta conectada por EnableBanking se queda como está
  -- —es la única conexión de pruebas que hay— pero pasa a llamarse como se
  -- llamaría de verdad, y hace de «cuenta de actividades».
  update cuenta set nombre = 'Sabadell · Cuenta delegación',
                    banco_nombre = 'Sabadell',
                    iban = 'ES9100815240000003245001',
                    descripcion = 'Cuenta corriente principal de la delegación',
                    personas_autorizadas = 'Ana Ruiz (tesorera), Marcos Pons (responsable)',
                    color = '#85C1E9'
  where delegacion_id = v_ny and nombre = 'Sabadell Cuenta NuevYol';

  update cuenta set nombre = 'Caja en efectivo',
                    descripcion = 'Efectivo de la delegación: meriendas, hucha y rifas',
                    color = '#BB8FCE'
  where delegacion_id = v_ny and nombre = 'Efectivo NY';

  update cuenta set nombre = 'Sabadell · Cuenta actividades (conectada)',
                    descripcion = 'Cuenta del campamento, sincronizada con el banco'
  where delegacion_id = v_ny and origen = 'conectada';

  delete from cuenta where delegacion_id = v_ny and nombre = 'PruebaFormacion';

  -- Puerto Rico: la tercera cuenta decía «Santander» en el nombre y
  -- «Caixabank» en el banco.
  update cuenta set nombre = 'Sabadell · Cuenta delegación',
                    banco_nombre = 'Sabadell',
                    iban = 'ES9100815240000003245002',
                    descripcion = 'Cuenta corriente principal de la delegación',
                    personas_autorizadas = 'Lucía Bermúdez (tesorera), Iván Salas (responsable)',
                    color = '#85C1E9'
  where delegacion_id = v_pr and nombre = 'Banco Sabadell Puerto Rico';

  update cuenta set nombre = 'Caja en efectivo',
                    descripcion = 'Efectivo de la delegación: meriendas, hucha y rifas',
                    color = '#BB8FCE'
  where delegacion_id = v_pr and nombre = 'Caja en efectivo PR';

  update cuenta set nombre = 'CaixaBank · Cuenta actividades',
                    banco_nombre = 'CaixaBank',
                    iban = 'ES6821000418401234567891',
                    descripcion = 'Cuenta separada para el campamento y las convivencias',
                    color = '#98D8C8'
  where delegacion_id = v_pr and nombre = 'Cuenta Santander PR';

  -- New Dele no tenía ninguna cuenta.
  insert into cuenta (delegacion_id, nombre, tipo, origen, banco_nombre, iban, color, descripcion, personas_autorizadas)
  select v_nd, 'Sabadell · Cuenta delegación', 'banco', 'manual', 'Sabadell', 'ES9100815240000003245003',
         '#85C1E9', 'Cuenta corriente principal de la delegación',
         'Nerea Chaves (tesorera), Tomás Iriarte (responsable)'
  where not exists (select 1 from cuenta where delegacion_id = v_nd and nombre = 'Sabadell · Cuenta delegación');

  insert into cuenta (delegacion_id, nombre, tipo, origen, color, descripcion)
  select v_nd, 'CaixaBank · Cuenta actividades', 'banco', 'manual', '#98D8C8',
         'Cuenta separada para el campamento y las convivencias'
  where not exists (select 1 from cuenta where delegacion_id = v_nd and nombre = 'CaixaBank · Cuenta actividades');

  update cuenta set banco_nombre = 'CaixaBank', iban = 'ES6821000418401234567892'
  where delegacion_id = v_nd and nombre = 'CaixaBank · Cuenta actividades';

  insert into cuenta (delegacion_id, nombre, tipo, origen, color, descripcion)
  select v_nd, 'Caja en efectivo', 'caja', 'manual', '#BB8FCE',
         'Efectivo de la delegación: meriendas, hucha y rifas'
  where not exists (select 1 from cuenta where delegacion_id = v_nd and nombre = 'Caja en efectivo');

  -- ------------------------------------------------------------------
  -- 3. Categorías propias de cada delegación
  -- ------------------------------------------------------------------
  -- Una por delegación, para que la pantalla de categorías enseñe la mezcla
  -- de globales y propias que es lo normal en producción.

  update categoria set nombre = 'Campamento de verano 26', emoji = '⛺', color = '#F9E79F', orden = 14
  where delegacion_id = v_ny and nombre = 'hooola';

  insert into categoria (organizacion_id, nombre, tipo, emoji, color, orden, delegacion_id, es_global, esta_activa)
  select v_org, 'Campamento de verano 26', 'mixto', '⛺', '#F9E79F', 14, v_ny, false, true
  where not exists (select 1 from categoria where delegacion_id = v_ny and nombre = 'Campamento de verano 26');

  insert into categoria (organizacion_id, nombre, tipo, emoji, color, orden, delegacion_id, es_global, esta_activa)
  select v_org, 'Convivencias de zona', 'mixto', '🚌', '#d0ecdf', 14, v_pr, false, true
  where not exists (select 1 from categoria where delegacion_id = v_pr and nombre = 'Convivencias de zona');

  insert into categoria (organizacion_id, nombre, tipo, emoji, color, orden, delegacion_id, es_global, esta_activa)
  select v_org, 'Local nuevo', 'mixto', '🏠', '#cbe7fb', 14, v_nd, false, true
  where not exists (select 1 from categoria where delegacion_id = v_nd and nombre = 'Local nuevo');

  -- ------------------------------------------------------------------
  -- 4. Contactos privados de cada delegación
  -- ------------------------------------------------------------------
  -- Los proveedores son globales y ya existen; lo que falta son las personas
  -- y los destinatarios MCM, que sí son privados de cada delegación.

  insert into contacto (delegacion_id, es_global, tipo, nombre, emoji, iban, email, telefono, notas, creado_por)
  values
    (v_ny, false, 'persona_mcm', 'Ana Ruiz Delgado', '🙋', 'ES6600491500051234567892', 'ana.ruiz@example.org', '600 111 222', 'Tesorera de la delegación', v_autor),
    (v_ny, false, 'persona_mcm', 'Marcos Pons Aguilar', '🙋', null, 'marcos.pons@example.org', '600 111 333', 'Responsable de delegación', v_autor),
    (v_ny, false, 'destinatario_mcm', 'ECE MCM · Cuota anual', '🏛️', 'ES2114650100721234567892', 'ece@movimientoconsolacion.com', null, 'A donde se envía la cuota anual de la delegación', v_autor),
    (v_pr, false, 'persona_mcm', 'Lucía Bermúdez Ferrán', '🙋', 'ES6600491500051234567893', 'lucia.bermudez@example.org', '600 222 111', 'Tesorera de la delegación', v_autor),
    (v_pr, false, 'persona_mcm', 'Iván Salas Nadal', '🙋', null, 'ivan.salas@example.org', '600 222 333', 'Responsable de delegación', v_autor),
    (v_pr, false, 'destinatario_mcm', 'ECE MCM · Cuota anual', '🏛️', 'ES2114650100721234567892', 'ece@movimientoconsolacion.com', null, 'A donde se envía la cuota anual de la delegación', v_autor),
    (v_nd, false, 'persona_mcm', 'Nerea Chaves Ortiz', '🙋', 'ES6600491500051234567894', 'nerea.chaves@example.org', '600 333 111', 'Tesorera de la delegación', v_autor),
    (v_nd, false, 'destinatario_mcm', 'ECE MCM · Cuota anual', '🏛️', 'ES2114650100721234567892', 'ece@movimientoconsolacion.com', null, 'A donde se envía la cuota anual de la delegación', v_autor);

  -- ------------------------------------------------------------------
  -- 5. Movimientos: un curso completo por delegación
  -- ------------------------------------------------------------------
  -- Las plantillas describen QUÉ pasa y CUÁNDO; el importe exacto y el día del
  -- mes salen de un md5 del concepto, así que varían de un mes a otro pero no
  -- de una ejecución a otra.
  --
  -- signo: +1 ingreso, -1 gasto. Un gasto en positivo es el error que hacía
  -- ilegible la demo anterior, así que aquí el signo es explícito.
  -- meses: 1 = septiembre 2025 … 12 = agosto 2026.
  -- cuenta: 'banco' (corriente), 'actividades' (la segunda) o 'caja'.

  create temporary table tmp_plantilla (
    concepto text,
    categoria text,
    proveedor text,
    base numeric,
    signo int,
    meses int[],
    cuenta text
  ) on commit drop;

  insert into tmp_plantilla values
    -- Ingresos
    ('Remanente del curso anterior',                    'Remanente - Saldo Inicial',        null,                            2400, 1, '{1}',                        'banco'),
    ('Cuotas MIC-COM · mensualidad',                    'Cuotas MIC-COM',                   null,                             320, 1, '{2,3,4,5,6,7,8,9}',          'banco'),
    ('Cuotas COM-LC +18 · trimestre',                   'Cuotas COM-LC +18',                null,                             210, 1, '{2,5,8}',                    'banco'),
    ('Subvención IVAJ · Bloque 1 (oct-mar)',            'Subvenciones',                     null,                            1850, 1, '{5}',                        'banco'),
    ('Subvención IVAJ · Bloque 2 (abr-sep)',            'Subvenciones',                     null,                            1600, 1, '{11}',                       'banco'),
    ('Aportación de las familias · campamento',         'Actividades 25-26',                null,                            1950, 1, '{10}',                       'actividades'),
    ('Inscripciones convivencia de Navidad',            'Actividades 25-26',                null,                             260, 1, '{4}',                        'caja'),
    ('Rifa solidaria · recaudación',                    'Actividades 25-26',                null,                             180, 1, '{7}',                        'caja'),
    ('Venta de pañuelos y libros de vida',              'Pañuelos, libros de vida y otros', null,                              95, 1, '{2,9}',                      'caja'),
    ('Sobre de la semana',                              'MIC-COM Semanal',                  null,                              45, 1, '{2,3,4,5,6,7,8,9,10}',       'caja'),
    -- Gastos corrientes
    ('MERCADONA · merienda de la reunión',              'Comidas, dietas, viajes y eventos','Mercadona',                       38,-1, '{1,2,3,4,5,6,7,8,9,10,11}',  'banco'),
    ('MERCADONA · compra para el fin de semana',        'Comidas, dietas, viajes y eventos','Mercadona',                       45,-1, '{2,4,6,8,10,12}',            'banco'),
    ('CONSUM · compra de la convivencia',               'Comidas, dietas, viajes y eventos','Consum',                          74,-1, '{4,7,10}',                   'banco'),
    ('Reunión de tesoreros · dietas y viaje',           'Comidas, dietas, viajes y eventos', null,                             46,-1, '{3,7,11}',                   'banco'),
    ('AMAZON · material para los talleres',             'Compras Material',                 'Amazon',                          56,-1, '{2,4,6,9,11}',               'banco'),
    ('COPIGRAF · fotocopias y cuadernillos',            'Compras Material',                 'Copigraf',                        88,-1, '{1,5,9}',                    'banco'),
    ('Chinos varios · material de manualidades',        'Compras Material',                 'Chinos varios',                   24,-1, '{3,6,10}',                   'caja'),
    ('MAYPELL · camisetas del campamento',              'Compras Material',                 'MAYPELL PUBLIDISEÑO S.L.',       310,-1, '{10}',                       'actividades'),
    ('AMAZON · proyector para el local',                'Compras Inversión',                'Amazon',                         349,-1, '{5}',                        'banco'),
    ('Seguro de responsabilidad civil · anual',         'Seguros',                          null,                             340,-1, '{2}',                        'banco'),
    ('Google Workspace · suscripción',                  'Software y suscripciones',         null,                              14,-1, '{1,2,3,4,5,6,7,8,9,10,11,12}','banco'),
    ('Canva Pro · suscripción anual',                   'Software y suscripciones',         null,                             110,-1, '{3}',                        'banco'),
    ('Comisión de mantenimiento',                       'Comisiones bancos',                null,                              12,-1, '{1,4,7,10}',                 'banco'),
    ('Cuota anual de la delegación al ECE',             'Cuota anual enviada al ECE',       null,                             450,-1, '{3}',                        'banco'),
    ('Formación de monitores · primeros auxilios',      'Formación',                        null,                             180,-1, '{2,9}',                      'banco'),
    ('Luz del local',                                   'Suministros',                      null,                              62,-1, '{1,3,5,7,9,11}',             'banco'),
    ('Agua del local',                                  'Suministros',                      null,                              28,-1, '{2,6,10}',                   'banco'),
    ('Pañuelos para los nuevos miembros',               'Pañuelos, libros de vida y otros', null,                             130,-1, '{2}',                        'banco'),
    ('Libros de vida · pedido a la editorial',          'Pañuelos, libros de vida y otros', null,                              95,-1, '{8}',                        'banco'),
    ('Botiquín y farmacia',                             'Otros',                            null,                              34,-1, '{10}',                       'caja'),
    -- Convivencias y campamento
    ('RUTAS RODRIGUEZ · autocar de la convivencia',     'Actividades 25-26',                'Rutas Rodriguez',                420,-1, '{4,8}',                      'actividades'),
    ('LA SERRANA · señal de la casa de convivencias',   'Actividades 25-26',                'CENTRO INTEGRAL DE TURISMO BUÑOL S.L. (La Serrana)', 600,-1, '{6}',   'actividades'),
    ('CASA DON BOSCO GODELLETA · campamento de verano', 'Actividades 25-26',                'Casa Don Bosco Godelleta',      2100,-1, '{11}',                       'actividades'),
    ('TRANSVIA · autocar del campamento',               'Actividades 25-26',                'Transvia',                       780,-1, '{11}',                       'actividades');

  -- Escala por delegación: las tres cuentan la misma historia con tamaños
  -- distintos, para que al cambiar de delegación se vea que cambian los datos.
  create temporary table tmp_dele (delegacion_id uuid, escala numeric, semilla text) on commit drop;
  insert into tmp_dele values (v_ny, 1.00, 'ny'), (v_pr, 0.82, 'pr'), (v_nd, 0.61, 'nd');

  insert into movimiento (cuenta_id, delegacion_id, fecha, concepto, importe, categoria_id, contacto_id, creado_por, notas)
  select
    cta.id,
    d.delegacion_id,
    -- Día del mes: 1..27, estable para cada (concepto, mes, delegación).
    (date '2025-09-01' + ((m - 1) * interval '1 month'))::date
      + (('x' || substr(md5(p.concepto || m::text || d.semilla || 'dia'), 1, 8))::bit(32)::bigint % 27)::int,
    p.concepto,
    -- Importe: base × escala, con una variación estable de ±11 %.
    p.signo * round(
      p.base * d.escala
        * (1 + ((('x' || substr(md5(p.concepto || m::text || d.semilla), 1, 8))::bit(32)::bigint % 221) - 110) / 1000.0),
      2),
    k.id,
    prov.id,
    v_autor,
    null
  from tmp_dele d
  cross join tmp_plantilla p
  cross join unnest(p.meses) as m
  join categoria k
    on k.nombre = p.categoria
   and (k.es_global or k.delegacion_id = d.delegacion_id)
  left join contacto prov
    on prov.nombre = p.proveedor
   and prov.es_global
  join cuenta cta
    on cta.delegacion_id = d.delegacion_id
   and cta.nombre = case p.cuenta
                      when 'caja' then 'Caja en efectivo'
                      when 'actividades' then (
                        select c2.nombre from cuenta c2
                        where c2.delegacion_id = d.delegacion_id
                          and c2.nombre <> 'Caja en efectivo'
                          and c2.nombre like '%actividades%'
                        limit 1
                      )
                      else 'Sabadell · Cuenta delegación'
                    end;

  raise notice 'Movimientos demo insertados: %', (
    select count(*) from movimiento where delegacion_id in (v_ny, v_pr, v_nd)
  );
end $$;

-- ====================================================================
-- 6. Traspasos internos, facturas, pagos MCM y avisos
-- ====================================================================
-- La cuenta de actividades no se financia sola: recibe la aportación de las
-- familias, pero paga la casa y los dos autocares. Sin el traspaso desde la
-- cuenta de la delegación cerraba en rojo, que en una demo se lee como un
-- error de la aplicación y no como lo que es.

do $$
declare
  v_autor uuid;
  v_admin uuid;
  d record;
  v_cta_banco uuid;
  v_cta_act uuid;
  v_cat_otros uuid;
  v_mov_camp uuid;
  v_mov_copi uuid;
  v_mov_dietas uuid;
  v_fact uuid;
  v_tesorera uuid;
  v_importe numeric;
begin
  select id into v_autor from auth.users where email = 'demo@demo.com';
  select id into v_admin from auth.users where email = 'admin@movimientoconsolacion.com';
  v_autor := coalesce(v_autor, v_admin);
  select id into v_cat_otros from categoria where nombre = 'Otros' and es_global;

  for d in select id, nombre, case nombre when '-T MCM Nueva Yorki' then 1.00
                                          when '-T MCM Puerto Rico' then 0.82
                                          else 0.61 end as escala
           from delegacion where nombre like '-T %' order by nombre
  loop
    select id into v_cta_banco from cuenta where delegacion_id = d.id and nombre = 'Sabadell · Cuenta delegación';
    select id into v_cta_act   from cuenta where delegacion_id = d.id and nombre like '%actividades%';
    select id into v_tesorera  from contacto
      where delegacion_id = d.id and tipo = 'persona_mcm' and notas like 'Tesorera%' limit 1;

    insert into movimiento (cuenta_id, delegacion_id, fecha, concepto, importe, categoria_id, creado_por, notas)
    values
      (v_cta_banco, d.id, '2026-06-05', 'Traspaso a la cuenta de actividades',
       -round(3200 * d.escala, 2), v_cat_otros, v_autor,
       'Contrapartida del ingreso en la cuenta de actividades'),
      (v_cta_act,   d.id, '2026-06-05', 'Traspaso desde la cuenta de delegación',
       round(3200 * d.escala, 2), v_cat_otros, v_autor,
       'Contrapartida del cargo en la cuenta de delegación');

    select id into v_mov_camp   from movimiento where delegacion_id = d.id and concepto like 'CASA DON BOSCO%' limit 1;
    select id into v_mov_copi   from movimiento where delegacion_id = d.id and concepto like 'COPIGRAF%' order by fecha limit 1;
    select id into v_mov_dietas from movimiento where delegacion_id = d.id and concepto like 'Reunión de tesoreros%' order by fecha desc limit 1;

    -- Facturas: dos recién caídas en la bandeja (una por correo, con su
    -- sugerencia de la IA sin aplicar), una confirmada y sin pagar, y dos ya
    -- pagadas. El estado de las pagadas NO se escribe a mano: lo pone el
    -- trigger al vincular el movimiento, que es como pasa en la aplicación.
    insert into factura (delegacion_id, contacto_id, concepto, numero, fecha_emision, importe,
                         estado, origen, email_remitente, datos_ia, creado_por)
    values (d.id,
      (select id from contacto where nombre = 'Copigraf' and es_global),
      'Impresión de los cuadernillos del curso', 'F-2026/1187', '2026-08-26', 132.50,
      'bandeja', 'email', 'facturacion@copigraf.es',
      jsonb_build_object(
        'numero', 'F-2026/1187', 'fecha_emision', '2026-08-26', 'importe', 132.50,
        'concepto', 'Impresión de los cuadernillos del curso',
        'proveedor_nombre', 'Copigraf', 'proveedor_nif', 'B12355483',
        'categoria_sugerida', 'Compras Material', 'confianza', 'alta'),
      v_autor);

    insert into factura (delegacion_id, concepto, fecha_emision, importe, estado, origen, creado_por, notas)
    values (d.id, 'Ticket de la ferretería (pendiente de identificar)', '2026-08-30', 41.75,
            'bandeja', 'subida', v_autor,
            'La foto está torcida, hay que comprobar el proveedor a mano');

    insert into factura (delegacion_id, contacto_id, concepto, numero, fecha_emision, importe, estado, origen, creado_por)
    values (d.id,
      (select id from contacto where nombre = 'Transvia' and es_global),
      'Autocar de vuelta del campamento', 'A-2026/0418', '2026-08-20',
      round(310 * d.escala, 2), 'sin_pagar', 'subida', v_autor);

    if v_mov_camp is not null then
      select abs(importe) into v_importe from movimiento where id = v_mov_camp;
      insert into factura (delegacion_id, contacto_id, concepto, numero, fecha_emision, importe,
                           estado, origen, categoria_id, creado_por)
      values (d.id,
        (select id from contacto where nombre = 'Casa Don Bosco Godelleta' and es_global),
        'Estancia del campamento de verano', 'FRA-26/0902', '2026-07-15', v_importe,
        'sin_pagar', 'subida',
        (select id from categoria where nombre = 'Actividades 25-26' and es_global), v_autor)
      returning id into v_fact;
      update movimiento set factura_id = v_fact where id = v_mov_camp;
    end if;

    if v_mov_copi is not null then
      select abs(importe) into v_importe from movimiento where id = v_mov_copi;
      insert into factura (delegacion_id, contacto_id, concepto, numero, fecha_emision, importe,
                           estado, origen, categoria_id, creado_por)
      values (d.id,
        (select id from contacto where nombre = 'Copigraf' and es_global),
        'Fotocopias y cuadernillos de inicio de curso', 'F-2025/0914', '2025-09-14', v_importe,
        'sin_pagar', 'movimiento',
        (select id from categoria where nombre = 'Compras Material' and es_global), v_autor)
      returning id into v_fact;
      update movimiento set factura_id = v_fact where id = v_mov_copi;
    end if;

    -- Un movimiento marcado a mano como «falta factura»: es el caso que
    -- justifica que la marca exista, y se apaga sola si se vincula una.
    update movimiento set factura_pendiente = true
    where delegacion_id = d.id and concepto like 'MAYPELL%';

    insert into pago_mcm (delegacion_id, contacto_id, concepto, importe, estado, tipo_calculo,
                          gasolina_km_un_trayecto, gasolina_ida_vuelta, gasolina_precio_km,
                          gasolina_preset, categoria_id_sugerida, creado_por, notas)
    values (d.id, v_tesorera, 'Viaje a la reunión de tesoreros de zona',
            round(2 * 118 * 0.26, 2), 'pendiente', 'gasolina_km', 118, true, 0.26, 'estandar_0_26',
            (select id from categoria where nombre = 'Comidas, dietas, viajes y eventos' and es_global),
            v_autor, 'Pendiente de pagar en la próxima transferencia');

    insert into pago_mcm (delegacion_id, contacto_id, concepto, importe, estado, tipo_calculo,
                          categoria_id_sugerida, movimiento_id, creado_por)
    values (d.id, v_tesorera, 'Compra de material adelantada por la tesorera',
            round(46 * d.escala, 2), 'pagado', 'manual',
            (select id from categoria where nombre = 'Compras Material' and es_global),
            v_mov_dietas, v_autor);

    -- Avisos en los dos sentidos, porque las pestañas del panel se filtran por
    -- el destinatario y con avisos de un solo lado la mitad sale vacía.
    insert into aviso (delegacion_id, tipo, contenido, referencia, destinatario, estado,
                       creado_por, responsable_id, fecha_limite, urgente, creado_en)
    values
      (d.id, 'nota', 'Ya podéis cerrar el curso 25-26. Cuando tengáis todas las facturas subidas avisadnos y revisamos el cuadre antes de dar el visto bueno.',
       'Cierre 25-26', 'delegacion', 'pendiente', v_admin, null, null, false, now() - interval '3 days'),
      (d.id, 'tarea', 'Faltan las facturas del autocar del campamento. ¿Podéis subirlas a la bandeja de facturas?',
       'Campamento', 'delegacion', 'pendiente', v_admin, v_autor, (current_date + 7), true, now() - interval '1 day'),
      (d.id, 'tarea', 'Revisad que el IBAN de la cuenta de actividades esté bien escrito en la ficha de la cuenta.',
       'Cuentas', 'delegacion', 'hecha', v_admin, v_autor, null, false, now() - interval '20 days'),
      (d.id, 'tarea', '¿Nos podéis confirmar cómo hay que categorizar el segundo pago de la subvención del IVAJ? No sabemos si va al curso que cierra o al que empieza.',
       'IVAJ Bloque 2', 'oficina_tecnica', 'pendiente', v_autor, null, null, false, now() - interval '2 days'),
      (d.id, 'nota', 'Hemos cambiado de tesorera este curso. La nueva ya tiene acceso a la aplicación.',
       null, 'oficina_tecnica', 'hecha', v_autor, null, null, false, now() - interval '45 days');

    update aviso set completado_por = v_autor, completado_en = creado_en + interval '2 days'
    where delegacion_id = d.id and estado = 'hecha';

    -- Las dos más recientes se quedan sin leer: un contador de avisos a cero
    -- no enseña para qué sirve el contador.
    insert into aviso_lectura (aviso_id, usuario_id)
    select a.id, v_autor from aviso a
    where a.delegacion_id = d.id and a.creado_en < now() - interval '10 days'
    on conflict do nothing;
  end loop;
end $$;

-- ====================================================================
-- 7. Sobrescrituras por delegación de los proveedores globales
-- ====================================================================
-- Los proveedores son fichas de toda la organización, pero la categoría
-- predeterminada y el alias son de cada delegación: viven en
-- contacto_delegacion. Las filas de adopción las ha creado ya el trigger
-- contacto_adoptar_al_vincular al vincular los movimientos.

update contacto_delegacion cd
set categoria_id_predeterminada = (select id from categoria where nombre = k.cat and es_global),
    alias = k.alias,
    notas = k.notas
from delegacion d, (values
  ('Mercadona',                'Comidas, dietas, viajes y eventos', null,                  'Compramos aquí las meriendas de los sábados'),
  ('Consum',                   'Comidas, dietas, viajes y eventos', null,                  null),
  ('Amazon',                   'Compras Material',                  null,                  'Pedidos con la cuenta de la delegación'),
  ('Copigraf',                 'Compras Material',                  'Copigraf (imprenta)', 'Nos hacen los cuadernillos del curso'),
  ('Rutas Rodriguez',          'Actividades 25-26',                 'Autocares Rutas',     null),
  ('Transvia',                 'Actividades 25-26',                 null,                  null),
  ('Casa Don Bosco Godelleta', 'Actividades 25-26',                 'Casa de Godelleta',   'Es donde hacemos el campamento de verano'),
  ('Chinos varios',            'Compras Material',                  null,                  null)
) as k(prov, cat, alias, notas),
contacto c
where c.nombre = k.prov and c.es_global
  and cd.contacto_id = c.id and cd.delegacion_id = d.id and d.nombre like '-T %';
