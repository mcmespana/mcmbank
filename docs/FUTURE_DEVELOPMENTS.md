# Futuros Desarrollos y Optimizaciones

## Rendimiento y Escalabilidad

### Optimización del Dashboard Financiero
**Prioridad:** Alta (cuando aumente el volumen de datos)
**Estado:** Pendiente
**Descripción:**
Actualmente, el componente `FinancialSummary` (`components/dashboard/financial-summary.tsx`) carga **todos** los movimientos históricos para calcular los totales de ingresos, gastos y balance.
```typescript
const { movimientos } = useMovimientos(..., { pageSize: 0 }) // Carga TODO
```
**Problema:** Esto causará problemas de rendimiento (lentitud, alto consumo de memoria) a medida que crezca el número de transacciones.
**Solución Propuesta:**
1.  Crear una función RPC en Supabase (PostgreSQL) o un endpoint de API que devuelva solo los datos agregados necesarios (suma de ingresos, suma de gastos, conteo).
2.  Modificar el frontend para consumir este endpoint en lugar de descargar todos los registros.

---
*Este documento sirve para rastrear deuda técnica compleja y optimizaciones futuras que no bloquean el desarrollo actual pero deben abordarse a largo plazo.*
