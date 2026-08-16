# Documentación de MCM Bank

Esto es el índice de la carpeta `docs/`. Hay dos cosas distintas aquí y conviene
no mezclarlas: **el manual**, que se escribe para quien lleva la tesorería de una
delegación, y **las notas técnicas**, que se escriben para quien toca el código.

## Manual de usuario

Vive entero en [`manual/`](manual/README.md), con su propio índice en
`manual/SUMMARY.md` (es lo que publica GitBook). Empieza por ahí si buscas cómo
se usa la aplicación.

| | |
|---|---|
| [1. Acceso](manual/1.-acceso.md) | Entrar, contraseña, perfil |
| [2. MCM Locales](manual/2.-mcm-locales.md) | Qué es una delegación y cómo se cambia de una a otra |
| [3. Categorías](manual/3.-categorias.md) | Actividades y categorías, globales y propias |
| [4. Cuentas](manual/4.-cuentas/README.md) | Bancos y cajas, y la [sincronización automática](manual/4.-cuentas/actualizacion-automatica-de-movimientos.md) |
| [5. Movimientos](manual/5.-movimientos.md) | El día a día: registrar, importar, filtrar, editar en lote |
| [6. Panel de control](manual/6.-dashboard.md) | Resumen, balance y análisis |
| [7. Contactos](manual/7.-contactos.md) | Proveedores, personas y destinatarios |
| [8. Facturas](manual/8.-facturas.md) | Bandeja, buzón de email, lectura con IA y conciliación |
| [9. Pagos MCM](manual/9.-pagos-mcm.md) | Pagos internos pendientes |
| [10. Informes anuales](manual/10.-informes-anuales.md) | La memoria económica del curso |
| [11. Avisos y tareas](manual/11.-avisos-y-tareas.md) | Notas entre la oficina técnica y las delegaciones |
| [20. Configuración](manual/20.-configuracion-solo-administradores.md) | Solo administradores |
| [21. API externa](manual/21.-api-externa-solo-pros.md) · [22. Servidor MCP](manual/22.-servidor-mcp.md) | Integraciones |

## Trabajo pendiente

- [**ANALISIS_MEJORAS.md**](ANALISIS_MEJORAS.md) — la lista única de lo que
  queda por hacer. Sin numerar, ordenada por prioridad. **Al terminar algo se
  borra de ahí**, no se marca.
- [ARCHIVO_MEJORAS.md](ARCHIVO_MEJORAS.md) — el análisis de 2026 completo, con
  su numeración original. **Congelado**: se conserva porque explica por qué se
  hizo cada cosa y contra qué se verificó. No añadas nada aquí.
- [OPTIMIZACIONES_REALIZADAS.md](OPTIMIZACIONES_REALIZADAS.md) — registro
  histórico de las optimizaciones de rendimiento. También congelado.

## Notas técnicas

Cada una explica una pieza que no cabía en `CLAUDE.md`.

| | |
|---|---|
| [ENABLE_BANKING.md](ENABLE_BANKING.md) | La sincronización con los bancos: consentimientos PSD2, cron nocturno |
| [FACTURAS_EMAIL_IA.md](FACTURAS_EMAIL_IA.md) | El buzón de facturas por delegación y la lectura con Gemini |
| [DESIGN_AUTO_CATEGORIZACION.md](DESIGN_AUTO_CATEGORIZACION.md) | Diseño de la auto-categorización (todavía sin construir) |
| [API_PRUEBA_RAPIDA.md](API_PRUEBA_RAPIDA.md) | Cómo probar la API externa en dos minutos |
| [CONFIG_GOOGLE_DRIVE.md](CONFIG_GOOGLE_DRIVE.md) | La cuenta de servicio que genera la memoria en Sheets |
| [NEXTJS_16_UPGRADE.md](NEXTJS_16_UPGRADE.md) | Qué cambió al subir a Next 16 |
| [TAB_SWITCH_HANG_FIX.md](TAB_SWITCH_HANG_FIX.md) | Por qué la app se colgaba al volver a la pestaña |

Las convenciones de arquitectura y las reglas que un cambio no debe romper están
en [`CLAUDE.md`](../CLAUDE.md), en la raíz del repositorio.
