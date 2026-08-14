# Buzón de facturas y lectura con IA — puesta en marcha

Guía de operador. El uso diario está en [el capítulo 8 del manual](manual/8.-facturas.md);
el diseño, en `plans/022-facturas-por-email-y-lectura-con-ia.md`.

Son **dos cosas independientes**: se puede encender una sin la otra.

| | Qué hace | Qué necesita |
|---|---|---|
| **Buzón** | Las facturas enviadas a `facturas+castellon@…` aparecen solas en la bandeja | Resend + un reenvío de correo |
| **Lectura con IA** | Rellena proveedor, nº, fecha, importe y concepto de cualquier factura | Una clave de Gemini |

Sin configurar nada, la app sigue funcionando exactamente igual que hasta ahora.

---

## 1. Base de datos

`scripts/060_facturas_email_ia.sql` — **aplicada el 14-08-2026**. Añadió
`delegacion.alias_email`, `factura.categoria_id` y la tabla `factura_email`.

Los alias se sembraron a partir del nombre y salieron los esperados: `castellon`,
`ece`, `madrid`, `zaragoza`, `vila-real`, `alcora`, `benicarlo-vinaros`… Para
verlos o cambiar alguno:

```sql
SELECT codigo, nombre, alias_email FROM delegacion ORDER BY nombre;
UPDATE delegacion SET alias_email = 'castellon' WHERE codigo = 'MCM-CS';
```

El alias es `[a-z0-9-]` y único. **No conviene cambiarlo** una vez que la gente lo
tenga guardado en su correo. El código de delegación (`facturas+mcm-cs@`) funciona
igualmente sin configurar nada.

## 2. Lectura con IA

Clave en <https://aistudio.google.com/apikey> y en Vercel:

```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.7-flash     # opcional
GEMINI_THINKING_LEVEL=low         # opcional
```

**El tier gratuito llega de sobra**: ~10 peticiones por minuto y ~1.500 al día. El
único límite alcanzable es el de por minuto, si alguien suelta 15 PDF de golpe;
las que fallen quedan con su aviso y un botón de *Volver a leer*.

Con facturación activada el coste es anecdótico: unos 2.000 tokens de entrada
(0,75 $/M) y 200 de salida (3,75 $/M) por factura de una página → **0,2 céntimos**,
o **~2 € por cada mil facturas al año**. La tarifa se dobla a partir del 01-01-2027.

> **La razón para pagar no es el rendimiento, es la privacidad.** En el tier
> gratuito Google puede usar el contenido para mejorar sus productos y hay
> revisión humana; en el de pago, no. A clientes del EEE, Suiza y Reino Unido se
> les aplican las condiciones de pago también en el gratuito, pero tratándose de
> facturas reales conviene no depender de esa excepción: activa facturación.

## 3. Buzón de correo

El dominio `movimientoconsolacion.com` ya tiene su correo, así que **su MX no se
toca**: cambiarlo tumbaría el correo de toda la organización.

### Opción A — reenvío desde Workspace (recomendada)

Da exactamente la dirección que se quería y no toca el DNS.

1. **Resend → Receiving**: alta de un dominio de recepción (vale el
   `<id>.resend.app` que da Resend). Anota su dirección de entrada.
2. **Workspace**: crea `facturas@movimientoconsolacion.com` y reenvía todo su
   correo a esa dirección.
3. Ya está. `facturas+castellon@`, `facturas+ece@`… caen en el mismo buzón (el
   `+etiqueta` es nativo en Workspace) y la etiqueta viaja intacta en la cabecera
   `To:`, que es de donde se lee la delegación.

### Opción B — MX en un subdominio

Alta de `facturas.movimientoconsolacion.com` en Resend con sus MX. Las direcciones
pasan a ser `castellon@facturas.movimientoconsolacion.com` y hay que ajustar
`NEXT_PUBLIC_FACTURAS_EMAIL`.

Las dos funcionan sin tocar código: el parser acepta `facturas+tag@`,
`facturas-tag@` y `tag@facturas.…`.

### Webhook y variables

