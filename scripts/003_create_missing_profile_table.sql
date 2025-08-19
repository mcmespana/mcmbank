-- Create the missing perfil table
CREATE TABLE IF NOT EXISTS public.perfil (
  usuario_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.perfil ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to access only their own profile
CREATE POLICY "Users can view own profile" ON public.perfil
  FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "Users can update own profile" ON public.perfil
  FOR UPDATE USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert own profile" ON public.perfil
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Create or replace the trigger function
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

-- Create trigger to automatically create profile for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create profile for existing users if they don't have one
INSERT INTO public.perfil (usuario_id, nombre_completo)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
FROM auth.users
WHERE id NOT IN (SELECT usuario_id FROM public.perfil)
ON CONFLICT (usuario_id) DO NOTHING;
