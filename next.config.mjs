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

  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
