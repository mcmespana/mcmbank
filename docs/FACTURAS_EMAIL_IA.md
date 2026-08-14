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

Aplicar `scripts/060_facturas_email_ia.sql`. Añade:

- `delegacion.alias_email` — la etiqueta del buzón, sembrada automáticamente a
  partir del nombre (`MCM Castellón` → `castellon`, `ECE MCM` → `ece`).
- `factura.categoria_id` — donde aterriza la categoría cuando se acepta.
- `factura_email` — registro de los correos recibidos.

Comprobar el sembrado y ajustar lo que no guste:

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

**Coste**: 0,75 $ por millón de tokens de entrada y 3,75 $ de salida (tarifa
vigente hasta el 31-12-2026; a partir de ahí, el doble). Una factura de una
página sale por unos **0,0015 $**: mil facturas al año son ~1,5 $. Hay tier
gratuito con límite de peticiones por minuto, suficiente para probar.

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
