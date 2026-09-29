/**
 * MCM Bank → Google Sheets + Drive.
 *
 * Adaptación de los dos scripts de Holded (`procesarDocumentosMcm` y
 * `descargarArchivosPorCodigoMcm`): misma hoja, mismas columnas, mismo flujo. Lo
 * único que cambia es de dónde salen los datos: en vez de Holded, la ficha de
 * un movimiento de MCM Bank (`GET /api/v1/movimientos/{id}/ficha`).
 *
 *   1. procesarDocumentosMcm()          rellena total, CIF, fechas y descripción y
 *                                    deja "Pendiente" en la columna de archivo.
 *   2. descargarArchivosPorCodigoMcm()  para las filas en "Pendiente", guarda el
 *                                    documento en Drive con el código A.X.Y. Si el
 *                                    movimiento tiene varios archivos, los une
 *                                    en un solo PDF.
 *
 * Convive con los de Holded en el mismo proyecto: todo lo de aquí lleva sufijo
 * `Mcm` (y CONFIG_MCM) para no pisar sus funciones ni su CONFIG.
 *
 * La columna AC (29) ya no lleva el ID de Holded sino el ID del MOVIMIENTO, que
 * se copia del detalle del movimiento en MCM Bank.
 *
 * Preparación (una vez): rellena las cuatro líneas marcadas con ✏️ en CONFIG_MCM.
 * La clave puede (y conviene que sea) la de SOLO LECTURA: MCM_API_KEY_READONLY.
 * OJO: la clave queda escrita en el script; quien pueda editar este Sheet la ve.
 */

// ============================================
// CONFIG_MCM
// ============================================
const CONFIG_MCM = {
  // ✏️ Rellena estas cuatro
  BASE_URL: 'https://banco.movimientoconsolacion.com', // sin barra final; confirma que es tu dominio
  API_KEY: 'PEGA_AQUI_LA_CLAVE_DE_MCM_BANK',           // MCM_API_KEY_READONLY
  CARPETA_DRIVE_ID: 'PEGA_AQUI_EL_ID_DE_LA_CARPETA',   // carpeta raíz de facturas en Drive
  BBDD_PROVEEDORES_ID: '',                             // opcional: id del Sheet "BBDD Proveedores y CIF"

  FILA_INICIO: 2, // Primera fila con datos (después del encabezado)

  // Índices de columnas (A = 1)
  COLUMNAS: {
    ID_MOVIMIENTO: 29,    // AC  (antes: ID de Holded)
    TOTAL: 6,             // F   total factura
    NOMBRE_ACTIVIDAD: 3,  // C
    CODIGO_FACTURA: 4,    // D   A.X.Y
    FECHA_FACTURA: 21,    // U
    FECHA_PAGO: 23,       // W
    CIF: 25,              // Y
    DESCRIPCION: 9,       // I
    ARCHIVO: 12,          // L   "Pendiente" → URL de Drive
  },

  BBDD_PROVEEDORES_HOJA: 'BBDD Proveedores y CIF',

  // Apps Script corta a los 6 minutos: paramos antes y se relanza.
  MAX_MS: 5 * 60 * 1000,

  // Para unir varios archivos en un PDF. Versión fija Y huella comprobada antes
  // de ejecutarla: es código de terceros corriendo con acceso a tu Drive.
  PDFLIB_URL: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  PDFLIB_SHA256: '0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f',
};

