# Integración Enable Banking · Sincronización automática de movimientos

Este documento describe la integración de **Enable Banking (PSD2 AIS)** con MCM Bank: cómo autorizar una cuenta bancaria desde MCM Bank, cómo se sincronizan los movimientos cada noche, cómo forzar una sincronización manual con log detallado, y cómo gestionarla a nivel operativo.

---

## 1. ¿Qué hace la integración?

1. El usuario marca una cuenta como **"Conectada"** y pulsa **"Conectar con el banco"**.
2. Se redirige al banco, el usuario aprueba con SCA (biometría / SMS), y vuelve a MCM Bank.
3. A las **06:00 UTC cada día** (≈ 07:00 España invierno / 08:00 verano), un cron en Supabase dispara la sincronización de todas las cuentas activas.
4. Cada cuenta con `sync_enabled=true` y consentimiento vivo recibe sus movimientos nuevos desde la última sincronización (con un margen de 10 días hacia atrás para capturar asientos con fecha retroactiva), ya des-duplicados por `transaction_id` / `entry_reference` / hash compuesto. En la **primera** sincronización intentamos traer hasta 2 años de histórico; si el banco no permite tanto, probamos ventanas más cortas (1 año → 6 meses → 90 días) y avisamos en el log para que el histórico anterior se importe manualmente desde Excel.
5. El usuario puede **forzar una sincronización manual** desde la página `/cuentas` con un botón y ver en pantalla **todos los pasos del proceso** (log detallado).
6. Cuando el consentimiento caduca (90–180 días según banco), la cuenta se marca `expirada` y hay que volver a pulsar "Conectar" para renovar.

---

## 2. Arquitectura

### Tablas nuevas

- **`banco_conexion`** · una fila por cada sesión autorizada en Enable Banking. Guarda `session_id`, `consent_valid_until`, ASPSP, estado, etc.
- **`banco_sync_log`** · una fila por cada ejecución de sync (cron o manual). Guarda recibidas, insertadas, duplicadas, errores y el **log verbose** como JSONB.

### Campos añadidos

- **`cuenta`** · `banco_conexion_id`, `external_account_uid`, `external_account_hash`, `sync_enabled`, `last_sync_at`, `last_sync_status`, `last_sync_error`, `sync_desde_fecha`.
- **`movimiento`** · `external_id` (clave de dedup), `external_id_source`, `booking_date`, `value_date`, `origen_sync`.

### Constraint único para dedup

```
UNIQUE (cuenta_id, external_id)
```

Constraint normal (no índice parcial): el upsert con `ON CONFLICT (cuenta_id, external_id)` no puede inferir índices parciales vía PostgREST. Los movimientos manuales tienen `external_id` NULL y los NULL no colisionan entre sí (migración 043).

### Estrategia de dedup (3 niveles)

1. **`transaction_id`** si el ASPSP lo devuelve (preferido).
2. **`entry_reference`** como fallback estable.
3. **Hash compuesto** SHA-256 de `booking_date | value_date | amount | currency | counterparty_iban | remittance_info | credit_debit`. Cubre el caso "5 pagos el mismo día por el mismo importe" porque el hash incluye contraparte + remittance, que suelen diferenciar pagos iguales.

Cada sync incremental **relee los últimos 10 días** (desde `last_sync_at - 10d`) para absorber transacciones que el banco publica con `booking_date` retroactivo. El índice único se encarga del descarte de duplicados.

**Primera sincronización de una cuenta**: probamos, en orden, ventanas de `[730, 365, 180, 90]` días hacia atrás. El primer banco que no rechace la llamada fija la ventana real. La PSD2 impone 90 días como mínimo obligatorio; algunos bancos (BBVA, Santander Empresa, etc.) permiten hasta 2 años si el consentimiento lo admite. Si quieres forzar una fecha concreta para la primera sync, pon `cuenta.sync_desde_fecha = 'YYYY-MM-DD'` antes de sincronizar — se respeta sin fallback.

Cuando el banco limita el histórico, el log muestra una advertencia visible y explícita: **"Para movimientos anteriores a YYYY-MM-DD, impórtalos manualmente desde Excel."** El usuario puede seguir el flujo habitual de importación en la pestaña Transacciones para cargar el histórico antiguo.

### Rutas API

