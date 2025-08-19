-- SAFE VERSION: Create or fix the perfil table without errors
-- This script handles cases where parts already exist

-- Create the perfil table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.perfil (
  usuario_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (won't error if already enabled)
ALTER TABLE public.perfil ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DROP POLICY IF EXISTS "Users can view own profile" ON public.perfil;
DROP POLICY IF EXISTS "Users can update own profile" ON public.perfil;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.perfil;

-- Create policies
CREATE POLICY "Users can view own profile" ON public.perfil
  FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "Users can update own profile" ON public.perfil
  FOR UPDATE USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert own profile" ON public.perfil
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Create or replace the trigger function (safe operation)
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

-- Recreate trigger (safe operation)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create profiles for existing users who don't have one
-- This won't create duplicates due to ON CONFLICT
INSERT INTO public.perfil (usuario_id, nombre_completo)
SELECT 
  au.id, 
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1))
FROM auth.users au
LEFT JOIN public.perfil p ON p.usuario_id = au.id
WHERE p.usuario_id IS NULL
ON CONFLICT (usuario_id) DO NOTHING;

-- Verification query to confirm everything is working
-- Uncomment the next line if you want to see the results
-- SELECT 'Profile table setup completed successfully' as status;