// ============================================
// 1) TRAER DATOS
// ============================================
function procesarDocumentosMcm() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ultimaFila = hoja.getLastRow();
  const C = CONFIG_MCM.COLUMNAS;

  if (ultimaFila < CONFIG_MCM.FILA_INICIO) {
    SpreadsheetApp.getUi().alert('No hay documentos para procesar');
    return;
  }

  const inicio = Date.now();
  let procesados = 0;
  let errores = 0;

  for (let fila = CONFIG_MCM.FILA_INICIO; fila <= ultimaFila; fila++) {
    if (Date.now() - inicio > CONFIG_MCM.MAX_MS) break;

    const idMovimiento = String(hoja.getRange(fila, C.ID_MOVIMIENTO).getValue()).trim();
    const totalActual = hoja.getRange(fila, C.TOTAL).getValue(); // F

    // SOLO: hay ID + F (total) está vacío
    if (idMovimiento && (totalActual === '' || totalActual === null)) {
      try {
        Logger.log(`Procesando fila ${fila}: ${idMovimiento}`);
        const ficha = pedirFicha_(idMovimiento);
        const factura = ficha.factura;
        if (!factura) throw new Error('El movimiento no tiene factura vinculada');

        const contacto = factura.contacto || {};
        const cif = contacto.identificador_fiscal || '';
        if (cif) actualizarBBDDProveedoresMcm(cif, contacto.nombre || '');

        // Total: el de la factura; si no tiene importe, lo que salió del banco.
        const total = ficha.importes.factura != null ? ficha.importes.factura : ficha.importes.movimiento_abs;

        hoja.getRange(fila, C.TOTAL).setValue(total);                                   // F
        hoja.getRange(fila, C.CIF).setValue(cif);                                       // Y
        hoja.getRange(fila, C.FECHA_FACTURA).setValue(fechaEs_(factura.fecha_emision)); // U
        hoja.getRange(fila, C.FECHA_PAGO).setValue(fechaEs_(ultimaFechaPago_(ficha)));  // W

        const celdaDesc = hoja.getRange(fila, C.DESCRIPCION); // I
        celdaDesc.setValue(factura.concepto || ficha.movimiento.concepto || '');
        const categoria = ficha.movimiento.categoria ? ficha.movimiento.categoria.nombre : '';
        celdaDesc.setNote(categoria ? `Categoría: ${categoria}` : ''); // antes: tags de Holded

        hoja.getRange(fila, C.ARCHIVO).setValue('Pendiente'); // L

        procesados++;
        SpreadsheetApp.flush();
      } catch (error) {
        Logger.log(`Error en fila ${fila}: ${error}`);
        hoja.getRange(fila, C.TOTAL).setValue('ERROR'); // marca en F
        hoja.getRange(fila, C.TOTAL).setNote(String(error.message || error));
        errores++;
      }
    }
  }

  SpreadsheetApp.getUi().alert(
    `✅ Proceso completado\n\nDocumentos procesados: ${procesados}\nErrores: ${errores}`
  );
}

