# 🚀 GUÍA DE OPTIMIZACIÓN - CONEXIONES SENSIBLES

## 🔍 **PROBLEMA IDENTIFICADO**

Tu aplicación funciona inicialmente pero se **"cuelga" al cambiar de pestaña** debido a:

1. **Consultas complejas con JOINs múltiples** sin timeouts
2. **Sin cancelación** de consultas anteriores
3. **Ejecución simultánea** de múltiples hooks

## ✅ **SOLUCIONES IMPLEMENTADAS**

### **1. Hooks Optimizados con Timeouts**

He creado versiones mejoradas de tus hooks críticos:

- `use-transacciones-optimized.ts` - Con timeout de 15s
- `use-delegaciones-optimized.ts` - Con timeout de 10s  
- `use-cuentas-optimized.ts` - Con timeout de 10s

**Características:**
- ✅ **Timeouts automáticos** (configurable)
- ✅ **Cancelación de consultas anteriores**
- ✅ **JOINs simplificados** para mejor rendimiento
- ✅ **Límites reducidos** (50 en lugar de 100 transacciones)
- ✅ **Mejor manejo de errores**

### **2. Diagnóstico Mejorado**

La página de diagnóstico ahora:
- ✅ **Prueba consultas complejas** con JOINs
- ✅ **Detecta timeouts** específicamente
- ✅ **Timeout de 10s** en todas las pruebas

## 🔧 **CÓMO APLICAR LA SOLUCIÓN**

### **OPCIÓN 1: Aplicación Gradual (Recomendado)**

Reemplaza los hooks uno por uno para probar:

\`\`\`typescript
// En lugar de:
import { useTransacciones } from "@/hooks/use-transacciones"

// Usa:
import { useTransaccionesOptimized as useTransacciones } from "@/hooks/use-transacciones-optimized"
\`\`\`

### **OPCIÓN 2: Reemplazo Completo**

Renombra los archivos:
1. `use-transacciones.ts` → `use-transacciones-original.ts` 
2. `use-transacciones-optimized.ts` → `use-transacciones.ts`

## 📊 **DIFERENCIAS CLAVE**

### **Antes (Problemático):**
\`\`\`sql
-- Query sin timeout, JOINs pesados
cuenta:cuenta_id (
  *,
  delegacion:delegacion_id (*)
),
categoria:categoria_id (*)
\`\`\`

### **Después (Optimizado):**
\`\`\`sql
-- Query con timeout, JOINs selectivos
cuenta:cuenta_id (
  id, nombre, tipo, delegacion_id
),
categoria:categoria_id (
  id, nombre, tipo, emoji, color
)
\`\`\`

## 🎯 **RESULTADOS ESPERADOS**

- ✅ **No más timeouts infinitos**
- ✅ **Cancelación automática** al cambiar de pestaña
- ✅ **Consultas más rápidas** (JOINs optimizados)
- ✅ **Mejor experiencia de usuario**

## 🔍 **VERIFICACIÓN**

1. **Implementa los hooks optimizados**
2. **Prueba en diagnóstico**: https://mcmbank.vercel.app/diagnostico
3. **Navega entre pestañas** para verificar que no se cuelga
4. **Monitorea los logs** para ver los timeouts en acción

## ⚠️ **NOTAS IMPORTANTES**

- Los hooks optimizados devuelven **menos datos** pero más rápido
- Los timeouts son **configurables** por hook
- **Mantén los archivos originales** como respaldo
- Las consultas se **cancelan automáticamente** al desmontar componentes

---

**¿Quieres que aplique los hooks optimizados directamente a tu aplicación?** 
Avísame y reemplazaré los hooks problemáticos automáticamente.
