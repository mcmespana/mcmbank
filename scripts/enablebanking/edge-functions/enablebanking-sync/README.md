# Enable Banking sync (Edge Function)

Este directorio contiene una Edge Function de ejemplo para sincronizar movimientos desde Enable Banking.

## Variables necesarias

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENABLEBANKING_APP_ID` (application id, usado como `kid`)
- `ENABLEBANKING_PRIVATE_KEY` (RSA private key en formato PEM)
- `ENABLEBANKING_API_BASE_URL` (opcional, por defecto `https://api.enablebanking.com`)
- `ENABLEBANKING_SYSTEM_USER_ID` (UUID usado como `creado_por` en los movimientos)

## Despliegue (ejemplo)

```bash
supabase functions deploy enablebanking-sync --no-verify-jwt
```

Configura un cron diario en Supabase Scheduled Functions para ejecutar la función.
