-- =============================================================================
-- 058: OAuth 2.1 para el servidor MCP (conectores de claude.ai)
-- =============================================================================
-- Los conectores personalizados de claude.ai no permiten pegar una cabecera con
-- una clave de API: negocian el acceso por OAuth. Para que MCM Bank se pueda
-- añadir desde la web hay que ser, además de servidor MCP, un servidor de
-- autorización OAuth 2.1 con registro dinámico de clientes (RFC 7591) y PKCE.
--
-- El premio va más allá de la web: en vez de una clave compartida por toda la
-- oficina técnica, cada persona entra con SU cuenta de MCM Bank (el mismo login
-- de Supabase de siempre). Así las notas y facturas que cree el asistente salen
-- firmadas por quien está al otro lado, sin depender de MCM_API_USER_EMAIL.
--
-- Tres tablas, todas efímeras salvo el registro de clientes:
--   - mcp_oauth_cliente  : quién puede pedir acceso (lo crea el propio Claude)
--   - mcp_oauth_codigo   : códigos de autorización, de un solo uso y 5 minutos
--   - mcp_oauth_token    : tokens de acceso y de refresco vivos
--
-- Nunca se guarda un secreto en claro: de códigos y tokens solo se guarda su
-- SHA-256, igual que se haría con una contraseña. Quien lea la base de datos no
-- puede suplantar a nadie.
--
-- RLS activada y SIN políticas a propósito: estas tablas solo se tocan desde el
-- servidor con la service role key. Ningún usuario autenticado tiene por qué
-- leer tokens, ni los suyos.

-- -----------------------------------------------------------------------------
-- Clientes registrados dinámicamente (RFC 7591)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mcp_oauth_cliente (
    client_id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    -- Coincidencia EXACTA obligatoria al autorizar: es lo único que impide que
    -- un cliente malicioso se lleve el código a otro dominio.
    redirect_uris TEXT[] NOT NULL CHECK (array_length(redirect_uris, 1) >= 1),
    -- Metadatos tal cual los envió el cliente, por si hay que depurar.
    metadata JSONB,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    ultimo_uso_en TIMESTAMPTZ
);

COMMENT ON TABLE public.mcp_oauth_cliente IS
    'Aplicaciones que pueden pedir acceso al servidor MCP. Se registran solas (RFC 7591): normalmente hay una fila por cada cliente de Claude que se conecta.';

-- -----------------------------------------------------------------------------
-- Códigos de autorización (un solo uso, 5 minutos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mcp_oauth_codigo (
    codigo_hash TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES public.mcp_oauth_cliente(client_id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL,
    redirect_uri TEXT NOT NULL,
    -- PKCE obligatorio y solo S256: sin secreto de cliente, es lo que ata el
    -- código a quien lo pidió.
    code_challenge TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL DEFAULT 'S256' CHECK (code_challenge_method = 'S256'),
    scope TEXT NOT NULL,
    -- RFC 8707: para qué servidor se pidió el token. Evita que un token emitido
    -- para otro recurso valga aquí.
    resource TEXT,
    expira_en TIMESTAMPTZ NOT NULL,
    usado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codigo_expira
    ON public.mcp_oauth_codigo(expira_en);

COMMENT ON TABLE public.mcp_oauth_codigo IS
    'Códigos de autorización OAuth, de un solo uso. Se guarda el SHA-256, nunca el código.';

-- -----------------------------------------------------------------------------
-- Tokens de acceso y de refresco
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mcp_oauth_token (
    token_hash TEXT PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('access', 'refresh')),
    client_id TEXT NOT NULL REFERENCES public.mcp_oauth_cliente(client_id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL,
    scope TEXT NOT NULL,
    resource TEXT,
    expira_en TIMESTAMPTZ NOT NULL,
    revocado_en TIMESTAMPTZ,
    ultimo_uso_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_token_usuario
    ON public.mcp_oauth_token(usuario_id, tipo)
    WHERE revocado_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_token_expira
    ON public.mcp_oauth_token(expira_en);

COMMENT ON TABLE public.mcp_oauth_token IS
    'Tokens vivos del servidor MCP. Se guarda el SHA-256, nunca el token. Revocar = poner revocado_en.';

-- -----------------------------------------------------------------------------
-- RLS: cerrada del todo. Solo la service role key (que la salta) entra aquí.
-- -----------------------------------------------------------------------------
ALTER TABLE public.mcp_oauth_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_codigo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_token ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.mcp_oauth_cliente FROM anon, authenticated;
REVOKE ALL ON public.mcp_oauth_codigo FROM anon, authenticated;
REVOKE ALL ON public.mcp_oauth_token FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- Limpieza de lo caducado
-- -----------------------------------------------------------------------------
-- Los códigos duran 5 minutos y los tokens de refresco 30 días: sin limpiar,
-- las tablas crecerían para siempre con basura inútil. Se llama desde el propio
-- endpoint de token (cuesta milisegundos) para no depender de un cron.
CREATE OR REPLACE FUNCTION public.limpiar_mcp_oauth_caducado()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM public.mcp_oauth_codigo
     WHERE expira_en < timezone('utc', now()) - INTERVAL '1 day';

    DELETE FROM public.mcp_oauth_token
     WHERE expira_en < timezone('utc', now()) - INTERVAL '7 days';
END;
$$;

REVOKE ALL ON FUNCTION public.limpiar_mcp_oauth_caducado() FROM PUBLIC, anon, authenticated;
