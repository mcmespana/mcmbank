-- Script para eliminar las tablas de documentos antiguas (sin usar)
-- Ejecutar después de confirmar que no se usan y están vacías

-- Verificar que las tablas están vacías antes de eliminar
DO $$ 
DECLARE 
  doc_count INTEGER;
  mov_doc_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO doc_count FROM documento;
  SELECT COUNT(*) INTO mov_doc_count FROM movimiento_documento;
  
  IF doc_count > 0 OR mov_doc_count > 0 THEN
    RAISE EXCEPTION 'Las tablas contienen datos. No se pueden eliminar de forma segura.';
  END IF;
  
  RAISE NOTICE 'Las tablas están vacías. Procediendo con la eliminación...';
END $$;

-- Eliminar la tabla pivot primero (tiene foreign keys)
DROP TABLE IF EXISTS movimiento_documento;

-- Eliminar la tabla documento
DROP TABLE IF EXISTS documento;

-- Mensaje de confirmación
DO $$ 
BEGIN
  RAISE NOTICE 'Tablas documento y movimiento_documento eliminadas exitosamente.';
  RAISE NOTICE 'El nuevo sistema usa la tabla movimiento_archivo.';
END $$;
