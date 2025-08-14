-- Ensure the profile trigger works correctly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfil (usuario_id, nombre_completo)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger to ensure it's active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create profile for existing user if not exists
INSERT INTO public.perfil (usuario_id, nombre_completo)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
FROM auth.users 
WHERE email = 'admin@movimientoconsolacion.com'
ON CONFLICT (usuario_id) DO NOTHING;
