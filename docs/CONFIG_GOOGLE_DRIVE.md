# 🔌 Conectar MCM Bank con Google Drive

Guía exprés para activar la **generación de memorias económicas** (duplicar la plantilla en Google Sheets y guardarla en tu Drive).

> ⏱️ Son ~10 minutos. Hazlo una sola vez. Sigue los pasos en orden y no te saltes ninguno 😉

---

## 🧭 0. Antes de empezar

- Usa una cuenta **`@movimientoconsolacion.com`** (sois Workspace → esto nos ahorra la verificación de Google 🙌).
- Ten a mano el [Google Cloud Console](https://console.cloud.google.com/) y entra con esa cuenta.
- Vas a reutilizar el **mismo proyecto** de Google Cloud que ya tienes.

---

## 🟦 1. Pantalla de consentimiento → **Internal**

📍 *APIs y servicios → Pantalla de consentimiento de OAuth*

1. Tipo de usuario: marca **Internal / Interno**. ✅
2. Rellena nombre de la app (ej. `MCM Bank`), correo de soporte y correo del desarrollador.
3. Guarda.

> 💡 Al ser **Internal**, Google **NO** te pide verificación aunque pidamos permisos de Drive. Magia. ✨

---

## 🟩 2. Activa las dos APIs

📍 *APIs y servicios → Biblioteca*

Busca y pulsa **Habilitar** en cada una:

- 📄 **Google Drive API**
- 📊 **Google Sheets API**

---

## 🟨 3. Crea las credenciales OAuth

📍 *APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth*

1. Tipo de aplicación: **Aplicación web**. 🌐
2. Nombre: `MCM Bank Web`.
3. En **URIs de redirección autorizados**, añade estas dos exactamente:

```
http://localhost:3000/api/google/callback
https://TU-DOMINIO/api/google/callback
```

   👉 Cambia `TU-DOMINIO` por tu dominio real de producción (ej. el de Vercel).

4. Crea y **copia** el `Client ID` y el `Client secret`. 🔑

---

## 🟪 4. Comparte la plantilla 📋

Abre la plantilla de la memoria económica en Google Sheets y pulsa **Compartir**:

- Comparte con **todo el dominio `movimientoconsolacion.com`** como **Lector**. 👀

> 💡 Esto permite que cualquier usuario interno pueda **duplicarla** a su propio Drive al generar su memoria.

La plantilla por defecto es:
`1GfIWcOiJEj90Y7r_6CK8qmMrcq1lPyDi5kG0sjSWDnA`
(puedes cambiarla en la app: **Configuración → Plantilla memoria económica**).

---

## ⚙️ 5. Variables de entorno

Añádelas en tu `.env.local` (local) y en **Vercel → Settings → Environment Variables** (producción):

```bash
# Google OAuth (Drive + Sheets)
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."

# Clave para cifrar los refresh tokens en la BBDD (32 bytes en hex).
# Genérala con:  openssl rand -hex 32
GOOGLE_TOKEN_ENCRYPTION_KEY="pega_aqui_64_caracteres_hex"

# Opcionales (tienen valor por defecto):
# GOOGLE_OAUTH_REDIRECT_URI="https://TU-DOMINIO/api/google/callback"  # si no, se deduce de NEXT_PUBLIC_SITE_URL
# GOOGLE_MEMORIA_TEMPLATE_ID="1GfIWcOiJEj90Y7r_6CK8qmMrcq1lPyDi5kG0sjSWDnA"
```

> 🔒 `GOOGLE_TOKEN_ENCRYPTION_KEY` es secreta. Si se rota, todos tendrán que volver a conectar Google.
> ✅ La autenticación de Supabase **no se toca**: esto es independiente.

---

## ▶️ 6. Probar

1. Reinicia el servidor (`pnpm dev`) para cargar las variables.
2. Entra en **Informes → Generar informe**.
3. Pulsa **Conectar Google** y autoriza con tu cuenta interna.
4. Elige periodo, revisa el mapeo y pulsa **Generar**. 🎉

El archivo aparecerá en **Mi unidad** de tu Drive. Muévelo a su carpeta, revísalo, expórtalo a PDF y súbelo a la app.

---

## 🆘 Problemas típicos

| Síntoma | Causa | Solución |
|--------|-------|----------|
| `redirect_uri_mismatch` | La URI de redirección no coincide | Revisa el paso 3: debe ser **exacta**, con `https`/`http` y sin barra final |
| "Google no devolvió refresh_token" | Ya habías autorizado antes | Ve a [permisos de tu cuenta Google](https://myaccount.google.com/permissions), quita el acceso a la app y vuelve a conectar |
| No encuentra/copia la plantilla | No está compartida | Repite el paso 4 (compartir con el dominio) |
| "Faltan GOOGLE_CLIENT_ID..." | Variables sin cargar | Revisa `.env.local` y reinicia el server |
