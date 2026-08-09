# API externa y MCP · prueba rápida (5 minutos)

Guía mínima para dejar la API externa (y el servidor MCP, que usa la misma
clave) funcionando y comprobar que responde. Referencia completa:
`docs/manual/21.-api-externa-solo-pros.md` y `docs/manual/22.-servidor-mcp.md`.

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
3. Si además vas a **escribir** desde fuera (crear avisos, subir facturas,
   conciliar), añade `MCM_API_USER_EMAIL` con el correo de la cuenta de MCM Bank
   que debe figurar como autora.
4. **Save** → luego **Deployments → ⋯ → Redeploy** (las env vars no aplican
   solas, hace falta un redeploy).

{% hint style="warning" %}
Si no pones `MCM_API_KEY`, la API sigue respondiendo consultas con la clave del
cron bancario (`CRON_SECRET`), pero **cualquier escritura devolverá 403**.
Mejor tener la suya propia, más aislada.
{% endhint %}

## 3. Comprueba que lee

Nada que copiar de la app: pide la lista de delegaciones.

```bash
curl -H "x-api-key: TU_CLAVE" https://TU-DOMINIO/api/v1/delegaciones
```

| Ves esto | Significa |
|---|---|
| `{"ok": true, "total": 18, "delegaciones": [...]}` | ✅ Todo correcto |
| `{"ok": false, "error": "No autorizado..."}` (401) | Clave mal copiada, o no has hecho redeploy tras guardarla |
| `{"ok": false, "error": "...no está configurada..."}` (500) | Ni `MCM_API_KEY` ni `CRON_SECRET` están puestas en Vercel |

## 4. Comprueba que busca

```bash
curl -H "x-api-key: TU_CLAVE" \
  "https://TU-DOMINIO/api/v1/movimientos?tipo=gasto&importe_min=100&limite=5"
```

Debe devolver hasta 5 gastos de más de 100 € de **todas** las delegaciones, más
un bloque `resumen` con el total del conjunto completo.

## 5. Comprueba el MCP

```bash
curl -s -X POST https://TU-DOMINIO/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_CLAVE" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 300
```

Si sale una lista de herramientas (`buscar_movimientos`, `crear_aviso`…), ya
puedes conectarlo a Claude:

```bash
claude mcp add --transport http mcm-bank https://TU-DOMINIO/api/mcp \
  --header "Authorization: Bearer TU_CLAVE"
```

## 6. Y si quieres escribir

```bash
curl -X POST -H "x-api-key: TU_CLAVE" -H "Content-Type: application/json" \
  -d '{"delegacion":"NOMBRE_DE_UNA_DELEGACION","contenido":"Prueba de la API"}' \
  https://TU-DOMINIO/api/v1/avisos
```

| Ves esto | Significa |
|---|---|
| `{"ok": true, "aviso": {...}}` | ✅ La escritura funciona (borra el aviso desde la app) |
| `403 ... clave es de solo lectura` | Estás usando `CRON_SECRET` o la clave de solo lectura |
| `500 ... Define la variable de entorno MCM_API_USER_ID` | Falta `MCM_API_USER_EMAIL` en Vercel (paso 2.3) |

Con eso confirmado, la referencia completa
(`docs/manual/21.-api-externa-solo-pros.md`) tiene el resto: todos los
endpoints, la conciliación en bloque y ejemplos para Google Apps Script.
