import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fija la raíz del workspace para que Turbopack no elija mal cuando hay
  // otros lockfiles en carpetas superiores (p. ej. uno suelto en el HOME).
  turbopack: {
    root: __dirname,
  },

  images: {
    unoptimized: true,
  },

  // El enrutador de Next ignora las carpetas que empiezan por punto, así que
  // los documentos `.well-known` de OAuth viven bajo /api/well-known y se
  // exponen desde aquí. Se publican también con el sufijo de la ruta del MCP
  // porque hay clientes que preguntan por
  // `/.well-known/oauth-protected-resource/api/mcp` (RFC 9728, §3.1).
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/well-known/oauth-authorization-server",
      },
      {
        source: "/.well-known/oauth-authorization-server/:path*",
        destination: "/api/well-known/oauth-authorization-server",
      },
      {
        source: "/.well-known/openid-configuration",
        destination: "/api/well-known/oauth-authorization-server",
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/well-known/oauth-protected-resource",
      },
      {
        source: "/.well-known/oauth-protected-resource/:path*",
        destination: "/api/well-known/oauth-protected-resource",
      },
    ]
  },

  // Cabeceras de seguridad básicas. No incluimos CSP a propósito: una política
  // estricta podría romper estilos/scripts y requiere un análisis aparte.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ]
  },
}

export default nextConfig
