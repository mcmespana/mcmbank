# API externa · prueba rápida (5 minutos)

Guía mínima para dejar la API externa funcionando con su propia clave y
comprobar que responde. Referencia completa: `docs/manual/21.-api-externa-solo-pros.md`.

## 1. Genera una clave

En tu terminal (o pídesela a alguien que tenga una):

```bash
openssl rand -hex 32
```

Copia el resultado, algo como `a1b2c3...` (64 caracteres).

## 2. Ponla en Vercel

1. Vercel → tu proyecto → **Settings → Environment Variables**.
2. Nombre: `MCM_API_KEY`. Valor: la clave del paso 1. Entornos: **Production**
   (y Preview si quieres probar antes).
3. **Save** → luego **Deployments → ⋯ → Redeploy** (las env vars no aplican
   solas, hace falta un redeploy).

{% hint style="warning" %}
Si no pones `MCM_API_KEY`, la API sigue funcionando pero con la clave del
cron bancario (`CRON_SECRET`) — mejor tener la suya propia, más aislada.
{% endhint %}

## 3. Consigue un ID de movimiento para probar

En la app: **Transacciones → clic en cualquier movimiento → pestaña Datos →
"ID del movimiento (API)" → Copiar**.

## 4. Un curl y ya

```bash
curl -H "x-api-key: TU_CLAVE" \
  https://TU-DOMINIO/api/v1/movimientos/EL_ID_QUE_COPIASTE
```

## 5. ¿Funciona?

| Ves esto | Significa |
|---|---|
| `{"ok": true, "movimiento": {...}}` | ✅ Todo correcto, ya puedes construir sobre esto |
| `{"ok": false, "error": "No autorizado..."}` (401) | Clave mal copiada, o no has hecho redeploy tras guardarla |
| `{"ok": false, "error": "Movimiento no encontrado."}` (404) | El ID no existe o lo copiaste mal |
| `{"ok": false, "error": "...no está configurada..."}` (500) | Ni `MCM_API_KEY` ni `CRON_SECRET` están puestas en Vercel |

Con eso confirmado, la referencia completa (`docs/manual/21.-api-externa-solo-pros.md`)
tiene el resto: todos los campos de la respuesta, el endpoint de solo
archivos, y un ejemplo listo para pegar en Google Apps Script.
