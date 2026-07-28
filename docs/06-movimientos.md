# 6. Movimientos

Aquí registras todos los ingresos y gastos. Cada movimiento debe tener una cuenta y, lo antes posible, una categoría.

📸 _Captura de la tabla de movimientos_

## Añadir un movimiento

1. Desde cualquier página, usa **Acciones rápidas → Nueva Transacción** o el botón ➕ en Movimientos.
2. Completa concepto, importe (positivo para ingreso, negativo para gasto), fecha y cuenta.
3. Selecciona una categoría, y si quieres, un contacto (capítulo 5) y notas.
4. Guarda para que aparezca en la lista.

📸 _Captura del formulario de creación_

{% hint style="info" %}
📝 La app valida que los campos obligatorios estén completos antes de permitir guardar.
{% endhint %}

## Editar y adjuntar archivos

Toca cualquier movimiento de la lista para abrir su ficha detallada:

- Cambia la categoría, el contacto, la descripción o la fecha.
- Modifica el importe con confirmación.
- Adjunta archivos (facturas, justificantes, etc.) — si adjuntas una factura, se crea sola en **Facturas** (capítulo 7).
- Marca **"Falta factura"** si este movimiento debería llevar una y todavía no la tiene.

📸 _Captura de la ficha de movimiento_

{% hint style="success" %}
💾 Los cambios se guardan automáticamente después de unos segundos.
{% endhint %}

## Importar desde el banco

Si tienes muchos movimientos, puedes importarlos de una vez:

{% stepper %}
{% step %}
### Abre el importador

Pulsa **Importar** en Acciones rápidas o desde Movimientos.
{% endstep %}

{% step %}
### Elige cuenta y origen

Selecciona la cuenta destino y el formato del archivo.
{% endstep %}

{% step %}
### Sube el archivo y revisa

Arrastra el archivo, sigue el asistente y revisa los duplicados detectados antes de confirmar.
{% endstep %}
{% endstepper %}

{% tabs %}
{% tab title="🟦 Sabadell" %}
Exporta el extracto en Excel/CSV desde la banca online del Sabadell y súbelo tal cual — el importador reconoce su formato automáticamente.

{% hint style="success" %}
Si tu cuenta del Sabadell ya está **conectada con Enable Banking** (capítulo 4), no necesitas importar nada: los movimientos entran solos cada noche.
{% endhint %}
{% endtab %}

{% tab title="🟧 CaixaBank" %}
Igual que con Sabadell: exporta el extracto y súbelo, el importador reconoce el formato de CaixaBank.
{% endtab %}

{% tab title="✍️ Manual" %}
Para cualquier otro banco o una hoja propia: sube un CSV/Excel con tus propias columnas y mapéalas en el asistente.
{% endtab %}
{% endtabs %}

{% hint style="info" %}
⏱️ Después de importar refrescamos los datos automáticamente para que veas los nuevos movimientos al momento.
{% endhint %}

## Exportar a Excel

1. Abre la pantalla de **Movimientos**.
2. Pulsa el botón de **Descargar** ⬇️.
3. Se genera un Excel con los movimientos filtrados (respeta los filtros activos).
4. Si la descarga se completa verás un aviso en verde.

📸 _Captura del botón de exportar_

{% hint style="success" %}
📑 Este archivo te servirá para preparar informes o revisar movimientos con más calma.
{% endhint %}

## Filtros y búsquedas

En la parte superior de la pantalla de Movimientos tienes varias herramientas para encontrar lo que necesites:

- **Rango de fechas** 📅
- **Cuenta** 💳
- **Categoría** 🏷️
- **Importe** 💶
- **Texto libre** 🔍
- Botones para ver solo los movimientos **sin categoría** o con **factura pendiente**.

📸 _Captura de los filtros_

{% hint style="info" %}
🧹 Usa **Borrar filtros** para volver a ver todo.
{% endhint %}
