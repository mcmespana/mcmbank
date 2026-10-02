-- 075: color del código de una subvención, elegido a mano.
--
-- Sin color (NULL) se pinta con las reglas de colorCodigo() en
-- lib/utils/subvenciones.ts (GVA rojo, IVAJ negro, DIP rojo intenso…). Con
-- color, manda el elegido. Es una clave de la paleta de la app, no un hex:
-- así el modo oscuro y el contraste los resuelve la app.

alter table public.subvencion
  add column if not exists color text;

alter table public.subvencion
  drop constraint if exists subvencion_color_valido;

alter table public.subvencion
  add constraint subvencion_color_valido check (
    color is null or color in (
      'rojo', 'rojo_intenso', 'rosa', 'naranja', 'ambar', 'amarillo', 'lima',
      'verde', 'turquesa', 'azul', 'indigo', 'violeta', 'negro', 'gris'
    )
  );

comment on column public.subvencion.color is
  'Color del código en la interfaz (clave de la paleta). NULL = el que toque por reglas.';