// ============================================
// 2) DESCARGAR EL ARCHIVO A DRIVE POR CÓDIGO
// ============================================
// async: unir PDFs con pdf-lib devuelve promesas.
async function descargarArchivosPorCodigoMcm() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ultimaFila = hoja.getLastRow();
  const C = CONFIG_MCM.COLUMNAS;

  if (ultimaFila < CONFIG_MCM.FILA_INICIO) {
    SpreadsheetApp.getUi().alert('No hay datos para procesar');
    return;
  }

  const inicio = Date.now();
  let procesados = 0;
  let errores = 0;

  for (let fila = CONFIG_MCM.FILA_INICIO; fila <= ultimaFila; fila++) {
    if (Date.now() - inicio > CONFIG_MCM.MAX_MS) break;

    // Solo procesar si pone "Pendiente"
    if (hoja.getRange(fila, C.ARCHIVO).getValue() !== 'Pendiente') continue;

    try {
      Logger.log(`Procesando archivo de fila ${fila}`);

      const nombreActividad = String(hoja.getRange(fila, C.NOMBRE_ACTIVIDAD).getValue()).trim();
      if (!nombreActividad) throw new Error('❌ Indica la actividad en la columna C');

      const idMovimiento = String(hoja.getRange(fila, C.ID_MOVIMIENTO).getValue()).trim();
      const esGastoEstructural = nombreActividad.includes('Gastos Estructurales');
      const carpetaRaiz = DriveApp.getFolderById(CONFIG_MCM.CARPETA_DRIVE_ID);

      let codigoFactura;
      let carpetaDestino;

      if (esGastoEstructural) {
        // Gasto estructural: el nombre del archivo lo pone la persona en D.
        codigoFactura = String(hoja.getRange(fila, C.CODIGO_FACTURA).getValue()).trim();
        if (!codigoFactura) {
          throw new Error('❌ Para Gastos Estructurales debes indicar el nombre del archivo en la columna D');
        }
        carpetaDestino = buscarCarpetaEstructuralesMcm(carpetaRaiz);
      } else {
        // Actividad normal: A.X.Y con X = primer carácter de C e Y correlativo.
        const numeroActividad = extraerNumeroActividadMcm(nombreActividad);
        const numeroCorrelativo = calcularSiguienteCorrelativoMcm(hoja, numeroActividad);
        codigoFactura = `A.${numeroActividad}.${numeroCorrelativo}`;
        carpetaDestino = obtenerOCrearCarpetaActividadMcm(carpetaRaiz, nombreActividad);
      }

      // Ficha nueva: las URL firmadas caducan y esta fila pudo prepararse hace días.
      const ficha = pedirFicha_(idMovimiento);
      const archivos = ordenarArchivos_(ficha.archivos);
      if (archivos.length === 0) throw new Error('El movimiento no tiene ningún archivo');

      // Se baja y convierte TODO antes de guardar: si algo falla, no queda un
      // documento a medias en Drive.
      const pdfs = archivos.map(descargarComoPdf_);
      const pdfFinal = pdfs.length === 1 ? pdfs[0] : await unirPdfs_(pdfs);

      const url = guardarPdfEnCarpeta_(pdfFinal, `${codigoFactura}.pdf`, carpetaDestino);

      if (!esGastoEstructural) hoja.getRange(fila, C.CODIGO_FACTURA).setValue(codigoFactura);
      const celdaArchivo = hoja.getRange(fila, C.ARCHIVO);
      celdaArchivo.setValue(url);
      celdaArchivo.setNote(pdfs.length > 1 ? `Unidos ${pdfs.length} archivos en un PDF` : '');

      procesados++;
      SpreadsheetApp.flush();
      Utilities.sleep(300); // pausa corta: aquí no hay límite tan estricto como en Holded
    } catch (error) {
      Logger.log(`Error en fila ${fila}: ${error}`);
      hoja.getRange(fila, C.ARCHIVO).setValue('ERROR: ' + error.message);
      errores++;
    }
  }

  SpreadsheetApp.getUi().alert(
    `✅ Descarga completada\n\nArchivos descargados: ${procesados}\nErrores: ${errores}`
  );
}

// ============================================
// LLAMADA API: ficha del movimiento
// ============================================
function pedirFicha_(idMovimiento) {
  const base = CONFIG_MCM.BASE_URL;
  const clave = CONFIG_MCM.API_KEY;
  if (!base || !clave || clave.indexOf('PEGA_AQUI') === 0) {
    throw new Error('Falta rellenar BASE_URL / API_KEY en CONFIG_MCM');
  }

  const respuesta = UrlFetchApp.fetch(
    `${base}/api/v1/movimientos/${encodeURIComponent(idMovimiento)}/ficha`,
    { method: 'get', headers: { 'x-api-key': clave }, muteHttpExceptions: true }
  );
  const codigo = respuesta.getResponseCode();
  let cuerpo;
  try {
    cuerpo = JSON.parse(respuesta.getContentText());
  } catch (e) {
    throw new Error(`Error API (${codigo}): respuesta no válida`);
  }
  if (codigo !== 200 || !cuerpo.ok) throw new Error(`Error API (${codigo}): ${cuerpo.error || 'sin detalle'}`);
  return cuerpo.ficha;
}

// ============================================
// ARCHIVOS
// ============================================

