-- ============================================================
-- 036_informes: Sección Informes (almacén + memorias económicas)
--   Aplicada vía MCP Supabase (apply_migration "036_informes").
--   Se conserva aquí para histórico del repo.
-- ============================================================

-- Columna para configurar la plantilla de Google Sheets de la memoria económica
ALTER TABLE public.organizacion
  ADD COLUMN IF NOT EXISTS plantilla_memoria_sheet_id text;

-- ---------- Tabla informe ----------
CREATE TABLE IF NOT EXISTS public.informe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegacion_id uuid NOT NULL REFERENCES public.delegacion(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'anual' CHECK (tipo IN ('anual','actividad')),
  periodicidad text NOT NULL DEFAULT 'anual' CHECK (periodicidad IN ('anual','semestral','trimestral')),
  periodo_tipo text NOT NULL DEFAULT 'curso' CHECK (periodo_tipo IN ('curso','natural')),
  anio int NOT NULL,
  curso_label text,
  sub_periodo text,
  titulo text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_desarrollo','hecho','revisado','aprobado')),
  origen text NOT NULL DEFAULT 'subido' CHECK (origen IN ('subido','generado')),
  drive_url text,
  drive_file_id text,
  notas text,
  config_generacion jsonb,
  es_borrador boolean NOT NULL DEFAULT false,
  creado_por uuid,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_informe_delegacion ON public.informe(delegacion_id);
CREATE INDEX IF NOT EXISTS idx_informe_delegacion_anio ON public.informe(delegacion_id, anio);

-- mantener actualizado_en
CREATE OR REPLACE FUNCTION public.set_informe_actualizado_en()
RETURNS trigger LANGUAGE plpgsql
SET search_path = '' AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_informe_actualizado ON public.informe;
CREATE TRIGGER trg_informe_actualizado
  BEFORE UPDATE ON public.informe
  FOR EACH ROW EXECUTE FUNCTION public.set_informe_actualizado_en();

-- ---------- Tabla informe_archivo ----------
CREATE TABLE IF NOT EXISTS public.informe_archivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  informe_id uuid NOT NULL REFERENCES public.informe(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  es_pdf_principal boolean NOT NULL DEFAULT false,
  drive_url text,
  creado_por uuid,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_informe_archivo_informe ON public.informe_archivo(informe_id);

-- ---------- RLS informe ----------
ALTER TABLE public.informe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "informe_select_members" ON public.informe;
CREATE POLICY "informe_select_members" ON public.informe
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.membresia mb
      WHERE mb.delegacion_id = informe.delegacion_id
        AND mb.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "informe_insert_writers" ON public.informe;
CREATE POLICY "informe_insert_writers" ON public.informe
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.membresia mb
      WHERE mb.delegacion_id = informe.delegacion_id
        AND mb.usuario_id = auth.uid()
        AND mb.rol IN ('tesorero','gestor_central')
    )
  );

DROP POLICY IF EXISTS "informe_update_writers" ON public.informe;
CREATE POLICY "informe_update_writers" ON public.informe
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.membresia mb
      WHERE mb.delegacion_id = informe.delegacion_id
        AND mb.usuario_id = auth.uid()
        AND mb.rol IN ('tesorero','gestor_central')
    )
  );

DROP POLICY IF EXISTS "informe_delete_writers" ON public.informe;
CREATE POLICY "informe_delete_writers" ON public.informe
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.membresia mb
      WHERE mb.delegacion_id = informe.delegacion_id
        AND mb.usuario_id = auth.uid()
        AND mb.rol IN ('tesorero','gestor_central')
    )
  );

-- ---------- RLS informe_archivo ----------
ALTER TABLE public.informe_archivo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "informe_archivo_select_members" ON public.informe_archivo;
CREATE POLICY "informe_archivo_select_members" ON public.informe_archivo
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.informe i
      JOIN public.membresia mb ON mb.delegacion_id = i.delegacion_id
      WHERE i.id = informe_archivo.informe_id
        AND mb.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "informe_archivo_insert_writers" ON public.informe_archivo;
CREATE POLICY "informe_archivo_insert_writers" ON public.informe_archivo
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.informe i
      JOIN public.membresia mb ON mb.delegacion_id = i.delegacion_id
      WHERE i.id = informe_archivo.informe_id
        AND mb.usuario_id = auth.uid()
        AND mb.rol IN ('tesorero','gestor_central')
    )
  );

DROP POLICY IF EXISTS "informe_archivo_delete_writers" ON public.informe_archivo;
CREATE POLICY "informe_archivo_delete_writers" ON public.informe_archivo
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.informe i
      JOIN public.membresia mb ON mb.delegacion_id = i.delegacion_id
      WHERE i.id = informe_archivo.informe_id
        AND mb.usuario_id = auth.uid()
        AND mb.rol IN ('tesorero','gestor_central')
    )
  );

-- ---------- Storage bucket 'informes' (privado) ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('informes', 'informes', false)
ON CONFLICT (id) DO NOTHING;

-- path: {delegacion_id}/{informe_id}/{filename}  -> foldername[1] = delegacion_id
DROP POLICY IF EXISTS "informes_obj_select_members" ON storage.objects;
CREATE POLICY "informes_obj_select_members" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'informes'
    AND EXISTS (
      SELECT 1 FROM public.membresia mb
      WHERE mb.usuario_id = auth.uid()
        AND mb.delegacion_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "informes_obj_insert_writers" ON storage.objects;
CREATE POLICY "informes_obj_insert_writers" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'informes'
    AND EXISTS (
      SELECT 1 FROM public.membresia mb
      WHERE mb.usuario_id = auth.uid()
        AND mb.delegacion_id::text = (storage.foldername(name))[1]
        AND mb.rol IN ('tesorero','gestor_central')
    )
  );

DROP POLICY IF EXISTS "informes_obj_delete_writers" ON storage.objects;
CREATE POLICY "informes_obj_delete_writers" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'informes'
    AND EXISTS (
      SELECT 1 FROM public.membresia mb
      WHERE mb.usuario_id = auth.uid()
        AND mb.delegacion_id::text = (storage.foldername(name))[1]
        AND mb.rol IN ('tesorero','gestor_central')
    )
  );
