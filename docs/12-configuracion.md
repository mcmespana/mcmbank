# 12. Configuración

El panel de administración de MCM Bank: delegaciones, usuarios y la plantilla de la memoria económica.

{% hint style="danger" %}
🔐 **Solo administradores.** Esta sección solo aparece en el menú lateral, y solo es accesible, para personas con rol **Gestor Central** en alguna delegación. El resto de usuarios no la ven.
{% endhint %}

📸 _Captura de la pantalla de Configuración_

## Plantilla memoria económica

Pega aquí el enlace o el ID de la hoja de Google Sheets que se usará como plantilla al **generar** memorias económicas (capítulo 9 → "Generar informe"). Si lo dejas vacío, se usa una plantilla por defecto.

1. Pega la URL o el ID en el campo.
2. Pulsa **"Guardar"**.
3. Comprueba el "ID efectivo" mostrado debajo para confirmar qué plantilla se está usando realmente.

{% hint style="info" %}
Este ajuste aplica a **toda la organización**, no solo a una delegación.
{% endhint %}

## Delegaciones

Tabla con todas las delegaciones (Nombre, Código, UUID, número de movimientos):

- **"Nueva delegación"**: nombre y código.
- **"Editar"**: cambia el nombre o el código de una delegación existente (el UUID es de solo lectura).

## Usuarios

Tabla con todas las personas con acceso (Mail, Rol, Delegaciones):

- **"Nuevo usuario"**: mail, nombre, contraseña, y qué delegaciones puede ver — marcando cada una con su rol correspondiente.
- **"Editar"**: cambia nombre, contraseña (opcional) o las delegaciones/roles asignados.
- **"Eliminar"**: borra el acceso de la persona.

### Roles disponibles

| Rol | Para qué sirve |
|---|---|
| **Gestor Central** | Acceso completo: administración, cuentas, categorías, movimientos, facturas, pagos MCM e informes. |
| **Tesorería** | Gestiona el día a día económico (movimientos, cuentas, facturas, pagos MCM, informes) sin acceder a Configuración. |
| **Solo Lectura** | Puede consultar todo, pero no crear ni editar nada. |

{% hint style="info" %}
Si una persona tiene el mismo rol en todas sus delegaciones, la tabla lo muestra directamente. Si tiene roles distintos según la delegación, verás **"múltiples"** — revisa su ficha de edición para ver el detalle.
{% endhint %}

{% hint style="danger" %}
🗑️ Eliminar un usuario no pide confirmación adicional: revisa bien antes de pulsar.
{% endhint %}

---

{% hint style="success" %}
¿Necesitas ayuda técnica que no cubre esta pantalla (estado de Supabase, errores de sincronización bancaria, etc.)? Contacta con el equipo de desarrollo de MCM Bank.
{% endhint %}