**Resend → Webhooks** → endpoint
`https://banco.movimientoconsolacion.com/api/facturas/entrantes`, evento
`email.received`, y el signing secret a `RESEND_WEBHOOK_SECRET`.

```
RESEND_API_KEY=re_...          # ya estaba, para enviar avisos
RESEND_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_FACTURAS_EMAIL=facturas@movimientoconsolacion.com
MCM_API_USER_EMAIL=...         # a quién se atribuyen las facturas recibidas
```

`MCM_API_USER_EMAIL` (o `MCM_API_USER_ID`) debe ser una cuenta real de MCM Bank:
la base de datos exige un autor en cada archivo. Si falta, el webhook responde 503
y Resend reintenta, así que los correos entrarán en cuanto se configure.

### ¿Por qué Resend y no la API de Gmail?

| | Resend Inbound | API de Gmail |
|---|---|---|
| Cómo llega | Push, al instante | Polling cada 5-10 min, o Pub/Sub con proyecto de Google Cloud |
| El trabajo sucio | Resend parsea el MIME y separa los adjuntos | Lo parseas tú: multipart, base64, codificaciones raras |
| Credenciales | La API key de Resend que ya existe | OAuth de Google, con refresh token que caduca o se revoca |
| Código nuevo | Un webhook | Un cron + llevar la cuenta de qué mensajes ya se procesaron |

Decide la fila del parseo. Y como el correo entra por Workspace y se reenvía, el
buzón `facturas@` sigue existiendo en Gmail con su histórico: se conserva lo bueno
de la vía Google —un buzón que una persona puede abrir— sin escribir un parser de
correo.

## 4. Comprobar que funciona

```bash
# Sin firma → 401 (o 503 si falta el secreto)
curl -i -X POST https://banco.movimientoconsolacion.com/api/facturas/entrantes \
  -H 'Content-Type: application/json' -d '{"type":"email.received"}'
```

Manda un correo real con un PDF a `facturas+<alias>@movimientoconsolacion.com` y
mira el registro:

```sql
SELECT creado_en, remitente, asunto, alias_detectado, estado, facturas_creadas, error
FROM factura_email ORDER BY creado_en DESC LIMIT 10;
```

| `estado` | Qué pasó |
|---|---|
| `procesado` | Bien: hay facturas nuevas en la bandeja |
| `sin_adjuntos` | Llegó sin archivos legibles; se guardó el texto |
| `sin_delegacion` | La dirección no casa con ningún alias (mira `destinatarios`) |
| `error` | Fallo al descargar o guardar; el motivo está en `error` |

## 5. Reglas que conviene conocer

- **Todo cae en `bandeja`** y nada se concilia solo: a ese buzón puede escribir
  cualquiera.
- **Una factura por adjunto.** Máximo 10 adjuntos por correo y 10 MB cada uno.
- **Un correo sin adjuntos también crea factura**, con el asunto y el cuerpo en las
  notas. Borrar una fila es más fácil que echar de menos un correo.
- **Los reintentos de Resend no duplican nada** (el id del correo es único).
- **El proveedor se crea solo** si no casa ninguno por NIF o nombre exacto, y queda
  con la nota "Creado automáticamente" para poder repasarlo.
- **La categoría nunca se aplica sola.** La IA propone, una persona acepta.
- **El documento es contenido no confiable**: el modelo solo puede rellenar los
  campos de un formulario fijo, así que un PDF con instrucciones dentro no tiene
  ninguna vía para conciliar, borrar ni mover nada.

## 6. Si algo falla

| Síntoma | Causa habitual |
|---|---|
| El webhook devuelve 401 | Secreto distinto, o reloj del servidor desviado más de 5 minutos |
| `sin_delegacion` | El alias de la dirección no existe: revisa `delegacion.alias_email` |
| No llega nada y Resend no registra eventos | El reenvío de Workspace no está activo, o el MX no ha propagado |
| Las facturas entran vacías | Falta `GEMINI_API_KEY`, o el PDF es ilegible (`datos_ia.error` lo dice) |
| "Falta configurar MCM_API_USER_EMAIL" | El servidor no tiene cuenta a la que atribuir lo recibido |