| Ruta | Método | Qué hace |
|------|--------|----------|
| `/api/bank-sync/aspsps?country=ES` | GET | Lista bancos disponibles por país (dropdown del dialog de conexión). |
| `/api/bank-sync/auth` | POST | Inicia OAuth: crea `banco_conexion` pendiente y devuelve URL de redirección al banco. |
| `/api/bank-sync/callback` | GET | EB redirige aquí con `code`+`state`. Crea la session, linka la cuenta. |
| `/api/bank-sync/run` | POST | Ejecuta sync. Modo cron (Bearer CRON_SECRET) o manual (usuario autenticado + `?cuenta_id=`). |
| `/api/bank-sync/disconnect` | POST | Revoca sesión en EB y marca cuenta desconectada. Los movimientos importados se conservan. |

### Librería

- `lib/enable-banking/jwt.ts` · Firma JWT RS256 (cache 23h).
- `lib/enable-banking/client.ts` · Cliente HTTP con PSU headers.
- `lib/enable-banking/dedup.ts` · `resolveExternalId` + `mapTransactionToMovimiento`.
- `lib/enable-banking/sync.ts` · `syncCuenta` + `syncTodasLasCuentas` con log verbose.

---

## 3. Setup paso a paso

### 3.1 Obtener credenciales de Enable Banking

1. Entra a <https://enablebanking.com/cp/> → **Applications** → tu app de producción.
2. **APP_ID**: copia el UUID que aparece como identificador de la app.
3. **Clave privada PEM**:
   - Si la generaste al registrar la app, la descargaste UNA vez. Si la perdiste, genera una nueva en *Applications → Keys → Generate new key*. **La anterior queda invalidada al instante.**
   - Descarga el `.pem`. Guárdalo seguro.
4. **Redirect URL**: Applications → Redirect URLs → añade `https://<tu-dominio>/api/bank-sync/callback`. Tiene que coincidir EXACTO con lo que pongamos en env.

### 3.2 Variables de entorno en Vercel

Añade en Vercel → Project Settings → Environment Variables (Production + Preview):

```bash
ENABLE_BANKING_APP_ID="<tu-uuid>"
ENABLE_BANKING_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
ENABLE_BANKING_REDIRECT_URL="https://<tu-dominio>/api/bank-sync/callback"

# Genera con: openssl rand -hex 32
CRON_SECRET="<32-hex-chars>"

# Opcionales — para PSU headers. Valores por defecto funcionan en la mayoría de bancos.
# ENABLE_BANKING_PSU_IP="127.0.0.1"
# ENABLE_BANKING_PSU_UA="Mozilla/5.0 (compatible; MCMBank/1.0)"

# Ya deberían estar:
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
NEXT_PUBLIC_SUPABASE_URL="https://<proyecto>.supabase.co"
```

**Importante sobre `ENABLE_BANKING_PRIVATE_KEY`**: Vercel guarda secretos multilínea con `\n` literal. El código ya normaliza ambas formas (reemplaza `\n` por saltos reales).

### 3.3 Aplicar la migración de schema (038)

En Supabase → **SQL Editor** → pega el contenido de `scripts/038_enable_banking_schema.sql` y ejecútalo.

Qué hace: crea `banco_conexion`, `banco_sync_log`, amplía `cuenta` y `movimiento`, crea índices y políticas RLS.

### 3.4 Activar extensiones pg_cron y pg_net (una sola vez)

Supabase → **Database → Extensions** → busca `pg_cron` y `pg_net` → activa ambas.

O por SQL:
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

### 3.5 Configurar settings para el cron

En Supabase → **SQL Editor** ejecuta (reemplazando los valores):

```sql
alter database postgres set app.mcmbank_url      = 'https://<tu-dominio>';
alter database postgres set app.mcmbank_cron_key = '<mismo-valor-que-CRON_SECRET>';
```

**Nota**: estos `ALTER DATABASE SET` solo aplican a conexiones nuevas. No afecta a sesiones abiertas. El cron los lee cada ejecución, así que funciona.

### 3.6 Programar el cron (039)

En Supabase → **SQL Editor** → pega y ejecuta `scripts/039_enable_banking_cron.sql`.

Crea la función `trigger_bank_sync_cron()` y programa el job `mcmbank_bank_sync_daily` a las **06:00 UTC diario**.

Verifica:
```sql
SELECT * FROM cron.job WHERE jobname = 'mcmbank_bank_sync_daily';
```

### 3.7 Deploy en Vercel

