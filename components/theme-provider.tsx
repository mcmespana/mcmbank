'use client'

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, storageKey = 'mcmbank-theme', ...props }: ThemeProviderProps) {
  // No usamos un guard `mounted`: next-themes inyecta un script que fija la
  // clase de tema en <html> ANTES del primer pintado, evitando el flash. Si
  // retrasáramos el render del provider hasta montar en cliente, ese script no
  // se emitiría en el SSR y volvería el parpadeo. El <html> ya lleva
  // suppressHydrationWarning en app/layout.tsx para cubrir el desajuste.
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey={storageKey}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
