# 9. Informes

El archivo y las memorias económicas de tu delegación, en un solo sitio.

📸 _Captura de la pantalla de Informes_

{% hint style="warning" %}
🔐 Añadir, generar o editar informes requiere rol **Gestor Central** o **Tesorería**. Con rol de solo lectura puedes consultar los informes ya publicados.
{% endhint %}

## Pestañas

{% tabs %}
{% tab title="Anuales" %}
La memoria económica del curso o año, con su histórico. Es la pestaña activa hoy.
{% endtab %}

{% tab title="Por actividad" %}
🚧 **Próximamente.** Todavía no está disponible: hoy solo existen los informes anuales.
{% endtab %}
{% endtabs %}

## Dos formas de archivar un informe

{% tabs %}
{% tab title="📤 Subir informe" %}
Para cuando el informe ya existe fuera de MCM Bank:

1. Elige periodicidad (Anual / Semestral / Trimestral) y tipo de periodo (Curso académico / Año natural).
2. Indica el curso o año, y el sub-periodo si aplica.
3. Sube un archivo (PDF, Word o Excel, máx. 25 MB) y/o pega un enlace de Google Drive.
4. Opcionalmente, anota el **Balance anual** y el **Disponible final de año** — se formatean solos mientras escribes.
5. Añade notas y guarda.

{% hint style="info" %}
Si ya había un enlace de Drive y añades otro, te preguntamos si quieres **mantener ambos** o **reemplazar el anterior**.
{% endhint %}
{% endtab %}

{% tab title="✨ Generar informe" %}
El asistente que crea la memoria económica desde cero en Google Sheets a partir de tus movimientos. Ver la sección siguiente.
{% endtab %}
{% endtabs %}

Cada informe muestra un estado que puedes cambiar tocándolo: **Pendiente → En desarrollo → Hecho → Revisado → Aprobado**.

---

## Generar la memoria económica (asistente en 3 pasos)

{% stepper %}
{% step %}
### 1. Periodo

Elige el tipo de periodo (curso académico o año natural) y el curso/año concreto.

Si es la primera vez, conecta tu cuenta de Google (botón **"Conectar Google"**). El archivo se creará en **"Mi unidad"** de esa cuenta — tendrás que moverlo a su carpeta definitiva después.

📸 _Captura del paso 1 del asistente_
{% endstep %}

{% step %}
### 2. Revisar y cuadrar

Se genera una copia de la plantilla con **6 capítulos**:

| Capítulo | Contenido |
|---|---|
| I | Saldos curso anterior |
| II | Ingresos por cuotas y subvenciones |
| III | Gastos de funcionamiento |
| IV | Actividades (hasta 20 líneas) |
| V | Campañas solidarias |
| VI | Otros |

Para cada fila eliges qué categoría de MCM Bank corresponde, y ves en vivo el importe de esa categoría en el periodo. En los capítulos IV, V y VI puedes **añadir filas** según necesites; los capítulos V y VI se pueden **desactivar por completo** con una casilla si no aplican ese año.

**Panel "Cuadre del ejercicio"**: siempre visible, muestra *Remanente anterior + Entradas − Salidas = Terminas con*, con un badge verde **"Cuadra al céntimo"** o ámbar **"Descuadre de X €"**.

{% hint style="warning" %}
Si el informe no cuadra, casi siempre es por una de estas tres causas:
1. Hay movimientos que ninguna fila recoge.
2. Un importe se cuenta dos veces (categoría madre y subcategoría en filas distintas).
3. El remanente inicial no coincide con el saldo real de tus cuentas.
{% endhint %}

Pulsa **"Conciliar movimientos"** para resolverlo: se abre un panel que agrupa los movimientos problemáticos —sin fila asignada, sin categoría, o contados dos veces— con acciones directas (añadirlos a un capítulo, recategorizarlos sin salir del panel, o marcarlos como revisados). Una barra de progreso ("X/Y conciliados") te dice cuánto queda, hasta el mensaje **"¡Todo conciliado!"**.

📸 _Captura del panel de conciliación_

Puedes **guardar como borrador** en cualquier momento y retomarlo más tarde, o pulsar **"Generar"** cuando esté todo listo.
{% endstep %}

{% step %}
### 3. ¡Listo!

Confirmamos que el archivo se guardó en tu Google Drive, repetimos si cuadra con el saldo real, y te damos un botón **"Abrir en Google Sheets"**.

Checklist final recomendada:
- [ ] Mover el archivo a su carpeta definitiva en Drive.
- [ ] Revisar y ajustar importes a mano si hace falta.
- [ ] Exportarlo a PDF.
- [ ] Subirlo de vuelta aquí (con **"Subir informe"**) para archivarlo junto al resto.
{% endstep %}
{% endstepper %}

{% hint style="success" %}
💡 Este asistente es justo lo que necesitas para preparar la memoria económica anual sin partir de una hoja en blanco.
{% endhint %}
