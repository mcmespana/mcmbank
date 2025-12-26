-- Enable Banking integration schema (MCM Bank)
-- Run this script manually in Supabase SQL editor.

create table if not exists public.enablebanking_consent (
  id uuid primary key default uuid_generate_v4(),
  organizacion_id uuid not null references public.organizacion(id),
  aspsp_name text not null,
  aspsp_country text not null,
  aspsp_bic text,
  psu_type text not null,
  authorization_id uuid not null,
  state text not null,
  redirect_url text not null,
  status text not null default 'pending',
  session_id uuid,
  authorized_at timestamp with time zone,
  error_code text,
  error_description text,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists enablebanking_consent_authorization_id_idx
  on public.enablebanking_consent (authorization_id);

create table if not exists public.enablebanking_account (
  id uuid primary key default uuid_generate_v4(),
  consent_id uuid not null references public.enablebanking_consent(id) on delete cascade,
  provider_account_id text not null,
  identification_hash text,
  iban text,
  currency text,
  owner_name text,
  raw_payload jsonb,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists enablebanking_account_provider_account_id_idx
  on public.enablebanking_account (provider_account_id);

create table if not exists public.enablebanking_link (
  id uuid primary key default uuid_generate_v4(),
  cuenta_id uuid not null references public.cuenta(id) on delete cascade,
  enablebanking_account_id uuid not null references public.enablebanking_account(id) on delete cascade,
  status text not null default 'active',
  sync_start_date date,
  last_sync_at timestamp with time zone,
  last_sync_from date,
  last_sync_to date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists enablebanking_link_cuenta_id_idx
  on public.enablebanking_link (cuenta_id);

create unique index if not exists enablebanking_link_account_id_idx
  on public.enablebanking_link (enablebanking_account_id);

alter table public.movimiento
  add column if not exists source text,
  add column if not exists external_id text,
  add column if not exists external_raw jsonb;

create unique index if not exists movimiento_enablebanking_external_id_idx
  on public.movimiento (cuenta_id, external_id)
  where source = 'enablebanking';
