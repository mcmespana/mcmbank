# Buzón de facturas por delegación y lectura con IA

Guía de operador. Para el uso diario, ver
[el capítulo 8 del manual](manual/8.-facturas.md).

Dos cosas independientes que se pueden activar por separado:

1. **Buzón**: cada delegación recibe sus facturas en
   `facturas+<alias>@movimientoconsolacion.com` y aparecen solas en su bandeja.
2. **Lectura con IA**: el PDF se lee con Gemini y se rellenan proveedor, número,
   fecha, importe y concepto, más una **sugerencia** de categoría que siempre
   hay que aceptar a mano.

La lectura funciona igual para las facturas que se suben arrastrándolas a la
bandeja. Si solo se configura la IA (sin buzón), todo lo demás sigue igual; si
solo se configura el buzón (sin IA), las facturas llegan pero hay que
rellenarlas a mano.

---

## 1. Base de datos

`scripts/060_facturas_email_ia.sql` — **ya aplicada** (14-08-2026). Añade:

- `delegacion.alias_email` — la etiqueta del buzón, sembrada automáticamente a
  partir del nombre (`MCM Castellón` → `castellon`, `ECE MCM` → `ece`).
- `factura.categoria_id` — donde aterriza la categoría cuando se acepta.
- `factura_email` — registro de los correos recibidos.

Los alias sembrados son los esperados: `castellon`, `ece`, `madrid`, `zaragoza`,
`vila-real`, `alcora`, `benicarlo-vinaros`, `villacanas`… Para comprobarlos o
cambiar alguno:

```sql
SELECT codigo, nombre, alias_email FROM delegacion ORDER BY nombre;
UPDATE delegacion SET alias_email = 'castellon' WHERE codigo = 'MCM-CS';
```

El alias debe ser `[a-z0-9-]`, único, y **no conviene cambiarlo** una vez que la
gente lo tenga guardado en su correo. También funciona el código de delegación
(`facturas+mcm-cs@`) sin configurar nada.

## 2. Lectura con IA (Gemini)

1. Crear una clave en <https://aistudio.google.com/apikey>.
2. En Vercel → Settings → Environment Variables:

```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.7-flash     # opcional
GEMINI_THINKING_LEVEL=low         # opcional
```

### ¿Gratis o de pago?

**El tier gratuito de AI Studio da de sobra para este volumen**: del orden de
10 peticiones por minuto y ~1.500 al día. Una delegación no manda 1.500 facturas
en un día, así que el único límite que se puede rozar es el de **por minuto**, si
alguien suelta 15 PDFs de golpe en la bandeja: las que fallen se quedan con el
aviso de error y un botón de "Volver a leer".

Si se activa facturación, el coste es ridículo igualmente:

| | Tokens por factura (1 página) | Precio |
|---|---|---|
| Entrada (PDF + catálogo de proveedores y categorías) | ~2.000 | 0,75 $/M |
| Salida (el JSON) | ~200 | 3,75 $/M |
| **Total** | | **~0,002 $ = 0,2 céntimos** |

Es decir: **1.000 facturas al año ≈ 2 €**. (Tarifa vigente hasta el 31-12-2026;
a partir de ahí, el doble: ~4 €.)

**Lo que sí conviene mirar no es el precio, es la privacidad.** En el tier
gratuito, Google puede usar el contenido enviado para mejorar sus productos, y
revisores humanos pueden verlo; en el de pago, no. Con una excepción importante
aquí: para clientes del **Espacio Económico Europeo, Suiza y Reino Unido**,
Google aplica las condiciones de datos de pago también al tier gratuito. Aun así,
por tratarse de facturas reales con datos de proveedores, **la recomendación es
activar facturación**: cuestan un par de euros al año y evita depender de esa
excepción.

Sin `GEMINI_API_KEY`, la app no falla: cada factura guarda en `datos_ia` que la
lectura no está configurada y la bandeja funciona a mano como siempre.

## 3. Buzón de correo

`movimientoconsolacion.com` ya tiene su correo, así que **no se puede cambiar el
MX del dominio principal**. Dos formas de montarlo:

### Opción A — reenvío desde el correo actual (recomendada)

Es la que da exactamente la dirección pedida y no toca el DNS del dominio.

1. En Resend → **Receiving**, dar de alta un dominio de recepción (vale el
   `<id>.resend.app` que da Resend, o un subdominio propio con su MX). Anota la
   dirección de entrada, del tipo `entrada@id123.resend.app`.
2. En Google Workspace, crear el buzón o alias `facturas@movimientoconsolacion.com`
   y configurar el **reenvío automático** de todo su correo a esa dirección de
   entrada.
3. Listo: `facturas+castellon@`, `facturas+ece@`… llegan al mismo buzón (el
   sub-direccionamiento con `+` es nativo en Workspace) y la etiqueta viaja
   intacta en la cabecera `To:`, que es de donde se lee la delegación.

### Opción B — MX en un subdominio

Si se prefiere no depender del reenvío: dar de alta `facturas.movimientoconsolacion.com`
en Resend y poner sus registros MX. Las direcciones pasan a ser
`castellon@facturas.movimientoconsolacion.com`, y hay que ajustar
`NEXT_PUBLIC_FACTURAS_EMAIL` para que la app enseñe la dirección correcta.

