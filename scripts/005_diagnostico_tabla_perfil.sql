-- SCRIPT DE DIAGNÓSTICO - Verifica el estado actual de la tabla perfil
-- Ejecuta esto para entender qué está pasando

-- 1. Verificar si la tabla existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'perfil'
) as tabla_perfil_existe;

-- 2. Ver la estructura de la tabla si existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'perfil' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Ver cuántos perfiles existen
SELECT COUNT(*) as total_perfiles FROM public.perfil;

-- 4. Ver perfiles existentes (primeros 5)
SELECT usuario_id, nombre_completo, creado_en 
FROM public.perfil 
ORDER BY creado_en DESC 
LIMIT 5;

-- 5. Verificar si existe perfil para el usuario específico
-- Reemplaza 'admin@movimientoconsolacion.com' con tu email si es diferente
SELECT 
  u.email,
  u.id as usuario_id,
  CASE WHEN p.usuario_id IS NOT NULL THEN 'SÍ' ELSE 'NO' END as tiene_perfil
FROM auth.users u
LEFT JOIN public.perfil p ON u.id = p.usuario_id
WHERE u.email = 'admin@movimientoconsolacion.com';

-- 6. Ver las políticas RLS actuales
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'perfil';

-- 7. Verificar si RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'perfil';

-- 8. Ver triggers existentes
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users' AND trigger_schema = 'auth';
