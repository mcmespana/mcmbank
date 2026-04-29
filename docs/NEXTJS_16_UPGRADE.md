# Plan de Actualización a Next.js 16

Este documento detalla los pasos para actualizar la aplicación "MCM Bank" a Next.js 16 de forma segura y robusta.

## 1. Preparación Previa
- [ ] **Backup**: Asegurar que todo el código esté commiteado en git.
- [ ] **Verificar Node.js**: Next.js 16 requiere Node.js 18.17.0 o superior (se recomienda la última LTS, v20+).
    - Ejecutar `node -v` para verificar.

## 2. Actualización de Dependencias
Ejecutar el siguiente comando para actualizar Next.js, React y React DOM a las últimas versiones (incluyendo las RCs o estables de la v16 si ya están disponibles, o la última v15 preparando el terreno).
*Nota: Al momento de escribir esto, Next.js 15 es la estable. Para Next.js 16 (futuro), el proceso será similar.*

```bash
npm install next@latest react@latest react-dom@latest
# O si usas pnpm
pnpm up next react react-dom
```

Si hay cambios mayores (Major Version Upgrade):
```bash
npx @next/codemod@latest upgrade
```
Este comando automático ayuda a migrar configuraciones y código obsoleto.

## 3. Verificación de React 19
Next.js 15+ y 16 están muy ligados a React 19.
- Verificar en `package.json` que `react` y `react-dom` estén en la versión 19 (o RC).
- Revisar consola del navegador por "Hydration errors" o advertencias de deprecación de React.

## 4. Revisión de Breaking Changes Comunes
- **Caching por defecto**: En Next.js 15+, el caching de `fetch` cambió a `no-store` por defecto en muchos casos. Verificar que las llamadas a API (si las hay directas) tengan la configuración de caché deseada.
- **Async Request APIs**: `params`, `searchParams`, `headers`, `cookies` en Server Components ahora son asíncronos (`await params`).
    - **Acción**: Buscar en `app/**/*.tsx` usos de `params` o `searchParams` y asegurarse de que se esperen con `await` si el componente es asíncrono.

## 5. Validación y Pruebas
1.  **Build de Producción**: Ejecutar `npm run build`.
    - Esto es crítico para detectar errores de tipos y problemas que no salen en modo dev.
2.  **Prueba Manual**:
    - Navegar por el Dashboard.
    - Probar Login/Logout.
    - Crear una transacción de prueba.
3.  **Linting**: Ejecutar `npm run lint` para asegurar que no hay reglas nuevas violadas.

## 6. Despliegue
- Una vez verificado localmente con `npm run build` y `npm start`, proceder al despliegue en Vercel/Netlify.

---
**Nota Importante**: Si Next.js 16 aún está en fase Canary/Beta, se recomienda usar la bandera `@canary` con precaución en producción.
```bash
npm install next@canary
```