```bash
git push origin claude/enable-banking-integration-tT61D
```

Vercel despliega. Comprueba que las rutas `/api/bank-sync/*` responden (al menos 401 si pegas sin auth, no 404).

### 3.8 Prueba end-to-end con una cuenta real

1. Entra a MCM Bank → `/cuentas` → crea o edita una cuenta bancaria.
2. En "Tipo de conexión" elige **"Conectada (Enable Banking)"** y guarda.
3. En la tarjeta de la cuenta aparece un icono morado 🔗 **Conectar con el banco** → pulsa.
4. En el dialog: elige país (ES), banco, tipo de cliente (Empresa / Asociación), días (por defecto 90).
5. Pulsa **Conectar** → redirige al banco → aprueba el SCA.
6. Vuelves a `/cuentas` con un toast "Cuenta conectada correctamente".
7. Ahora la cuenta muestra iconos verde 🔄 (sincronizar) y naranja 🔓 (desconectar).

### 3.9 Forzar una primera sincronización para ver el log

1. Pulsa el icono 🔄 en la cuenta.
2. En el dialog pulsa **"Ejecutar sincronización"**.
3. Verás:
   - Ventana de fechas.
   - JWT generado, sesión EB validada.
   - Cada página de transacciones recibida con `continuation_key`.
   - Transformación (ejemplos de movimientos mapeados).
   - Contadores: recibidas / insertadas / duplicadas / errores.
   - Cualquier error con stacktrace.

---

## 4. Gestión operativa diaria

### Ver cómo va el cron

Supabase → SQL Editor:

```sql
-- Últimas 10 ejecuciones del job
SELECT
    jrd.start_time, jrd.end_time, jrd.status, jrd.return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON jrd.jobid = j.jobid
WHERE j.jobname = 'mcmbank_bank_sync_daily'
ORDER BY jrd.start_time DESC
LIMIT 10;

-- Últimas 20 sincronizaciones por cuenta
SELECT
    l.started_at, l.trigger, c.nombre, l.estado,
    l.transacciones_insertadas, l.transacciones_duplicadas, l.transacciones_error,
    l.error_mensaje
FROM public.banco_sync_log l
LEFT JOIN public.cuenta c ON c.id = l.cuenta_id
ORDER BY l.started_at DESC
LIMIT 20;
```

También en el UI: cada sync manual muestra el log completo en pantalla; los crons se pueden consultar por SQL (no tienen UI histórico todavía).

### Renovar un consentimiento caducado

- Si `banco_conexion.estado = 'expirada'` o `consent_valid_until < now()`, la cuenta deja de sincronizar.
- El usuario va a `/cuentas`, pulsa 🔓 **Desconectar**, y luego 🔗 **Conectar con el banco** de nuevo.
- El sistema crea una **nueva** `banco_conexion` y linka la misma cuenta. Los movimientos históricos ya importados **se conservan** (están en `movimiento`, no en la conexión).

> 💡 Mejora futura sugerida: banner en `/cuentas` con botón "Renovar" cuando `consent_valid_until < now() + 7 días`.

### Desconectar definitivamente una cuenta

- Pulsa 🔓 en la cuenta. Confirma.
- MCM Bank llama a `DELETE /sessions/{id}` en EB (best-effort: si falla se avisa pero continúa localmente).
- `cuenta.sync_enabled=false`, `banco_conexion_id=null`, `origen='manual'`.
- Los movimientos se conservan. La cuenta sigue funcionando como manual.

### Cambiar el horario del cron

```sql
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mcmbank_bank_sync_daily';
SELECT cron.schedule('mcmbank_bank_sync_daily', '0 5 * * *', $$SELECT public.trigger_bank_sync_cron();$$);
```

Usa **UTC** en el cron expression. España:
- `0 6 * * *` → 07:00 en invierno (CET), 08:00 en verano (CEST)
- `0 5 * * *` → 06:00 en invierno, 07:00 en verano (recomendado si quieres que no pase de 07:00 en verano)

### Monitorear una cuenta concreta

```sql
SELECT id, nombre, sync_enabled, last_sync_at, last_sync_status, last_sync_error
FROM public.cuenta
WHERE sync_enabled = true;
```

---

## 5. Limitaciones conocidas