/** El documento principal primero: factura antes que otros adjuntos, PDF antes que imagen. */
function ordenarArchivos_(archivos) {
  const puntos = (a) => (a.es_factura ? 2 : 0) + (a.tipo_mime === 'application/pdf' ? 1 : 0);
  return archivos
    .map((a, i) => ({ a, i }))
    .sort((x, y) => puntos(y.a) - puntos(x.a) || x.i - y.i)
    .map((x) => x.a);
}

/**
 * Baja el archivo de la URL firmada (no lleva clave) y lo devuelve como PDF.
 * Holded siempre devolvía PDF; aquí también entran fotos de tickets, que se
 * convierten para que en Drive todo sea PDF.
 */
function descargarComoPdf_(archivo) {
  const respuesta = UrlFetchApp.fetch(archivo.url_firmada, { muteHttpExceptions: true });
  if (respuesta.getResponseCode() !== 200) {
    throw new Error(`No se pudo bajar "${archivo.nombre_original}" (${respuesta.getResponseCode()})`);
  }

  const blob = respuesta.getBlob();
  const tipo = (blob.getContentType() || archivo.tipo_mime || '').toLowerCase();
  if (tipo === 'application/pdf') return blob;
  if (/^image\/(png|jpe?g|gif|bmp)$/.test(tipo)) return blob.getAs('application/pdf');
  throw new Error(`"${archivo.nombre_original}" es ${tipo || 'de tipo desconocido'} y no se puede pasar a PDF`);
}

/** Une varios PDF (en el orden dado) en uno solo. */
async function unirPdfs_(blobs) {
  const { PDFDocument } = cargarPdfLib_();
  const unido = await PDFDocument.create();
  for (let i = 0; i < blobs.length; i++) {
    let origen;
    try {
      // getBytes() da bytes CON signo en un array; pdf-lib quiere un Uint8Array.
      origen = await PDFDocument.load(Uint8Array.from(blobs[i].getBytes()), { ignoreEncryption: true });
    } catch (e) {
      throw new Error(`No se pudo leer el archivo ${i + 1} para unirlo: ${e.message || e}`);
    }
    const paginas = await unido.copyPages(origen, origen.getPageIndices());
    paginas.forEach((pagina) => unido.addPage(pagina));
  }
  const bytes = await unido.save();
  // ...y newBlob() espera lo mismo: un array de bytes con signo.
  return Utilities.newBlob(Array.from(bytes, (b) => (b > 127 ? b - 256 : b)), 'application/pdf', 'unido.pdf');
}

/** Descarga pdf-lib una vez por ejecución, comprueba su huella y lo carga. */
function cargarPdfLib_() {
  if (typeof PDFLib !== 'undefined') return PDFLib;

  const codigo = UrlFetchApp.fetch(CONFIG_MCM.PDFLIB_URL).getContentText();
  const huella = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, codigo, Utilities.Charset.UTF_8)
    .map((b) => ((b < 0 ? b + 256 : b)).toString(16).padStart(2, '0'))
    .join('');
  if (huella !== CONFIG_MCM.PDFLIB_SHA256) {
    throw new Error('La huella de pdf-lib no coincide con la esperada: no se ejecuta');
  }

  // pdf-lib usa setTimeout para ceder el turno; Apps Script no lo tiene.
  globalThis.setTimeout = globalThis.setTimeout || ((f) => f());
  (0, eval)(codigo); // eval indirecto: PDFLib queda como global
  return PDFLib;
}

function guardarPdfEnCarpeta_(pdfBlob, nombreArchivo, carpeta) {
  pdfBlob.setName(nombreArchivo);
  const creado = carpeta.createFile(pdfBlob);
  Logger.log(`✅ Guardado: ${nombreArchivo} en "${carpeta.getName()}"`);
  return `https://drive.google.com/file/d/${creado.getId()}/view`;
}

