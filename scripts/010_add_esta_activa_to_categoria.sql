-- Añade un flag para poder ocultar categorías sin eliminarlas
DO
$$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'categoria'
      AND column_name = 'esta_activa'
  ) THEN
    ALTER TABLE public.categoria
      ADD COLUMN esta_activa boolean NOT NULL DEFAULT true;
  END IF;

  UPDATE public.categoria
  SET esta_activa = true
  WHERE esta_activa IS NULL;
END;
$$;
