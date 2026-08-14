-- 060_contacto_logo.sql
--
-- Logos de proveedores.
--
-- El logo se guarda SIEMPRE en nuestro Storage (bucket `logos`), nunca como un
-- enlace a un servicio de terceros: así no depende de que unavatar/DuckDuckGo/
-- Google sigan vivos, no se pide un favicon externo cada vez que alguien abre
-- Movimientos, y el navegador lo cachea como cualquier otro asset nuestro.
--
-- `logo_fuente` distingue de dónde salió, y eso tiene una consecuencia de
-- comportamiento: el proceso automático NUNCA sobrescribe un logo 'manual'.
-- Si alguien se ha molestado en subir el bueno, no se lo pisa un favicon.

alter table public.contacto
  add column if not exists dominio             text,
  add column if not exists logo_url            text,
  add column if not exists logo_fuente         text,
  add column if not exists logo_actualizado_en timestamptz;

alter table public.contacto
  drop constraint if exists contacto_logo_fuente_check;

alter table public.contacto
  add constraint contacto_logo_fuente_check
  check (logo_fuente is null or logo_fuente in ('auto', 'manual', 'semilla'));

comment on column public.contacto.dominio is
  'Dominio web del proveedor (mercadona.es). Semilla para buscar el logo.';
comment on column public.contacto.logo_url is
  'URL pública del logo en el bucket `logos`. Nunca un enlace externo.';
comment on column public.contacto.logo_fuente is
  'auto = descargado de la web del proveedor; manual = subido por una persona (el automático no lo sobrescribe); semilla = del catálogo inicial.';

-- Bucket público: un logo de proveedor no es información sensible y servirlo
-- público evita firmar una URL por cada avatar de cada fila de la lista.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  1048576, -- 1 MB: un favicon o un PNG de 256px no llega ni de lejos
  array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lectura para cualquiera (el bucket es público) y escritura solo para quien
-- ha iniciado sesión: los logos los resuelve el servidor con el service role,
-- pero la subida manual la hace el navegador de un tesorero.
drop policy if exists "Logos visibles para todos" on storage.objects;
create policy "Logos visibles para todos"
  on storage.objects for select
  using (bucket_id = 'logos');

drop policy if exists "Usuarios autenticados suben logos" on storage.objects;
create policy "Usuarios autenticados suben logos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'logos');

drop policy if exists "Usuarios autenticados actualizan logos" on storage.objects;
create policy "Usuarios autenticados actualizan logos"
  on storage.objects for update to authenticated
  using (bucket_id = 'logos');

drop policy if exists "Usuarios autenticados borran logos" on storage.objects;
create policy "Usuarios autenticados borran logos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'logos');