1. **Sin renovación silenciosa del consentimiento**: es una limitación de PSD2, no de Enable Banking. El usuario debe hacer SCA cada 90–180 días según el banco.
2. **No existe API para "listar sesiones previas"**: si se pierde el `session_id` antes de guardarlo en DB, hay que re-autorizar. Para inspección manual están los **Request Logs** del Control Panel de EB.
3. **Múltiples cuentas en una sola autorización**: si el banco devuelve varias cuentas y la cuenta de MCM Bank no tiene IBAN ni hay match de 1:1, el callback retorna un error pidiendo que pongas el IBAN. Mejora futura: UI para elegir cuenta manualmente.
4. **Timeout de Vercel**: el cron agrupa todas las cuentas en una sola request. Si la delegación tiene muchas cuentas con histórico grande y Vercel devuelve 504, la solución es partirlo (un `net.http_post` por cuenta desde pg_cron). No implementado todavía.
5. **Solo transacciones booked**: ignoramos PDNG (pendientes) porque cambian de `transaction_id` al confirmarse y generan ruido.
7. **Histórico previo limitado por el banco**: por mucho que intentemos ir 2 años atrás, el ASPSP puede limitar la ventana a 90 días. Esto es una restricción de PSD2 / del propio banco, no nuestra. Cuando ocurre, el log lo deja claro y el usuario debe importar el histórico antiguo desde Excel.
6. **Autorización tiene que iniciarse desde MCM Bank**: no podemos reaprovechar sesiones pre-existentes del dashboard de EB — el `session_id` solo se devuelve en la llamada a `/sessions` tras el callback.

---

## 6. Troubleshooting

### "ENABLE_BANKING_APP_ID no está configurado"
Faltan variables de entorno en Vercel. Revisa Section 3.2.

### "EnableBanking /auth → 401"
El JWT es inválido. Causas típicas:
- APP_ID no coincide con la PEM.
- PEM mal formateada (faltan saltos de línea o `\n` sin escapar).
- PEM de otra aplicación.

Regenera la PEM en el Control Panel y actualiza env.

### "Se autorizó la conexión pero hay N cuentas y ninguna casa con el IBAN"
Edita la cuenta en MCM Bank, pega el IBAN correcto del banco, desconecta y vuelve a conectar.

### "Sesión EB expirada. Renueva la conexión."
El consentimiento ha caducado. Desconecta la cuenta y vuelve a conectar (Section 4.2).

### El cron no se ejecuta
```sql
SELECT * FROM cron.job WHERE jobname = 'mcmbank_bank_sync_daily';
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
```
- Si `status='failed'`: mira `return_message`. Suele ser `app.mcmbank_url` o `app.mcmbank_cron_key` no configurados (Section 3.5).
- Si no hay registros en `job_run_details`: pg_cron extension está inactiva.
- Si `net.http_post` devuelve 401: el `CRON_SECRET` de Vercel no coincide con `app.mcmbank_cron_key`.

### Transacciones duplicadas
No debería ocurrir gracias al índice único. Si pasa:
```sql
SELECT cuenta_id, external_id, COUNT(*)
FROM public.movimiento
WHERE external_id IS NOT NULL
GROUP BY 1,2 HAVING COUNT(*) > 1;
```
Si hay duplicados, probablemente es el fallback de hash compuesto con una transacción anómala. Reporta el caso.

---

## 7. Seguridad

- **Clave privada PEM**: solo en env de Vercel (encriptada). Nunca en código o commits.
- **CRON_SECRET**: mismo criterio. Rotable regenerando con `openssl rand -hex 32` y actualizando tanto Vercel env como `app.mcmbank_cron_key` en Supabase.
- **RLS**: `banco_conexion` y `banco_sync_log` tienen políticas para que un usuario solo vea/edite los de sus delegaciones con rol `gestor_central` o `tesorero`.
- **Service role**: solo se usa en API routes server-side. No se expone al cliente.
- **PII**: los logs en `banco_sync_log` pueden contener previews de transacciones (contraparte, importe). Si compartes un log para debug, revisa antes.

---

## 8. Referencias

- Enable Banking docs: <https://enablebanking.com/docs/>
- API Reference: <https://enablebanking.com/docs/api/reference/>
- Control Panel: <https://enablebanking.com/cp/>
- Ejemplo oficial JS: <https://github.com/enablebanking/enablebanking-api-samples/tree/master/js_example>
- pg_cron: <https://supabase.com/docs/guides/database/extensions/pg_cron>
- pg_net: <https://supabase.com/docs/guides/database/extensions/pg_net>
