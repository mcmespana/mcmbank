-- El ticket que alguien adelantó: la factura es del proveedor, la deuda es con
-- la persona.
--
-- Aniceto paga un ticket del Consum de su bolsillo. Hay dos hechos distintos y
-- hasta ahora la app solo sabía guardar uno de los dos:
--
--   - el papel es una factura del CONSUM, con su fecha, su importe y su NIF;
--   - el dinero se le debe a ANICETO, que es un pago MCM.
--
-- Por eso el vínculo es una columna y no una fusión: `factura.contacto_id`
-- sigue siendo el proveedor y `pago_mcm.contacto_id` sigue siendo la persona.
-- Quien mire la factura verá Consum; quien mire la lista de a quién hay que
-- transferir verá a Aniceto. Meter a Aniceto como contacto de la factura
-- rompería el saldo por proveedor y el emparejamiento por nombre.
--
-- Es N facturas → 1 pago (un reembolso de gasolina puede traer cinco tickets),
-- y ON DELETE SET NULL: borrar el pago no puede llevarse por delante el
-- documento, que vale por sí solo.

ALTER TABLE public.factura
    ADD COLUMN IF NOT EXISTS pago_mcm_id UUID REFERENCES public.pago_mcm(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_factura_pago_mcm
    ON public.factura(pago_mcm_id)
    WHERE pago_mcm_id IS NOT NULL;

-- Nuevo origen: la factura nació al subir el ticket desde un pago MCM.
ALTER TABLE public.factura DROP CONSTRAINT IF EXISTS factura_origen_check;
ALTER TABLE public.factura
    ADD CONSTRAINT factura_origen_check
    CHECK (origen IN ('subida', 'movimiento', 'email', 'pago_mcm'));

COMMENT ON COLUMN public.factura.pago_mcm_id IS
    'Pago MCM que reembolsa esta factura (el ticket lo adelantó una persona). El contacto de la factura sigue siendo el proveedor; el de pago_mcm, la persona a la que se debe el dinero.';
