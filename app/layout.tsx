import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AppProviders } from "@/contexts/app-providers"
import "./globals.css"

// Force dynamic rendering. HAR analysis showed the root HTML was returned with
// x-vercel-cache: HIT, meaning Vercel CDN was serving cached HTML. After a new
// deploy the cached HTML's embedded RSC payload could reference outdated chunk
// hashes, leading to silent JS init failure (F5 looked broken; Ctrl+F5
// eventually missed the cache and loaded fresh HTML — that's why the user
// "needed to clear cache many times until by chance it worked").
export const dynamic = "force-dynamic"
export const revalidate = 0

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "MCM Bank",
  description: "Sistema de tesorería para MCM Locales",
  generator: "v0.app",
  appleWebApp: {
    title: "MCM Bank",
    statusBarStyle: "default",
    capable: true,
  },
  manifest: "/site.webmanifest",
  icons: [
    {
      rel: "icon",
      url: "/favicon.ico",
      sizes: "any",
    },
    {
      rel: "icon",
      url: "/favicon.svg",
      type: "image/svg+xml",
    },
    {
      rel: "apple-touch-icon",
      url: "/apple-touch-icon.png",
      sizes: "180x180",
    },
    {
      rel: "icon",
      url: "/favicon-96x96.png",
      sizes: "96x96",
      type: "image/png",
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${geist.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-title" content="MCM Bank" />
        <meta name="application-name" content="MCM Bank" />
        <meta name="theme-color" content="#0b42db" />
        <meta name="msapplication-TileColor" content="#0b42db" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
        <Analytics />
      </body>
    </html>
  )
}
