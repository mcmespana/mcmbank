# 🏦 MCM Bank

MCM Bank es una app web para llevar la administración económica de delegaciones del **Movimiento Consolación para el Mundo**.

Está pensada para equipos técnicos y no técnicos: registrar ingresos/gastos, consultar balances y exportar información de forma clara.

## 🚀 Inicio rápido
1. Clona el repositorio.
2. Usa Node.js 20 (`nvm use`).
3. Instala dependencias (`pnpm install`).
4. Configura `.env.local` con Supabase.
5. Ejecuta `pnpm dev` y abre `http://localhost:3000`.

## 📋 Requisitos
- **Node.js ≥ 20**
- **pnpm ≥ 8**
- **Proyecto de Supabase**

## 🛠️ Instalación
```bash
git clone https://github.com/mcmespana/mcmbank.git
cd mcmbank
nvm use
corepack enable
pnpm install
```

## 🔐 Variables de entorno
Crea `.env.local` en la raíz:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="tu-clave-anon"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL="http://localhost:3000/auth/callback"
```

> ⚠️ Este repositorio es público: no publiques secretos, tokens ni contraseñas en documentación o código.

## ▶️ Comandos útiles
```bash
pnpm dev      # desarrollo
pnpm build    # build producción
pnpm start    # servir build
```

## 🗳️ Regla de votaciones (Canon 119)
El sistema de votaciones sigue el criterio de **rondas sucesivas**:

- Se realiza una ronda de votación.
- Si uno o más candidatos alcanzan **mitad + 1** de los votos válidos en esa ronda, resultan elegidos.
- Si nadie alcanza esa mayoría, se abre una nueva ronda.
- Se repite hasta que exista ganador (o ganadores) con mayoría requerida.

> Ejemplo rápido: con 10 votos válidos, la mayoría necesaria es 6.

## 📚 Documentación (mapa completo)
### Manual funcional
- `docs/README.md`
- `docs/01-acceso.md`
- `docs/02-delegaciones.md`
- `docs/03-categorias.md`
- `docs/04-cuentas.md`
- `docs/05-movimientos.md`
- `docs/06-dashboard.md`
- `docs/07-diagnostico.md`

### Guías técnicas y operativas
- `docs/ENABLE_BANKING.md`
- `docs/OPTIMIZACIONES_REALIZADAS.md`
- `docs/OPTIMIZACIONES_PENDIENTES.md`
- `docs/FUTURE_DEVELOPMENTS.md`
- `docs/TAB_SWITCH_HANG_FIX.md`
- `docs/NEXTJS_16_UPGRADE.md`
- `SECURITY-AUDIT.md`

## 🤝 Contribuciones (simple y realista)
Si quieres hacer un fork y adaptarlo para otra entidad:

1. Crea una rama (`feat/...` o `fix/...`).
2. Cambia textos, branding y reglas internas según tu organización.
3. Actualiza la documentación funcional y técnica afectada.
4. Abre PR explicando qué cambiaste y cómo se valida.

Aunque no haya muchas contribuciones externas, dejar cambios pequeños y bien documentados facilita muchísimo mantener el proyecto en el tiempo.
