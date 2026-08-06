# 7. Facturas

La sección **Facturas** es la bandeja de entrada de las facturas de cada delegación. No es una
lista de "pendientes de pagar": casi siempre la factura ya está pagada cuando llega. Lo importante
es guardarla, apuntar los datos básicos y **conciliarla con su movimiento bancario** con los
mínimos clicks posibles.

📸 _Captura de la bandeja de facturas_

## Flujo básico

La pestaña **Bandeja** muestra cada factura como una tarjeta pequeña con la miniatura del
documento (así se ve de un vistazo qué es sin abrir nada); el resto de pestañas (*Sin cerrar*,
*Pagadas*, *Todas*) las lista como filas densas, una por factura, igual que en Movimientos.

1. **Sube archivos a la bandeja**: arrastra uno o varios PDF/imágenes a la zona de subida. Se crea
   una factura por archivo en estado *En bandeja*.
2. **Abre la tarjeta o la fila**: se abre un único panel con el documento, los datos y los
   candidatos de conciliación juntos — no hace falta pasar por varias pantallas.
3. **Completa los datos**: proveedor (contacto), concepto, importe, fecha de emisión y nº de
   factura. Si el proveedor no existe, se crea al vuelo desde el propio selector sin salir del
   panel.
4. **Elige el movimiento**: la lista de candidatos (gastos con un importe parecido, con un pelín
   de margen, afinando por fecha y contacto) se recalcula al momento según el importe que vayas
   escribiendo, sin cerrar nada. Si hay un candidato claro, se marca como **Match directo** y
   viene preseleccionado.
5. **Guarda**: el botón del panel dice **Guardar y conciliar** cuando hay un candidato marcado, o
   simplemente **Guardar** si no. Al conciliar:
   - La factura pasa a **Pagada** (o **Pago parcial** si el movimiento no cubre el importe total).
   - El movimiento hereda el contacto de la factura (y viceversa si faltaba).
   - Los archivos de la factura aparecen también en el movimiento.

Desde el mismo panel, el menú **⋯** de la fila (o de la cabecera del panel) tiene además
*Pagada fuera de MCM Bank* (para facturas pagadas sin movimiento que vincular), *Desvincular
movimiento* y *Eliminar*. El estado no se elige a mano en ningún selector: lo calcula solo la
base de datos a partir de los movimientos vinculados (ver más abajo).

Junto al buscador hay tres pastillas de filtro para encontrar lo que impide cerrar una factura
sin mirar tarjeta por tarjeta: **Sin proveedor**, **Sin importe** y **Falta NIF**.

### Pagos en varios plazos

Una factura puede tener **0, 1 o varios movimientos vinculados**. Por ejemplo, una factura de
3.000 € pagada en dos transferencias de 1.500 € se concilia vinculando ambos movimientos a la
misma factura: tras el primero queda en **Pago parcial** (indicando cuánto falta por cubrir);
tras el segundo, la suma alcanza el importe y pasa a **Pagada**. El botón para vincular sigue
disponible mientras la factura no esté completamente cubierta, y la búsqueda de candidatos usa
el importe **pendiente**, no el total, para sugerir el siguiente plazo. Cada movimiento vinculado
se puede desvincular individualmente sin afectar a los demás.

## Estados

| Estado | Significado |
|--------|-------------|
| En bandeja | Recién subida, pendiente de revisar/completar datos |
| Sin pagar | Registrada, pendiente de pago |
| Pago parcial | Vinculada a uno o varios movimientos que no cubren aún el importe total |
| Pagada | Pagada y vinculada a movimiento(s) de MCM Bank que cubren el importe total |
| Pagada fuera | Pagada, pero el pago se hizo fuera de MCM Bank (no hay movimiento que vincular) |

{% hint style="info" %}
El estado (salvo *Pagada fuera*, marca manual) se recalcula solo cada vez que se vincula o
desvincula un movimiento, comparando la suma de sus importes con el importe de la factura. Al
desvincular el único/último movimiento, la factura vuelve a *Sin pagar*.
{% endhint %}

## Desde el lado movimiento

En el detalle de un movimiento (pestaña Archivos):

- **Subir una factura** al movimiento crea automáticamente la entidad factura al otro lado, ya
  conciliada y con los datos del movimiento (fecha, importe, contacto).
- **Vincular una factura de la bandeja**: si la factura ya estaba subida en la sección Facturas,
  se elige de una lista de candidatas compatibles por importe pendiente.
- **Falta factura**: un movimiento no vinculado a ninguna factura se puede marcar a mano como
  "Falta factura" (checkbox en el detalle del movimiento). No todos los movimientos llevan
  factura (nóminas, comisiones bancarias…), así que la marca es manual, nunca automática. Los
  movimientos marcados muestran un icono de aviso en la lista y se pueden filtrar con el botón
  *Falta factura* en el panel de filtros de Movimientos.

{% hint style="warning" %}
🔐 Subir, editar o vincular facturas requiere rol **Tesorería** o **Gestor Central**. Con rol de
solo lectura puedes consultarlas, pero no modificarlas.
{% endhint %}

---

## Para el equipo técnico

Esta parte no es necesaria para el uso diario — documenta cómo está construida la sección por
dentro, útil si tocas código o preparas una integración.

### Modelo de datos

- Tabla `factura` (migración `scripts/047_create_factura.sql`, ampliada en
  `scripts/048_factura_pagos_multiples.sql`), con RLS por delegación (lectura: cualquier
  miembro; escritura: tesorero / gestor_central).
- Vínculo **1 factura → N movimientos** vía `movimiento.factura_id` (varios movimientos pueden
  apuntar a la misma factura; un movimiento, como mucho, a una). La función
  `recalcular_estado_factura()` y sus triggers mantienen `factura.estado` sincronizado con la
  suma de los movimientos vinculados (`pagada_parcial` / `pagada`), tanto al cambiar el vínculo
  como al editar el importe de la factura.
- `movimiento.factura_pendiente` (boolean, default `false`): marca manual e independiente del
  vínculo, para señalar movimientos a los que les falta subir/vincular su factura.
- Archivos en `archivo_adjunto` con `entidad='factura'` (bucket `facturas` de Storage). Al
  conciliar se replican en `movimiento_archivo` apuntando al mismo path.
- Los contactos (`contacto`) son una única tabla compartida por toda la app: el mismo proveedor
  usado en una factura aparece igual en movimientos, Pagos MCM y en la sección Contactos, sin
  duplicados. Un pequeño indicador ⚠️ (en el selector de contacto, en las tarjetas de factura y
  en la ficha de contacto) avisa cuando un proveedor no tiene NIF/CIF guardado.

### Integraciones futuras (estructura ya preparada)

La tabla `factura` ya incluye las columnas necesarias para estas dos integraciones: `origen`
(`subida | movimiento | email`), `email_remitente` y `datos_ia` (JSONB).

#### a) Buzón de email por delegación

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

#### b) Lectura automática con IA (rellenar datos básicos)

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
