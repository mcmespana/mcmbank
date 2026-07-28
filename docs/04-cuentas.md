# 4. Cuentas

Aquí gestionas las cuentas bancarias y las cajas de efectivo de tu Delegación Local. Verás el saldo calculado según los movimientos registrados.

📸 _Captura del listado de cuentas_

## Crear una cuenta

1. Entra en **Cuentas** y pulsa **Nueva cuenta**.
2. Elige si es una cuenta bancaria o una caja de efectivo.
3. Añade nombre, IBAN (si procede), color y personas autorizadas.
4. En **"Tipo de conexión"** decide cómo entrarán los movimientos:
   - **Manual**: importas los movimientos desde Excel o los creas a mano (capítulo 6).
   - **Conectada (Enable Banking)**: el banco envía los movimientos solo, cada noche (ver más abajo).

## Editar o eliminar

- Usa los iconos ✏️ para editar o 🗑️ para borrar.
- Si copias el IBAN se marcará con un mensaje verde ✅.

{% hint style="success" %}
💡 Puedes usar colores para distinguir rápidamente cada cuenta en toda la app.
{% endhint %}

---

## Sincronización automática con el banco (Enable Banking)

Una cuenta **"Conectada"** no necesita que nadie importe nada: cada noche, MCM Bank pregunta al banco por los movimientos nuevos y los añade solo, evitando duplicados.

{% hint style="warning" %}
🔐 **Antes de conectar una cuenta, tiene que estar pre-autorizada en el panel de control de Enable Banking** ([enablebanking.com/cp](https://enablebanking.com/cp/)). Ese panel lo gestiona la **Junta de la Asociación Juvenil MCM** o el **equipo de desarrollo de MCM Bank** — no es algo que una delegación pueda hacer por su cuenta. Si tu banco no aparece en el desplegable o la conexión falla nada más empezar, avisa a administración antes de reintentarlo tú mismo.
{% endhint %}

### Conectar una cuenta paso a paso

{% stepper %}
{% step %}
### Marca la cuenta como "Conectada"

Edita la cuenta, elige **"Conectada (Enable Banking)"** como tipo de conexión y guarda.
{% endstep %}

{% step %}
### Pulsa "Conectar con el banco"

En la tarjeta de la cuenta aparece un icono morado 🔗. Al pulsarlo se abre un diálogo donde eliges:

- **País** (España, Portugal, Francia, Italia, Alemania).
- **Banco**, de una lista que carga en directo.
- **Tipo de cliente**: Empresa/Asociación (lo habitual) o Personal.
- **Días de consentimiento** y **desde cuándo** quieres importar movimientos.
{% endstep %}

{% step %}
### Autoriza en el banco

Te redirigimos a la web o app de tu banco. Apruebas con tu método de siempre (biometría, SMS…) y vuelves automáticamente a MCM Bank con un aviso de "Cuenta conectada correctamente".
{% endstep %}

{% step %}
### A partir de ahí, todo solo

Cada noche entran los movimientos nuevos. Un punto verde en el icono del banco indica que la conexión está activa.
{% endstep %}
{% endstepper %}

📸 _Captura del diálogo de conexión con el banco_

### Sincronizar, renovar o desconectar

| Icono | Acción | Qué hace |
|---|---|---|
| 🔄 verde | Sincronizar ahora | Fuerza una consulta inmediata al banco y muestra un log detallado de la operación (útil si algo falla). |
| 🔓 naranja | Desconectar | Revoca el permiso con el banco. Los movimientos ya importados se conservan; la cuenta pasa a manual. |

{% hint style="info" %}
Los permisos bancarios (PSD2) caducan cada 90-180 días según el banco. Cuando falten pocos días, verás un aviso ámbar o rojo en el **Panel de Control** (capítulo 10) con un botón **"Renovar conexión"** que te trae aquí a reconectar.
{% endhint %}

### Todas las cuentas del Sabadell, sincronizadas de serie

{% hint style="success" %}
🏦 Por defecto, **todas las cuentas del Banco Sabadell** las conecta el equipo de administración con Enable Banking en cuanto se dan de alta: no hace falta que la delegación haga nada, los movimientos entran solos cada noche desde el primer día. Si abres una cuenta nueva en Sabadell, simplemente avisa a administración para que la conecten.
{% endhint %}

Para otros bancos, sigue el flujo de conexión de más arriba (una vez que administración haya pre-autorizado tu banco en el panel de Enable Banking).
