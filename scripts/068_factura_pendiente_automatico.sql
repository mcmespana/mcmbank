-- 068 — "Falta factura" se apaga solo cuando llega la factura
--
-- `movimiento.factura_pendiente` es una marca manual: "de este cargo no me ha
-- llegado el papel". Cuando el papel llega y se vincula, la marca se queda
-- encendida y el movimiento sigue saliendo en el filtro de pendientes, así que
-- hay que acordarse de apagarla a mano. Nadie se acuerda.
--
-- Va en la base de datos y no en la web porque hay cuatro caminos que vinculan
-- una factura a un movimiento: la pantalla de facturas, la API externa, el MCP
-- y la conciliación automática del correo entrante. Una regla repetida en
-- cuatro sitios es una regla que se olvida en el quinto.
--
-- Solo apaga; nunca enciende. Que un movimiento necesite factura es un juicio
-- de quien lleva las cuentas, y desvincular una factura no significa que se
-- espere otra.

create or replace function mcm_factura_pendiente_al_vincular()
returns trigger
language plpgsql
as $$
begin
  if new.factura_id is not null
     and new.factura_id is distinct from old.factura_id
     and new.factura_pendiente then
    new.factura_pendiente := false;
  end if;
  return new;
end;
$$;

comment on function mcm_factura_pendiente_al_vincular() is
  'Apaga movimiento.factura_pendiente cuando se le vincula una factura. Solo apaga, nunca enciende.';

drop trigger if exists factura_pendiente_al_vincular on movimiento;

create trigger factura_pendiente_al_vincular
  before update of factura_id on movimiento
  for each row
  execute function mcm_factura_pendiente_al_vincular();

-- Limpieza de lo que ya está mal: movimientos con factura vinculada que siguen
-- marcados como pendientes. La marca y el vínculo se contradicen y gana el
-- vínculo, que es un hecho y no una intención.
update movimiento
   set factura_pendiente = false
 where factura_id is not null
   and factura_pendiente;
