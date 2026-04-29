# Mantenimiento de Next.js 16

Este documento reemplaza el antiguo plan de "upgrade" y deja una guía de mantenimiento para versiones 16.x.

## Estado actual
- El proyecto ya trabaja sobre Next.js 16.
- El objetivo ahora es mantener actualizaciones **menores/parches** sin romper flujos de negocio.

## Checklist recomendado por release

### 1) Preparación
- Asegura rama limpia (`git status`).
- Revisa changelog oficial de Next.js y React.
- Verifica versión de Node (`node -v`), recomendada: LTS actual (>= 20).

### 2) Actualización
```bash
pnpm up next react react-dom
```

### 3) Validación mínima
```bash
pnpm build
pnpm start
```

Validar manualmente:
- Login / logout.
- Alta/edición de movimientos.
- Filtros de movimientos.
- Dashboard.
- Cuentas y categorías.

### 4) Seguridad
- Revisar advisories de `next` y dependencias críticas.
- Si hay CVE relevante, priorizar parche aunque no haya features nuevas.

## Notas prácticas
- Si aparece un cambio mayor en la familia de Next/React, crear documento específico de migración para ese salto.
- Evitar usar `latest` sin revisión cuando se trate de producción.
