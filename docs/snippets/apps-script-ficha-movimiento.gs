/**
 * MCM Bank → Google Sheets + Drive: trae la ficha de un movimiento.
 *
 * Copia el ID del movimiento (se ve en su detalle) a la hoja y ejecuta
 * `traerFichasMcm()`. Por cada fila con ID rellena los datos del movimiento y su
 * factura y guarda los ficheros en una carpeta de Drive.
 *
 * Es un BORRADOR: las columnas de abajo son provisionales, se ajustan en COLUMNAS.
 *
 * Preparación (una sola vez): Extensiones → Apps Script → Configuración del
 * proyecto → Propiedades de la secuencia de comandos:
 *   MCM_BASE_URL   = https://TU-DOMINIO           (sin barra final)
 *   MCM_API_KEY    = la clave de solo lectura (MCM_API_KEY_READONLY basta)
 *   MCM_CARPETA_ID = id de la carpeta de Drive donde guardar los ficheros
 * La clave NO va en la hoja ni en el código: quien pueda ver el script la vería.
 */

// Números de columna (A = 1). 0 = no escribir ese dato.
const COLUMNAS = {
  id: 1,            // entrada: ID del movimiento
  fecha: 2,
  concepto: 3,
  importeMovimiento: 4,   // con signo, como en el banco
  proveedor: 5,
  nif: 6,
  numeroFactura: 7,
  fechaFactura: 8,
  importeFactura: 9,
  pendiente: 10,
  categoria: 11,
  delegacion: 12,
  ficheros: 13,     // enlaces a Drive, uno por línea
  estado: 14,       // "OK" o el motivo del fallo
}
const PRIMERA_FILA = 2 // la 1 es la cabecera

function traerFichasMcm() {
  const hoja = SpreadsheetApp.getActiveSheet()
  const ultima = hoja.getLastRow()
  if (ultima < PRIMERA_FILA) return

  const ids = hoja.getRange(PRIMERA_FILA, COLUMNAS.id, ultima - PRIMERA_FILA + 1, 1).getValues()
  const estados = hoja.getRange(PRIMERA_FILA, COLUMNAS.estado, ids.length, 1).getValues()
  const inicio = Date.now()

  for (let i = 0; i < ids.length; i++) {
    const id = String(ids[i][0]).trim()
    if (!id || estados[i][0] === "OK") continue // idempotente: no rehace lo hecho
    // Apps Script corta a los 6 min: paramos antes; se relanza y sigue donde lo dejó.
    if (Date.now() - inicio > 5 * 60 * 1000) break

    const fila = PRIMERA_FILA + i
    try {
      const ficha = pedirFicha_(id)
      volcarFicha_(hoja, fila, ficha)
      hoja.getRange(fila, COLUMNAS.estado).setValue("OK")
    } catch (err) {
      hoja.getRange(fila, COLUMNAS.estado).setValue(String(err.message || err).slice(0, 200))
    }
    SpreadsheetApp.flush()
  }
}

function pedirFicha_(id) {
  const props = PropertiesService.getScriptProperties()
  const base = props.getProperty("MCM_BASE_URL")
  const clave = props.getProperty("MCM_API_KEY")
  if (!base || !clave) throw new Error("Faltan MCM_BASE_URL / MCM_API_KEY en las propiedades del script.")

  const respuesta = UrlFetchApp.fetch(base + "/api/v1/movimientos/" + encodeURIComponent(id) + "/ficha", {
    headers: { "x-api-key": clave },
    muteHttpExceptions: true,
  })
  const cuerpo = JSON.parse(respuesta.getContentText())
  if (respuesta.getResponseCode() !== 200 || !cuerpo.ok) throw new Error(cuerpo.error || "HTTP " + respuesta.getResponseCode())
  return cuerpo.ficha
}

function volcarFicha_(hoja, fila, ficha) {
  const m = ficha.movimiento
  const f = ficha.factura
  const poner = (col, valor) => { if (col) hoja.getRange(fila, col).setValue(valor == null ? "" : valor) }

  poner(COLUMNAS.fecha, m.fecha)
  poner(COLUMNAS.concepto, m.concepto)
  poner(COLUMNAS.importeMovimiento, ficha.importes.movimiento)
  poner(COLUMNAS.proveedor, f && f.contacto ? f.contacto.nombre : m.contacto ? m.contacto.nombre : "")
  poner(COLUMNAS.nif, f && f.contacto ? f.contacto.identificador_fiscal : "")
  poner(COLUMNAS.numeroFactura, f ? f.numero : "")
  poner(COLUMNAS.fechaFactura, f ? f.fecha_emision : "")
  poner(COLUMNAS.importeFactura, ficha.importes.factura)
  poner(COLUMNAS.pendiente, ficha.importes.factura_pendiente)
  poner(COLUMNAS.categoria, m.categoria ? m.categoria.nombre : "")
  poner(COLUMNAS.delegacion, m.delegacion ? m.delegacion.nombre : "")

  if (COLUMNAS.ficheros) {
    const carpeta = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("MCM_CARPETA_ID"))
    const enlaces = ficha.archivos.map((a) => guardarEnDrive_(carpeta, a, m, f))
    poner(COLUMNAS.ficheros, enlaces.join("\n"))
  }
}

/** Descarga la URL firmada (no necesita la clave) y la guarda en Drive. */
function guardarEnDrive_(carpeta, archivo, movimiento, factura) {
  const proveedor = factura && factura.contacto ? factura.contacto.nombre : "sin-proveedor"
  const nombre = [movimiento.fecha, proveedor, movimiento.id.slice(0, 8), archivo.nombre_original]
    .join(" - ")
    .replace(/[\\/:*?"<>|]/g, "_")

  // Si ya se guardó en una ejecución anterior, se reutiliza en vez de duplicar.
  const existentes = carpeta.getFilesByName(nombre)
  if (existentes.hasNext()) return existentes.next().getUrl()

  const respuesta = UrlFetchApp.fetch(archivo.url_firmada, { muteHttpExceptions: true })
  if (respuesta.getResponseCode() !== 200) throw new Error("No se pudo bajar " + archivo.nombre_original)
  return carpeta.createFile(respuesta.getBlob().setName(nombre)).getUrl()
}
