-- Create profiles table to link Supabase Auth users with your app data
CREATE TABLE IF NOT EXISTS public.perfil (
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre_completo TEXT,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.perfil ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read and update their own profile
CREATE POLICY "Users can view own profile" ON public.perfil
  FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "Users can update own profile" ON public.perfil
  FOR UPDATE USING (auth.uid() = usuario_id);

-- Create policy to allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON public.perfil
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfil (usuario_id, nombre_completo)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call the function when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