**Las dos funcionan sin tocar código**: el parser acepta `facturas+tag@`,
`facturas-tag@` y `tag@facturas.…`.

### Por qué Resend y no la API de Gmail

Se valoraron las dos (la de Gmail era la idea original, ver el histórico del
capítulo 8 del manual). Resumen de la comparación:

| | Resend Inbound (lo implementado) | API de Gmail |
|---|---|---|
| Cómo llega | Push: Resend llama al webhook al instante | Polling con un cron cada 5-10 min, o Pub/Sub con un proyecto de Google Cloud |
| Trabajo sucio | Resend parsea el MIME y separa los adjuntos | Hay que parsear el MIME a mano: multipart, base64, codificaciones raras, adjuntos anidados |
| Credenciales | La API key de Resend que ya existe para los avisos | OAuth de Google con refresh token que caduca o se revoca (y un flujo de reconexión que mantener) |
| Latencia | Segundos | Hasta 10 minutos con polling |
| Código nuevo | Un webhook | Un cron + gestión de estado ("qué mensajes ya procesé") + etiquetas en Gmail |

Gana Resend por la fila del parseo: leer correos MIME bien (con sus casos raros)
es bastante más código y bastante más frágil que verificar una firma. Y como el
correo entra por Workspace y se **reenvía**, el buzón `facturas@` sigue existiendo
en Gmail con todo el histórico: se conserva lo bueno de la opción Google (un
buzón que una persona puede abrir y mirar) sin escribir un parser de correo.

### Webhook

En Resend → **Webhooks** → añadir endpoint:

- URL: `https://banco.movimientoconsolacion.com/api/facturas/entrantes`
- Evento: `email.received`
- Copiar el signing secret (`whsec_…`) a `RESEND_WEBHOOK_SECRET`.

### Variables

```
RESEND_API_KEY=re_...                 # ya estaba, para enviar avisos
RESEND_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_FACTURAS_EMAIL=facturas@movimientoconsolacion.com
MCM_API_USER_EMAIL=...                # a quién se atribuyen las facturas recibidas
```

`MCM_API_USER_EMAIL` (o `MCM_API_USER_ID`) tiene que apuntar a una cuenta real
de MCM Bank: la base de datos exige un autor en cada archivo subido. Sin ella el
webhook responde 503 y Resend reintenta, así que en cuanto se configure entrarán
los correos pendientes.

## 4. Comprobar que funciona

```bash
# 1. Sin firma → 401 (o 503 si falta el secreto)
curl -i -X POST https://banco.movimientoconsolacion.com/api/facturas/entrantes \
  -H 'Content-Type: application/json' -d '{"type":"email.received"}'
```

Después, mandar un correo real con un PDF adjunto a
`facturas+<alias>@movimientoconsolacion.com` y mirar:

```sql
SELECT creado_en, remitente, asunto, alias_detectado, estado, facturas_creadas, error
FROM factura_email ORDER BY creado_en DESC LIMIT 10;
```

| `estado` | Qué pasó |
|---|---|
| `procesado` | Todo bien: hay facturas nuevas en la bandeja |
| `sin_adjuntos` | Llegó, pero sin ningún archivo legible: se guardó el texto |
| `sin_delegacion` | La dirección no casa con ningún alias (mira `destinatarios`) |
| `error` | Fallo al descargar o al guardar; el motivo está en `error` |

## 5. Límites y decisiones que conviene conocer

- **10 adjuntos por correo y 10 MB por adjunto.** Lo que pase de ahí se ignora y
  se anota en `factura_email.error`.
- **Una factura por adjunto**, siempre en estado `bandeja`. Nada se concilia
  automáticamente con un movimiento: eso lo decide una persona.
- **Un correo sin adjuntos también crea una factura**, con el asunto y el cuerpo
  en las notas. Es más fácil borrar una fila que echar de menos un correo.
- **Idempotencia**: los reintentos de Resend no duplican nada (`factura_email`
  tiene el id del correo como clave única).
- **El proveedor se crea solo** si no hay ninguno que case por NIF o por nombre
  exacto; queda con la nota "Creado automáticamente…" para poder repasarlo.
- **La categoría nunca se aplica sola.** La IA la propone, alguien la acepta.
- **A ese buzón puede escribir cualquiera.** Por eso todo cae en `bandeja`, se
  guarda el remitente y el documento nunca puede hacer nada más que rellenar los
  campos de un formulario fijo: si un PDF trae instrucciones dirigidas al modelo,
  no hay ninguna salida del esquema que permita conciliar, borrar ni mover nada.

## 6. Problemas frecuentes

| Síntoma | Causa habitual |
|---|---|
| El webhook devuelve 401 | El secreto de Resend no coincide, o el reloj del servidor está desviado más de 5 minutos |
| `sin_delegacion` | El alias de la dirección no existe: revisa `delegacion.alias_email` |
| No llega nada y en Resend no hay eventos | El reenvío de Workspace no está activo, o el MX no ha propagado |
| Las facturas entran pero vacías | Falta `GEMINI_API_KEY`, o el PDF es una imagen ilegible (`datos_ia.error` lo dice) |
| "Falta configurar MCM_API_USER_EMAIL" | El servidor no tiene cuenta a la que atribuir las facturas recibidas |
