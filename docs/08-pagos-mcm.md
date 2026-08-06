# 8. Pagos MCM

Apúntate los pagos internos que tienes que hacer (reembolsos a personas, ayudas, etc.). Ten a mano los IBAN, copia y pega para hacer las transferencias y, cuando estén hechas, vincula el movimiento bancario: el pago desaparecerá de la lista de pendientes.

{% hint style="info" %}
Un **Pago MCM** es una *promesa de pago pendiente*, no un movimiento bancario todavía. Es tu lista de "cosas que debo pagar" con seguimiento de estado, separada del extracto del banco, hasta que haces la transferencia real y la vinculas (o creas su movimiento).
{% endhint %}

📸 _Captura de la lista de Pagos MCM_

{% hint style="warning" %}
🔐 Crear, editar o marcar como pagado requiere rol **Gestor Central** o **Tesorería**. Con rol de solo lectura puedes consultar la lista, pero no modificarla.
{% endhint %}

## Estados

| Estado | Color | Significado |
|---|---|---|
| Borrador | Gris | A medio rellenar, sin confirmar todavía |
| Pendiente | Ámbar | Listo para pagar |
| Pagado | Verde | Ya tiene un movimiento bancario vinculado |
| Cancelado | Rosa | Descartado (solo visible en la pestaña "Todos") |

La lista se organiza en pestañas **Pendientes / Borradores / Pagados / Todos**, cada una con su contador, y filas densas (una por pago) en vez de tarjetas. Debajo del título, una línea de resumen muestra cuántos pagos están pendientes y su importe total.

## Crear un pago MCM

1. Pulsa **Nuevo pago MCM**.
2. Elige el **contacto** (¿a quién hay que pagar?) y escribe el **concepto**.
3. Elige cómo se calcula el importe:

{% tabs %}
{% tab title="Importe manual" %}
Escribes tú la cantidad directamente.
{% endtab %}

{% tab title="Gasolina · tickets" %}
Subes los tickets de gasolina como justificante y anotas el importe a mano.
{% endtab %}

{% tab title="Gasolina · €/km" %}
Indicas los kilómetros de un trayecto, marcas si es **ida y vuelta** (×2) y eliges un precio por km:

- **IVAJ** · 0,12 €
- **Mínimo** · 0,18 €
- **Máximo** · 0,20 €
- **Estándar** · 0,26 €
- **Personalizado**

El importe se calcula solo y se muestra en vivo.
{% endtab %}
{% endtabs %}

4. En **Detalles** (colapsado por defecto) puedes añadir una descripción detallada, una
   categoría sugerida y notas internas.
5. Guarda con uno de los dos botones del pie del formulario: **Guardar borrador** o
   **Guardar como pendiente**. No hay un selector de "Estado" aparte: son directamente los dos
   botones de guardar.

📸 _Captura del formulario de un pago MCM_

{% hint style="info" %}
No puedes marcar un pago como **Pagado** directamente desde el formulario: primero tiene que vincularse a un movimiento (ver siguiente sección).
{% endhint %}

## Marcar un pago como pagado

Cuando ya has hecho la transferencia (o vas a hacerla), pulsa **Marcar pagado** en la fila o en el
panel de detalle. Se abre un diálogo con un control segmentado con dos formas de resolverlo —
**Crear movimiento** o **Vincular existente** —, que arranca ya en la que toca: si hay un
movimiento con el importe exacto sin vincular, empieza en *Vincular existente*; si no, en
*Crear movimiento*.

**Crear movimiento**: eliges la cuenta de origen (por defecto, la más usada) y la fecha. MCM Bank crea un movimiento manual y lo vincula al pago.

{% hint style="warning" %}
Esto crea el movimiento **en MCM Bank**, no hace la transferencia en el banco — recuerda hacerla tú. Si más tarde importas el movimiento real del banco y ves un duplicado, elimínalo a mano.
{% endhint %}

**Vincular existente**: busca movimientos ya registrados con un importe parecido al del pago (con
un pelín de margen) que todavía no estén vinculados a ningún pago (los del mismo contacto
aparecen primero, marcados como "mismo contacto") y eliges el correcto.

## Modo transferencia (varios pagos seguidos)

Si tienes que hacer varias transferencias de una sentada, usa el botón **Modo transferencia** (con el contador de pagos pendientes que tienen IBAN). En móvil este botón y **Copiar IBANes** se agrupan en el menú **⋯** del encabezado.

Si antes seleccionas varios pagos con el checkbox de la fila, la barra de selección ofrece
**Modo transferencia** limitado sólo a esos; si no seleccionas nada, recorre todos los pendientes
con IBAN. Esa misma barra tiene también **Confirmar borradores** para pasar varios borradores a
pendiente de una vez.

{% hint style="warning" %}
Este asistente **no realiza transferencias de verdad**: sólo te ayuda a copiar los datos y, al
pulsar "Hecho", registra el pago como hecho en MCM Bank. La transferencia real la haces tú en la
app o web de tu banco.
{% endhint %}

{% stepper %}
{% step %}
### Copia los datos

Por cada pago verás beneficiario e importe, y tres líneas copiables con un clic: **IBAN**, **Importe** y **Concepto** (sugerido automáticamente).
{% endstep %}

{% step %}
### Haz la transferencia en tu banco

Pega los datos copiados en la app o web de tu banco.
{% endstep %}

{% step %}
### Marca el resultado

- **"Hecho"** → marca el pago como pagado y crea su movimiento (o `Enter`).
- **"Saltar"** → pasa al siguiente sin tocar este pago (o flecha derecha).

La cuenta de origen y la fecha elegidas se mantienen entre pasos, con una barra de progreso "Pago X de Y".
{% endstep %}
{% endstepper %}

📸 _Captura del modo transferencia_

## Otras acciones

- **Copiar IBAN**: cada fila tiene su propio botón de copia, siempre visible (no hace falta pasar el ratón).
- **Copiar IBANes pendientes**: copia en varios formatos todos los IBAN de los pagos pendientes de una vez.
- **Desvincular**: si un pago ya pagado se vinculó al movimiento equivocado, puedes desvincularlo (vuelve a quedar pendiente).
- **Duplicar**: crea un pago nuevo con los mismos datos, para repetir un gasto habitual sin volver a escribirlo todo.
- **Cancelar**: descarta un pago sin eliminarlo (pasa a la pestaña "Todos" con estado Cancelado).
- **Editar** / **Eliminar** un pago desde el menú **⋯** de la fila o del panel de detalle.

{% hint style="success" %}
💡 El badge junto a **Pagos MCM** en el menú lateral muestra siempre cuántos pagos están **pendientes** en tu delegación activa.
{% endhint %}
