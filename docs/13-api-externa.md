# 13. API externa (consulta de movimientos)

MCM Bank expone una pequeña API de solo lectura para consultar movimientos
desde otras aplicaciones internas (por ejemplo, un **Google Apps Script**).

{% hint style="info" %}
La idea es simple: copias el **ID de un movimiento** desde la aplicación y lo
consultas desde fuera para recibir toda su información y sus archivos adjuntos.
Como el ID es único en toda la base de datos, **no hace falta indicar la
delegación**.
{% endhint %}

## Documentación interactiva y recursos para agentes de IA

| Recurso | URL | Para qué |
|---------|-----|----------|
| **Documentación interactiva** | `https://TU-DOMINIO/docs/api` | Página web (Scalar) con "try it out". |
| **OpenAPI 3.1** | `https://TU-DOMINIO/api/v1/openapi.json` | Spec legible por máquinas (agentes IA, generadores de clientes). |
| **llms.txt** | `https://TU-DOMINIO/llms.txt` | Punto de entrada estándar para agentes de IA. |

Todos son públicos (no contienen secretos) y se sirven con URLs absolutas al
dominio actual.

## Autenticación

Todas las peticiones requieren una **clave secreta** que se envía en una
cabecera. Se acepta cualquiera de estas dos formas:

```
Authorization: Bearer TU_CLAVE
```

o bien:

```
x-api-key: TU_CLAVE
```

La clave se configura en el servidor mediante variables de entorno:

- `MCM_API_KEY` — variable dedicada (recomendada si quieres una clave separada).
- Si no está definida, se reutiliza `CRON_SECRET` (el secreto que ya usa el cron
  de sincronización bancaria).

{% hint style="warning" %}
Para rotar la clave, cambia el valor en las variables de entorno del proyecto
(Vercel) y vuelve a desplegar.
{% endhint %}

## Cómo obtener el ID de un movimiento

1. Abre **Transacciones** en la app.
2. Haz clic en un movimiento para abrir su detalle.
3. En la pestaña **Datos**, al final, verás **«ID del movimiento (API)»** con un
   botón **Copiar**.

## Endpoints

Base: `https://TU-DOMINIO/api/v1`

### 1. Movimiento completo (datos + archivos)

```
GET /api/v1/movimientos/{id}
```

Respuesta `200`:

```json
{
  "ok": true,
  "movimiento": {
    "id": "9f1c...",
    "fecha": "2026-05-21",
    "concepto": "Compra material oficina",
    "descripcion": null,
    "contraparte": "PAPELERIA XYZ",
    "importe": -42.5,
    "tipo": "gasto",
    "metodo": "tarjeta",
    "notas": null,
    "ignorado": false,
    "booking_date": "2026-05-21",
    "value_date": "2026-05-22",
    "origen_sync": "enablebanking",
    "creado_en": "2026-05-22T08:10:00.000Z",
    "cuenta": {
      "id": "...",
      "nombre": "Cuenta principal",
      "tipo": "banco",
      "banco_nombre": "CaixaBank",
      "iban": "ES12 ...."
    },
    "categoria": {
      "id": "...",
      "nombre": "Material oficina",
      "tipo": "gasto",
      "emoji": "📎",
      "color": "blue"
    },
    "delegacion": { "id": "...", "codigo": "MAD", "nombre": "Madrid" },
    "contacto": { "id": "...", "nombre": "Papelería XYZ", "tipo": "proveedor" },
    "archivos": [
      {
        "id": "...",
        "nombre_original": "factura.pdf",
        "tipo_mime": "application/pdf",
        "tamano_bytes": 102400,
        "es_factura": true,
        "descripcion": null,
        "bucket": "facturas",
        "url": "https://....supabase.co/storage/v1/object/public/facturas/...",
        "subido_en": "2026-05-22T08:12:00.000Z"
      }
    ]
  }
}
```

### 2. Solo archivos de un movimiento

```
GET /api/v1/movimientos/{id}/archivos
```

Respuesta `200`:

```json
{
  "ok": true,
  "movimiento_id": "9f1c...",
  "total": 1,
  "archivos": [
    {
      "id": "...",
      "nombre_original": "factura.pdf",
      "tipo_mime": "application/pdf",
      "tamano_bytes": 102400,
      "es_factura": true,
      "descripcion": null,
      "bucket": "facturas",
      "url": "https://....supabase.co/storage/v1/object/public/facturas/...",
      "subido_en": "2026-05-22T08:12:00.000Z"
    }
  ]
}
```

El campo `url` es una URL pública directa: puedes descargar el archivo con un
`GET` normal (sin cabecera de autenticación).

### Errores

| Código | Significado |
|--------|-------------|
| `400` | Falta el ID del movimiento. |
| `401` | Falta la clave o no es válida. |
| `404` | El movimiento no existe. |
| `500` | Error del servidor (o la API no está configurada). |

Formato de error:

```json
{ "ok": false, "error": "Movimiento no encontrado." }
```

## Ejemplos de uso

{% tabs %}
{% tab title="curl" %}
```bash
curl -H "x-api-key: TU_CLAVE" \
  https://TU-DOMINIO/api/v1/movimientos/9f1c0000-0000-0000-0000-000000000000
```
{% endtab %}

{% tab title="Google Apps Script" %}
```javascript
const BASE = "https://TU-DOMINIO/api/v1";
const API_KEY = "TU_CLAVE"; // mejor en PropertiesService

/** Devuelve el movimiento completo (datos + archivos). */
function getMovimiento(id) {
  const res = UrlFetchApp.fetch(`${BASE}/movimientos/${id}`, {
    method: "get",
    headers: { "x-api-key": API_KEY },
    muteHttpExceptions: true,
  });
  const body = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200 || !body.ok) {
    throw new Error(body.error || "Error consultando el movimiento");
  }
  return body.movimiento;
}

/** Descarga la primera factura de un movimiento a una carpeta de Drive. */
function descargarFacturas(id) {
  const mov = getMovimiento(id);
  mov.archivos.forEach((archivo) => {
    const blob = UrlFetchApp.fetch(archivo.url).getBlob();
    blob.setName(archivo.nombre_original);
    DriveApp.createFile(blob);
  });
}

function ejemplo() {
  const mov = getMovimiento("9f1c0000-0000-0000-0000-000000000000");
  Logger.log(`${mov.fecha} · ${mov.concepto} · ${mov.importe} €`);
}
```
{% endtab %}
{% endtabs %}

{% hint style="success" %}
Recomendación: guarda la clave con
`PropertiesService.getScriptProperties().getProperty("MCM_API_KEY")` en lugar
de escribirla directamente en el código.
{% endhint %}
