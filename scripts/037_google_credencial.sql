-- ============================================================
-- 037_google_credencial: credenciales OAuth de Google por usuario
--   Aplicada vía MCP Supabase (apply_migration "037_google_credencial").
-- ============================================================

CREATE TABLE IF NOT EXISTS public.google_credencial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL UNIQUE,
  email text,
  refresh_token_cifrado text NOT NULL,
  scope text,
  token_expiry timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_google_credencial_actualizado_en()
RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_google_credencial_actualizado ON public.google_credencial;
CREATE TRIGGER trg_google_credencial_actualizado
  BEFORE UPDATE ON public.google_credencial
  FOR EACH ROW EXECUTE FUNCTION public.set_google_credencial_actualizado_en();

ALTER TABLE public.google_credencial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_credencial_own_select" ON public.google_credencial;
CREATE POLICY "google_credencial_own_select" ON public.google_credencial
  FOR SELECT USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "google_credencial_own_insert" ON public.google_credencial;
CREATE POLICY "google_credencial_own_insert" ON public.google_credencial
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "google_credencial_own_update" ON public.google_credencial;
CREATE POLICY "google_credencial_own_update" ON public.google_credencial
  FOR UPDATE USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "google_credencial_own_delete" ON public.google_credencial;
CREATE POLICY "google_credencial_own_delete" ON public.google_credencial
  FOR DELETE USING (auth.uid() = usuario_id);
