/** @type {import('next').NextConfig} */
const nextConfig = {

  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  // HTML and RSC payloads must never be cached — only hash-named static assets
  // (which Next.js auto-headers as immutable) should be. Vercel CDN was caching
  // the root HTML which led to stale chunk references after deploys.
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|woff|ttf|ico)).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
    ]
  },
}

export default nextConfig
