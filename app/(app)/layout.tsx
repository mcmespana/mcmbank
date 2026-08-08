import type React from "react"
import { AppLayout } from "@/components/app-layout"

/**
 * Layout compartido de la app autenticada (todo menos `/auth` y `/docs`).
 *
 * Antes cada `page.tsx` montaba su propio `<AppLayout>`, y su `loading.tsx`
 * montaba otro: navegar entre secciones desmontaba y remontaba la barra
 * lateral, la barra superior y el widget de avisos, y el skeleton de ruta
 * sustituía la pantalla entera en vez del contenido. Con el layout aquí, el
 * `loading.tsx` de cada segmento solo reemplaza a `{children}`: la chrome se
 * queda quieta y el skeleton aparece dentro, que es lo que hace que el
 * streaming de rutas se note como tal.
 */
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