// ============================================
// CARPETAS Y CÓDIGOS (igual que en Holded)
// ============================================
function buscarCarpetaEstructuralesMcm(carpetaPadre) {
  const carpetas = carpetaPadre.getFolders();
  while (carpetas.hasNext()) {
    const carpeta = carpetas.next();
    if (carpeta.getName().includes('Estructurales')) return carpeta;
  }
  throw new Error('❌ No se encontró ninguna carpeta con "Estructurales" en el nombre');
}

function obtenerOCrearCarpetaActividadMcm(carpetaPadre, nombreActividad) {
  const carpetas = carpetaPadre.getFoldersByName(nombreActividad); // nombre EXACTO
  return carpetas.hasNext() ? carpetas.next() : carpetaPadre.createFolder(nombreActividad);
}

function extraerNumeroActividadMcm(nombreActividad) {
  const primerCaracter = nombreActividad.toString().trim().charAt(0);
  if (!/^\d$/.test(primerCaracter)) {
    throw new Error(`El primer carácter de la actividad debe ser un número, encontrado: "${primerCaracter}"`);
  }
  return primerCaracter;
}

function calcularSiguienteCorrelativoMcm(hoja, numeroActividad) {
  const filas = hoja.getLastRow() - CONFIG_MCM.FILA_INICIO + 1;
  const columnaD = hoja.getRange(CONFIG_MCM.FILA_INICIO, CONFIG_MCM.COLUMNAS.CODIGO_FACTURA, filas, 1).getValues();
  const patron = new RegExp(`^A\\.${numeroActividad}\\.(\\d+)$`);

  let maxCorrelativo = 0;
  columnaD.forEach((fila) => {
    const match = fila[0].toString().trim().match(patron);
    if (match) maxCorrelativo = Math.max(maxCorrelativo, parseInt(match[1], 10));
  });
  return maxCorrelativo + 1;
}

// ============================================
// BBDD DE PROVEEDORES (igual que en Holded)
// ============================================
function actualizarBBDDProveedoresMcm(cif, nombreProveedor) {
  const id = CONFIG_MCM.BBDD_PROVEEDORES_ID;
  if (!id) return; // opcional
  try {
    const hojaBBDD = SpreadsheetApp.openById(id).getSheetByName(CONFIG_MCM.BBDD_PROVEEDORES_HOJA);
    if (!hojaBBDD) {
      Logger.log(`⚠️ No se encuentra la hoja "${CONFIG_MCM.BBDD_PROVEEDORES_HOJA}" en la BBDD`);
      return;
    }
    const ultimaFila = hojaBBDD.getLastRow();
    const cifs = hojaBBDD.getRange(2, 4, Math.max(ultimaFila - 1, 1), 1).getValues(); // columna D
    if (cifs.some((f) => f[0] === cif)) return;

    const nuevaFila = ultimaFila + 1;
    hojaBBDD.getRange(nuevaFila, 1).setValue(cif);              // A: CIF
    hojaBBDD.getRange(nuevaFila, 2).setValue(nombreProveedor);  // B: Nombre
    hojaBBDD.getRange(nuevaFila, 4).setValue(cif);              // D: CIF
    Logger.log(`✅ Nuevo proveedor añadido a BBDD: ${nombreProveedor} (${cif})`);
  } catch (error) {
    Logger.log(`⚠️ Error actualizando BBDD de proveedores: ${error}`);
  }
}

// ============================================
// FECHAS
// ============================================

/**
 * Fecha de pago = la del último movimiento del banco vinculado a la factura
 * (equivale al "último pago" de Holded). Sin factura, la del propio movimiento.
 */
function ultimaFechaPago_(ficha) {
  const fechas = ((ficha.factura && ficha.factura.movimientos) || []).map((m) => m.fecha).filter(Boolean);
  if (fechas.length === 0) return ficha.movimiento.fecha;
  return fechas.sort().pop(); // ISO yyyy-mm-dd: el orden de texto es el cronológico
}

/** "2026-03-10" → "10/03/2026". Sin pasar por Date: evita el desfase de zona horaria. */
function fechaEs_(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
