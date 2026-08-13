-- Rediseño del panel de avisos: responsable, fecha límite y prioridad.
--
-- Tres campos opcionales sobre una tarea (nunca sobre una nota):
--   - responsable_id  quién tiene que hacerla. Sin FK a auth.users, igual que
--                      creado_por/completado_por/notificado_por: es una
--                      referencia lógica, resuelta en la app vía perfil.
--   - fecha_limite     fecha (sin hora) antes de la cual debería estar hecha.
--   - urgente          marca visual de prioridad; no cambia el flujo, solo el
--                      orden y el color con el que se ve en el panel.

ALTER TABLE public.aviso
  ADD COLUMN IF NOT EXISTS responsable_id UUID,
  ADD COLUMN IF NOT EXISTS fecha_limite DATE,
  ADD COLUMN IF NOT EXISTS urgente BOOLEAN NOT NULL DEFAULT false;

-- Bandeja "para mí" y vista de calendario: pendientes primero por urgencia y
-- fecha límite, sin tener que traer todo y ordenar en el cliente.
CREATE INDEX IF NOT EXISTS idx_aviso_delegacion_pendiente_urgente
  ON public.aviso(delegacion_id, urgente DESC, fecha_limite)
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_aviso_responsable
  ON public.aviso(responsable_id)
  WHERE responsable_id IS NOT NULL;

COMMENT ON COLUMN public.aviso.responsable_id IS 'Quién tiene que hacer la tarea. Referencia lógica a auth.users, resuelta vía perfil.';
COMMENT ON COLUMN public.aviso.fecha_limite IS 'Fecha (sin hora) antes de la cual debería estar hecha la tarea.';
COMMENT ON COLUMN public.aviso.urgente IS 'Marca de prioridad visual. No cambia el flujo, solo el orden y el color en el panel.';
