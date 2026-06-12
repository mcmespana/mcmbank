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
}

export default nextConfig
