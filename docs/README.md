# 0. Manual de MCM Bank

Bienvenido 👋. Esta guía explica el uso de MCM Bank para las delegaciones del **Movimiento Consolación para el Mundo** de forma sencilla y práctica.

## ¿Para qué sirve?
- Registrar ingresos y gastos.
- Ordenar movimientos por categorías.
- Consultar balances y paneles de control.
- Exportar datos para memorias económicas.

> ☁️ Los datos se guardan en la nube (Supabase). No necesitas entrar a banca online para usar el día a día de la app.

## Índice rápido (funcional)
- [1. Acceso](./01-acceso.md)
- [2. Delegaciones Locales](./02-delegaciones.md)
- [3. Categorías](./03-categorias.md)
- [4. Cuentas](./04-cuentas.md)
- [5. Movimientos](./05-movimientos.md)
- [6. Panel de control](./06-dashboard.md)
- [7. Centro de diagnóstico](./07-diagnostico.md)

## Anexos técnicos
- [Integración Enable Banking](./ENABLE_BANKING.md)
- [Optimizaciones realizadas](./OPTIMIZACIONES_REALIZADAS.md)
- [Optimizaciones pendientes](./OPTIMIZACIONES_PENDIENTES.md)
- [Futuros desarrollos](./FUTURE_DEVELOPMENTS.md)
- [Fix de cuelgues al cambiar pestaña](./TAB_SWITCH_HANG_FIX.md)
- [Mantenimiento Next.js 16](./NEXTJS_16_UPGRADE.md)

## Regla de votaciones (Canon 119)
Cuando la entidad use el módulo de votaciones, se aplica el criterio de rondas:

1. Se vota por ronda.
2. Gana el candidato (o candidatos) que consiga **mitad + 1** de votos válidos de esa ronda.
3. Si no hay mayoría, se hace otra ronda.

Ejemplo: con 21 votos válidos, la mayoría es 11.

---

Si detectas un error en la documentación, abre una issue o PR corto indicando:
- qué página corregiste,
- qué problema había,
- y cómo validaste el cambio.
