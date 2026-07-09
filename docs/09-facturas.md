# Facturas

La sección **Facturas** es la bandeja de entrada de las facturas de cada delegación. No es una
lista de "pendientes de pagar": casi siempre la factura ya está pagada cuando llega. Lo importante
es guardarla, apuntar los datos básicos y **conciliarla con su movimiento bancario** con los
mínimos clicks posibles.

## Flujo básico

1. **Sube archivos a la bandeja**: arrastra uno o varios PDF/imágenes a la zona de subida. Se crea
   una factura por archivo en estado *En bandeja*.
2. **Completa los datos**: proveedor (contacto), concepto, importe, fecha de emisión y nº de
   factura. Si el proveedor no existe, se crea al vuelo desde el propio selector sin salir del
   formulario.
3. **Vincula el movimiento**: el botón *Vincular movimiento* busca gastos con un importe parecido
   (con un pelín de margen), afinando por fecha y contacto. Si hay un candidato claro, se marca
   como **Match directo** y viene preseleccionado. Al vincular:
   - La factura pasa a **Pagada**.
   - El movimiento hereda el contacto de la factura (y viceversa si faltaba).
   - Los archivos de la factura aparecen también en el movimiento.

## Estados

| Estado | Significado |
|--------|-------------|
| En bandeja | Recién subida, pendiente de revisar/completar datos |
| Sin pagar | Registrada, pendiente de pago |
| Pagada | Pagada y vinculada a un movimiento de MCM Bank |
| Pagada fuera | Pagada, pero el pago se hizo fuera de MCM Bank (no hay movimiento que vincular) |

Al desvincular un movimiento, la factura vuelve a *Sin pagar*.

## Desde el lado movimiento

En el detalle de un movimiento (pestaña Archivos):

- **Subir una factura** al movimiento crea automáticamente la entidad factura al otro lado, ya
  conciliada y con los datos del movimiento (fecha, importe, contacto).
- **Vincular una factura de la bandeja**: si la factura ya estaba subida en la sección Facturas,
  se elige de una lista de candidatas compatibles por importe.

## Modelo de datos

- Tabla `factura` (migración `scripts/047_create_factura.sql`), con RLS por delegación
  (lectura: cualquier miembro; escritura: tesorero / gestor_central).
- Vínculo 1-a-1 con `movimiento` (`factura.movimiento_id` + `movimiento.factura_id`). Un trigger
  sincroniza el estado (`pagada` al vincular, `sin_pagar` al desvincular).
- Archivos en `archivo_adjunto` con `entidad='factura'` (bucket `facturas` de Storage). Al
  conciliar se replican en `movimiento_archivo` apuntando al mismo path.

---

## Integraciones futuras (estructura ya preparada)

La tabla `factura` ya incluye las columnas necesarias para estas dos integraciones: `origen`
(`subida | movimiento | email`), `email_remitente` y `datos_ia` (JSONB).

### a) Buzón de email por delegación

**Objetivo**: crear una dirección tipo `facturas-valencia@movimientoconsolacion.com` (Google
Workspace) a la que cualquiera reenvía facturas, y que aparezcan solas en la bandeja de la
delegación con estado *En bandeja* y `origen='email'`.

**Cómo se haría** (recomendado, sin servidores propios):

1. **Crear el grupo/buzón en Google Workspace** por delegación (o un único buzón con alias
   `facturas+valencia@…`; el sufijo `+delegacion` permite enrutar con una sola cuenta).
2. **Recepción**: dos opciones, de menos a más infraestructura:
   - **Polling con Gmail API** (recomendado para empezar): una *Supabase Edge Function* programada
     (cron cada 5–10 min, igual que `039_enable_banking_cron.sql`) que lee los mensajes no
     procesados del buzón con la Gmail API. Ya existe infraestructura de credenciales Google en la
     app (`google_credencial`, `lib/services/google.ts`), se reutiliza el mismo patrón OAuth.
   - **Push**: Gmail API *watch* + Google Cloud Pub/Sub que llama a una Edge Function HTTP. Más
     inmediato pero requiere proyecto GCP con Pub/Sub.
3. **Procesado en la Edge Function** (`supabase/functions/facturas-inbound-email`):
   - Resolver la delegación por el alias/dirección de destino (tabla de mapeo
     `delegacion.email_facturas` o convención `facturas+<codigo>@`).
   - Por cada adjunto PDF/imagen: subirlo al bucket `facturas` de Storage
     (path `<codigo>/<año>/<mes>/factura/<uuid>/...`, el mismo esquema que usa `FileService`).
   - Insertar la fila en `factura` (`estado='bandeja'`, `origen='email'`,
     `email_remitente=<from>`, `concepto=<asunto>`) y su `archivo_adjunto` con
     `entidad='factura'` (con la *service role key*, saltando RLS de forma controlada).
   - Marcar el mensaje como procesado (label de Gmail) para no duplicar.
4. **UI**: no requiere cambios; las facturas con `origen='email'` ya muestran el remitente en la
   tarjeta y caen en la pestaña Bandeja con su contador en el sidebar.

### b) Lectura automática con IA (rellenar datos básicos)

**Objetivo**: al subir un archivo (o al llegar por email), extraer proveedor, fecha de emisión,
importe total y nº de factura — **sin IVA ni desglose fiscal** — y dejar la factura casi lista:
proveedor creado/asignado automáticamente si no existe.

**Cómo se haría**:

1. **Servicio**: Gemini API (`gemini-flash` con entrada PDF/imagen es suficiente y muy barato) o
   Google Cloud Document AI (procesador *Invoice Parser*, más caro y con mucho desglose fiscal que
   no interesa). Recomendación: **Gemini con salida estructurada (JSON schema)**.
2. **Dónde**: una Edge Function `facturas-analizar` que recibe `factura_id`:
   - Descarga el archivo de Storage y lo manda a Gemini con un prompt fijo pidiendo JSON:
     `{ proveedor: { nombre, nif }, fecha_emision, importe_total, numero, moneda }`.
   - Guarda la respuesta cruda en `factura.datos_ia` (auditable y re-procesable).
   - **Proveedor**: busca en `contacto` por `identificador_fiscal` o nombre normalizado dentro de
     la delegación (+ globales); si no existe, lo crea con `tipo='proveedor'` y lo asigna.
   - Rellena solo los campos que estén vacíos en la factura (nunca machaca lo editado a mano).
3. **Disparo**: al crear la factura desde la bandeja (llamada `supabase.functions.invoke` tras la
   subida, en `factura-inbox-dropzone.tsx`) y desde el procesador de email del punto (a).
4. **UI**: badge "Rellenada con IA" cuando `datos_ia` no sea nulo, con opción de revisar; los
   campos siguen siendo editables como siempre.
5. **Secretos**: `GEMINI_API_KEY` como secret de Edge Functions (`supabase secrets set`), nunca
   `NEXT_PUBLIC_`.
