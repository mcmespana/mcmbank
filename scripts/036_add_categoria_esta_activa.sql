alter table public.categoria
  add column if not exists esta_activa boolean not null default true;

update public.categoria
  set esta_activa = true
  where esta_activa is null;
