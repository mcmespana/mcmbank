import type { createAdminClient } from "@/lib/supabase/admin"
import type { ApiScope } from "@/lib/api/external-auth"
import { badRequest } from "@/lib/api/errors"
import { nombreActor, resolveActor, type Actor, type ActorHint } from "@/lib/api/actor"
import {
  listDelegaciones,
  resolveAmbitoDelegaciones,
} from "@/lib/api/delegaciones"
import {
  listCategorias,
  listContactos,
  listCuentas,
  resolveCategorias,
  resolveCuentas,
} from "@/lib/api/catalogos"
import {
  actualizarMovimiento,
  buscarMovimientos,
  obtenerMovimiento,
  type OrdenMovimientos,
} from "@/lib/api/movimientos-public"
import {
  actualizarFactura,
  buscarCandidatosParaFactura,
  buscarFacturas,
  buscarFacturasParaMovimiento,
  conciliarLote,
  crearFactura,
  desvincularFacturaDeMovimiento,
  eliminarFactura,
  obtenerFactura,
  vincularFacturaAMovimiento,
  FACTURA_ESTADOS,
} from "@/lib/api/facturas"
import {
  actualizarAviso,
  crearAviso,
  eliminarAviso,
  listarAvisos,
  notificarAviso,
  obtenerAviso,
} from "@/lib/api/avisos"
import { listarPagosMcm } from "@/lib/api/pagos"
import { resumenGeneral } from "@/lib/api/resumen"
import {
  eliminarArchivo,
  localizarArchivo,
  subirArchivoAFactura,
  subirArchivoAMovimiento,
  urlFirmada,
  MAX_BYTES_API,
} from "@/lib/api/archivos"
import {
  booleano,
  fecha,
  lista,
  listaDeObjetos,
  numero,
  objeto,
  opcion,
  texto,
  textoObligatorio,
  type Args,
} from "@/lib/mcp/args"

type AdminClient = ReturnType<typeof createAdminClient>

export interface ContextoMcp {
  admin: AdminClient
  scope: ApiScope
  /** Origen de la petición, para construir enlaces de descarga. */
  baseUrl: string
  /** Autoría por defecto (cabeceras de la petición o variables de entorno). */
  actorHint: ActorHint
}

export interface HerramientaMcp {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  /** Permiso que exige. Puede depender de los argumentos (p. ej. `aplicar: true`). */
  scope: ApiScope | ((args: Args) => ApiScope)
  annotations?: Record<string, unknown>
  handler: (args: Args, ctx: ContextoMcp) => Promise<unknown>
}

// ---------------------------------------------------------------------------
// Utilidades compartidas
// ---------------------------------------------------------------------------

/** Esquema JSON reutilizable para el ámbito de delegaciones. */
const CAMPO_DELEGACIONES = {
  type: "array",
  items: { type: "string" },
  description:
    "Delegaciones a las que limitar la búsqueda, por nombre, código o id (se admite el nombre tal cual lo diría una persona: 'Sevilla', 'la delegación de Madrid'). Si se omite, se buscan TODAS las delegaciones.",
}

const CAMPO_USUARIO_EMAIL = {
  type: "string",
  description:
    "Correo del usuario de MCM Bank al que atribuir esta acción (aparecerá como autor). Si se omite se usa la cuenta configurada en el servidor.",
}

function objetoSchema(propiedades: Record<string, unknown>, obligatorios: string[] = []) {
  return {
    type: "object",
    properties: propiedades,
    ...(obligatorios.length > 0 ? { required: obligatorios } : {}),
    additionalProperties: false,
  }
}

async function actorDe(args: Args, ctx: ContextoMcp): Promise<Actor> {
  return resolveActor(ctx.admin, {
    usuario_id: texto(args, "usuario_id") ?? ctx.actorHint.usuario_id,
    usuario_email: texto(args, "usuario_email") ?? ctx.actorHint.usuario_email,
  })
}

/** Traduce los filtros de búsqueda en lenguaje natural a ids concretos. */
async function filtrosDeMovimientos(args: Args, ctx: ContextoMcp) {
  const delegaciones = await resolveAmbitoDelegaciones(ctx.admin, lista(args, "delegaciones"))

  const categoriasPedidas = lista(args, "categorias")
  const categorias = await resolveCategorias(ctx.admin, categoriasPedidas, delegaciones)
  if (categoriasPedidas && (!categorias || categorias.length === 0)) {
    const disponibles = await listCategorias(ctx.admin, {
      delegaciones: lista(args, "delegaciones") ?? null,
    })
    throw badRequest(
      `No encuentro ninguna categoría que se llame ${categoriasPedidas.join(" ni ")}.`,
      { categorias_disponibles: disponibles.map((c) => c.nombre).slice(0, 60) },
    )
  }

  const cuentasPedidas = lista(args, "cuentas")
  const cuentas = await resolveCuentas(ctx.admin, cuentasPedidas, delegaciones)
  if (cuentasPedidas && (!cuentas || cuentas.length === 0)) {
    const disponibles = await listCuentas(ctx.admin, {
      delegaciones: lista(args, "delegaciones") ?? null,
    })
    throw badRequest(`No encuentro ninguna cuenta que se llame ${cuentasPedidas.join(" ni ")}.`, {
      cuentas_disponibles: disponibles.map((c) => c.nombre).slice(0, 60),
    })
  }

  return { delegaciones, categorias, cuentas }
}

// ---------------------------------------------------------------------------
// Herramientas
// ---------------------------------------------------------------------------

export const HERRAMIENTAS: HerramientaMcp[] = [
  // -------------------------------------------------------------- Referencia
  {
    name: "listar_delegaciones",
    title: "Listar delegaciones",
    description:
      "Lista todas las delegaciones de MCM con su id, código y nombre. Útil como primer paso cuando hay que desambiguar un nombre o cuando se quiere recorrer todas las delegaciones una por una.",
    inputSchema: objetoSchema({}),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (_args, ctx) => {
      const delegaciones = await listDelegaciones(ctx.admin)
      return { total: delegaciones.length, delegaciones }
    },
  },
  {
    name: "listar_cuentas",
    title: "Listar cuentas",
    description:
      "Cuentas bancarias y cajas de una, varias o todas las delegaciones, con banco, IBAN y si están activas.",
    inputSchema: objetoSchema({
      delegaciones: CAMPO_DELEGACIONES,
      incluir_inactivas: { type: "boolean", description: "Incluir cuentas desactivadas." },
    }),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (args, ctx) => {
      const cuentas = await listCuentas(ctx.admin, {
        delegaciones: lista(args, "delegaciones") ?? null,
        incluirInactivas: booleano(args, "incluir_inactivas"),
      })
      return { total: cuentas.length, cuentas }
    },
  },
  {
    name: "listar_categorias",
    title: "Listar categorías",
    description:
      "Categorías de ingresos y gastos visibles para una delegación (las globales de MCM más las propias de la delegación). Consúltala antes de categorizar un movimiento para usar el nombre exacto.",
    inputSchema: objetoSchema({
      delegaciones: CAMPO_DELEGACIONES,
      incluir_inactivas: { type: "boolean", description: "Incluir categorías desactivadas." },
    }),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (args, ctx) => {
      const categorias = await listCategorias(ctx.admin, {
        delegaciones: lista(args, "delegaciones") ?? null,
        incluirInactivas: booleano(args, "incluir_inactivas"),
      })
      return { total: categorias.length, categorias }
    },
  },
  {
    name: "listar_contactos",
    title: "Listar contactos",
    description:
      "Proveedores y personas dados de alta en MCM Bank. Solo lectura: dar de alta contactos se hace desde la aplicación.",
    inputSchema: objetoSchema({
      delegaciones: CAMPO_DELEGACIONES,
      texto: { type: "string", description: "Filtra por nombre." },
      tipos: {
        type: "array",
        items: { type: "string", enum: ["proveedor", "persona_mcm", "destinatario_mcm"] },
        description: "Tipos de contacto a incluir.",
      },
      incluir_archivados: { type: "boolean" },
    }),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (args, ctx) => {
      const contactos = await listContactos(ctx.admin, {
        delegaciones: lista(args, "delegaciones") ?? null,
        texto: texto(args, "texto"),
        tipos: lista(args, "tipos"),
        incluirArchivados: booleano(args, "incluir_archivados"),
      })
      return { total: contactos.length, contactos }
    },
  },

  // ------------------------------------------------------------- Movimientos
  {
    name: "buscar_movimientos",
    title: "Buscar movimientos",
    description:
      "Busca movimientos bancarios en una, varias o TODAS las delegaciones a la vez y devuelve además el total gastado/ingresado del conjunto encontrado, desglosado por delegación. " +
      "Es la herramienta principal: sirve para '¿qué se ha gastado en Mercadona en todas las delegaciones por encima de 50 €?', 'gastos sin categorizar de este trimestre' o 'movimientos sin factura de Sevilla'. " +
      "Los importes se filtran por valor absoluto: importe_min 50 encuentra tanto un ingreso de 50 € como un gasto de -50 €; usa 'tipo' para quedarte con unos u otros.",
    inputSchema: objetoSchema({
      texto: {
        type: "string",
        description:
          "Texto a buscar en concepto, descripción, contraparte y notas. Con varias palabras, deben aparecer todas (en cualquiera de esos campos).",
      },
      delegaciones: CAMPO_DELEGACIONES,
      tipo: { type: "string", enum: ["ingreso", "gasto"], description: "Quedarse solo con ingresos o solo con gastos." },
      importe_min: { type: "number", description: "Importe mínimo en euros, en valor absoluto." },
      importe_max: { type: "number", description: "Importe máximo en euros, en valor absoluto." },
      fecha_desde: { type: "string", description: "Fecha inicial (AAAA-MM-DD), incluida." },
      fecha_hasta: { type: "string", description: "Fecha final (AAAA-MM-DD), incluida." },
      categorias: {
        type: "array",
        items: { type: "string" },
        description: "Categorías por nombre o id.",
      },
      sin_categoria: { type: "boolean", description: "Solo movimientos sin categorizar." },
      cuentas: { type: "array", items: { type: "string" }, description: "Cuentas por nombre, IBAN o id." },
      con_factura: {
        type: "boolean",
        description: "true = solo los que ya tienen factura vinculada; false = solo los que no la tienen.",
      },
      factura_pendiente: {
        type: "boolean",
        description: "Solo los marcados como 'le falta la factura'.",
      },
      incluir_ignorados: {
        type: "boolean",
        description: "Incluir los movimientos marcados como ignorados (por defecto se excluyen, igual que en la app).",
      },
      orden: {
        type: "string",
        enum: ["fecha_desc", "fecha_asc", "importe_desc", "importe_asc"],
        description:
          "Orden del resultado. Recuerda que los gastos son negativos: para los mayores gastos usa importe_asc.",
      },
      limite: { type: "number", description: "Cuántos devolver (por defecto 25, máximo 200)." },
      offset: { type: "number", description: "Desplazamiento para paginar." },
      incluir_archivos: {
        type: "boolean",
        description: "Adjuntar la lista de archivos de cada movimiento (por defecto no, para no alargar la respuesta).",
      },
    }),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (args, ctx) => {
      const { delegaciones, categorias, cuentas } = await filtrosDeMovimientos(args, ctx)

      return buscarMovimientos(ctx.admin, {
        delegaciones,
        texto: texto(args, "texto"),
        tipo: opcion(args, "tipo", ["ingreso", "gasto"] as const),
        importeMin: numero(args, "importe_min"),
        importeMax: numero(args, "importe_max"),
        fechaDesde: fecha(args, "fecha_desde"),
        fechaHasta: fecha(args, "fecha_hasta"),
        categoriaIds: categorias?.map((c) => c.id) ?? null,
        sinCategoria: booleano(args, "sin_categoria"),
        cuentaIds: cuentas?.map((c) => c.id) ?? null,
        conFactura: booleano(args, "con_factura") ?? null,
        facturaPendiente: booleano(args, "factura_pendiente"),
        incluirIgnorados: booleano(args, "incluir_ignorados"),
        orden: opcion(args, "orden", [
          "fecha_desc",
          "fecha_asc",
          "importe_desc",
          "importe_asc",
        ] as const) as OrdenMovimientos | undefined,
        limite: numero(args, "limite") ?? 25,
        offset: numero(args, "offset"),
        incluirArchivos: booleano(args, "incluir_archivos") ?? false,
        baseUrl: ctx.baseUrl,
      })
    },
  },
  {
    name: "obtener_movimiento",
    title: "Ver un movimiento",
    description:
      "Devuelve un movimiento completo por su id, con cuenta, categoría, delegación, contacto y todos sus archivos adjuntos.",
    inputSchema: objetoSchema(
      { id: { type: "string", description: "Id (UUID) del movimiento." } },
      ["id"],
    ),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (args, ctx) => {
      const movimiento = await obtenerMovimiento(ctx.admin, textoObligatorio(args, "id"), {
        baseUrl: ctx.baseUrl,
      })
      if (!movimiento) throw badRequest(`No existe ningún movimiento con el id ${args.id}.`)
      return { movimiento }
    },
  },
  {
    name: "actualizar_movimiento",
    title: "Editar un movimiento",
    description:
      "Cambia los datos editables de un movimiento: categoría, contacto, notas, descripción, si se ignora y si le falta la factura. " +
      "Importe, fecha, cuenta y delegación NO se pueden cambiar desde aquí: vienen del banco.",
    inputSchema: objetoSchema(
      {
        id: { type: "string", description: "Id (UUID) del movimiento." },
        categoria_id: { type: "string", description: "Id de la categoría (usa listar_categorias). null para quitarla." },
        contacto_id: { type: "string", description: "Id del contacto. null para quitarlo." },
        notas: { type: "string" },
        descripcion: { type: "string" },
        contraparte: { type: "string" },
        metodo: { type: "string" },
        ignorado: { type: "boolean", description: "Excluir el movimiento de los informes." },
        factura_pendiente: { type: "boolean", description: "Marcar que a este movimiento le falta la factura." },
        usuario_email: CAMPO_USUARIO_EMAIL,
      },
      ["id"],
    ),
    scope: "write",
    annotations: { readOnlyHint: false, idempotentHint: true },
    handler: async (args, ctx) => {
      const cambios: Record<string, unknown> = {}
      for (const campo of ["categoria_id", "contacto_id", "notas", "descripcion", "contraparte", "metodo"]) {
        if (campo in args) cambios[campo] = args[campo] === null ? null : texto(args, campo) ?? null
      }
      if ("ignorado" in args) cambios.ignorado = booleano(args, "ignorado")
      if ("factura_pendiente" in args) cambios.factura_pendiente = booleano(args, "factura_pendiente")

      const movimiento = await actualizarMovimiento(
        ctx.admin,
        textoObligatorio(args, "id"),
        cambios,
        { baseUrl: ctx.baseUrl },
      )
      return { movimiento }
    },
  },
  {
    name: "resumen_economico",
    title: "Resumen económico",
    description:
      "Foto económica de una, varias o todas las delegaciones: ingresos, gastos, neto y saldo por delegación, desglose por categoría, y cuántas facturas y avisos tiene pendientes cada una. " +
      "Es la forma rápida de responder '¿cómo van todas las delegaciones este año?'.",
    inputSchema: objetoSchema({
      delegaciones: CAMPO_DELEGACIONES,
      desde: { type: "string", description: "Fecha inicial (AAAA-MM-DD) para ingresos y gastos." },
      hasta: { type: "string", description: "Fecha final (AAAA-MM-DD)." },
      incluir_ignorados: { type: "boolean" },
    }),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (args, ctx) =>
      resumenGeneral(ctx.admin, {
        delegaciones: lista(args, "delegaciones") ?? null,
        desde: fecha(args, "desde"),
        hasta: fecha(args, "hasta"),
        incluirIgnorados: booleano(args, "incluir_ignorados"),
      }),
  },

  // ---------------------------------------------------------------- Facturas
  {
    name: "buscar_facturas",
    title: "Buscar facturas",
    description:
      "Busca en la bandeja de facturas de una, varias o todas las delegaciones. Devuelve para cada una cuánto lleva pagado y cuánto queda pendiente, además de sus archivos.",
    inputSchema: objetoSchema({
      delegaciones: CAMPO_DELEGACIONES,
      estados: {
        type: "array",
        items: { type: "string", enum: [...FACTURA_ESTADOS] },
        description:
          "bandeja (recién subida), sin_pagar, pagada_parcial, pagada, pagada_fuera (pagada fuera de MCM Bank).",
      },
      texto: { type: "string", description: "Busca en concepto, número y notas." },
      numero: { type: "string", description: "Número de factura (búsqueda parcial)." },
      importe_min: { type: "number" },
      importe_max: { type: "number" },
      fecha_desde: { type: "string", description: "Fecha de emisión desde (AAAA-MM-DD)." },
      fecha_hasta: { type: "string", description: "Fecha de emisión hasta (AAAA-MM-DD)." },
      sin_conciliar: { type: "boolean", description: "Solo las que no tienen ningún movimiento vinculado." },
      limite: { type: "number", description: "Por defecto 25, máximo 200." },
      offset: { type: "number" },
    }),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (args, ctx) =>
      buscarFacturas(ctx.admin, {
        delegaciones: lista(args, "delegaciones") ?? null,
        estados: lista(args, "estados"),
        texto: texto(args, "texto"),
        numero: texto(args, "numero"),
        importeMin: numero(args, "importe_min"),
        importeMax: numero(args, "importe_max"),
        fechaDesde: fecha(args, "fecha_desde"),
        fechaHasta: fecha(args, "fecha_hasta"),
        sinConciliar: booleano(args, "sin_conciliar"),
        limite: numero(args, "limite") ?? 25,
        offset: numero(args, "offset"),
        baseUrl: ctx.baseUrl,
      }),
  },
  {
    name: "obtener_factura",
    title: "Ver una factura",
    description: "Devuelve una factura por su id, con sus movimientos vinculados y sus archivos.",
    inputSchema: objetoSchema({ id: { type: "string" } }, ["id"]),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (args, ctx) => ({
      factura: await obtenerFactura(ctx.admin, textoObligatorio(args, "id"), { baseUrl: ctx.baseUrl }),
    }),
  },
  {
    name: "crear_factura",
    title: "Registrar una factura",
    description:
      "Registra una factura en la bandeja de una delegación. Puede subirse el PDF o la foto en la misma llamada (en base64) y vincularla ya a un movimiento.",
    inputSchema: objetoSchema(
      {
        delegacion: { type: "string", description: "Nombre, código o id de la delegación." },
        concepto: { type: "string", description: "De qué es la factura." },
        numero: { type: "string", description: "Número de factura del proveedor." },
        importe: { type: "number", description: "Importe total facturado, en positivo." },
        fecha_emision: { type: "string", description: "AAAA-MM-DD." },
        notas: { type: "string" },
        contacto_id: { type: "string", description: "Id del proveedor (ver listar_contactos)." },
        estado: { type: "string", enum: [...FACTURA_ESTADOS] },
        movimiento_id: {
          type: "string",
          description: "Si ya se sabe qué movimiento la pagó, se concilia en el momento.",
        },
        archivo: {
          type: "object",
          description: "Archivo de la factura, opcional.",
          properties: {
            nombre: { type: "string", description: "Nombre con extensión, p. ej. 'factura-octubre.pdf'." },
            contenido_base64: { type: "string", description: "Contenido del fichero en base64." },
            tipo_mime: { type: "string" },
            descripcion: { type: "string" },
          },
          required: ["nombre", "contenido_base64"],
        },
        usuario_email: CAMPO_USUARIO_EMAIL,
      },
      ["delegacion"],
    ),
    scope: "write",
    handler: async (args, ctx) => {
      const actor = await actorDe(args, ctx)
      const archivo = objeto(args, "archivo")
      const factura = await crearFactura(
        ctx.admin,
        {
          delegacion: textoObligatorio(args, "delegacion"),
          concepto: texto(args, "concepto"),
          numero: texto(args, "numero"),
          importe: numero(args, "importe"),
          fecha_emision: fecha(args, "fecha_emision"),
          notas: texto(args, "notas"),
          contacto_id: texto(args, "contacto_id"),
          estado: opcion(args, "estado", FACTURA_ESTADOS),
          movimiento_id: texto(args, "movimiento_id"),
          archivo: archivo
            ? {
                nombre: textoObligatorio(archivo, "nombre"),
                contenido_base64: textoObligatorio(archivo, "contenido_base64"),
                tipo_mime: texto(archivo, "tipo_mime"),
                descripcion: texto(archivo, "descripcion"),
              }
            : null,
        },
        actor.id,
        { baseUrl: ctx.baseUrl },
      )
      return { factura, firmado_por: nombreActor(actor) }
    },
  },
  {
    name: "actualizar_factura",
    title: "Editar una factura",
    description:
      "Corrige los datos de una factura: número, concepto, importe, fecha, proveedor, notas o estado.",
    inputSchema: objetoSchema(
      {
        id: { type: "string" },
        numero: { type: "string" },
        concepto: { type: "string" },
        importe: { type: "number", description: "En positivo." },
        fecha_emision: { type: "string", description: "AAAA-MM-DD." },
        estado: { type: "string", enum: [...FACTURA_ESTADOS] },
        notas: { type: "string" },
        contacto_id: { type: "string" },
      },
      ["id"],
    ),
    scope: "write",
    annotations: { idempotentHint: true },
    handler: async (args, ctx) => {
      const cambios: Record<string, unknown> = {}
      for (const campo of ["numero", "concepto", "notas", "contacto_id"]) {
        if (campo in args) cambios[campo] = args[campo] === null ? null : texto(args, campo) ?? null
      }
      if ("importe" in args) cambios.importe = args.importe === null ? null : numero(args, "importe")
      if ("fecha_emision" in args) {
        cambios.fecha_emision = args.fecha_emision === null ? null : fecha(args, "fecha_emision")
      }
      if ("estado" in args) cambios.estado = opcion(args, "estado", FACTURA_ESTADOS)

      return {
        factura: await actualizarFactura(ctx.admin, textoObligatorio(args, "id"), cambios, {
          baseUrl: ctx.baseUrl,
        }),
      }
    },
  },
  {
    name: "eliminar_factura",
    title: "Borrar una factura",
    description:
      "Borra una factura, sus archivos y desvincula los movimientos que tuviera. No borra los movimientos. Es irreversible: confírmalo con la persona antes de usarlo.",
    inputSchema: objetoSchema({ id: { type: "string" } }, ["id"]),
    scope: "write",
    annotations: { destructiveHint: true, idempotentHint: true },
    handler: async (args, ctx) => {
      await eliminarFactura(ctx.admin, textoObligatorio(args, "id"))
      return { eliminada: true, id: args.id }
    },
  },
  {
    name: "vincular_factura",
    title: "Conciliar factura y movimiento",
    description:
      "Vincula una factura con el movimiento bancario que la pagó. Una factura puede tener varios movimientos (pago en plazos); un movimiento, como mucho una factura. " +
      "Al vincular, la factura pasa sola a 'pagada' (o 'pagada_parcial') y sus archivos se ven también desde el movimiento.",
    inputSchema: objetoSchema(
      {
        factura_id: { type: "string" },
        movimiento_id: { type: "string" },
        usuario_email: CAMPO_USUARIO_EMAIL,
      },
      ["factura_id", "movimiento_id"],
    ),
    scope: "write",
    annotations: { idempotentHint: true },
    handler: async (args, ctx) => {
      const actor = await actorDe(args, ctx)
      const facturaId = textoObligatorio(args, "factura_id")
      await vincularFacturaAMovimiento(
        ctx.admin,
        facturaId,
        textoObligatorio(args, "movimiento_id"),
        actor.id,
      )
      return { factura: await obtenerFactura(ctx.admin, facturaId, { baseUrl: ctx.baseUrl }) }
    },
  },
  {
    name: "desvincular_factura",
    title: "Deshacer una conciliación",
    description: "Quita el vínculo entre una factura y un movimiento concreto.",
    inputSchema: objetoSchema({ factura_id: { type: "string" }, movimiento_id: { type: "string" } }, [
      "factura_id",
      "movimiento_id",
    ]),
    scope: "write",
    annotations: { idempotentHint: true },
    handler: async (args, ctx) => {
      const facturaId = textoObligatorio(args, "factura_id")
      await desvincularFacturaDeMovimiento(
        ctx.admin,
        facturaId,
        textoObligatorio(args, "movimiento_id"),
      )
      return { factura: await obtenerFactura(ctx.admin, facturaId, { baseUrl: ctx.baseUrl }) }
    },
  },
  {
    name: "buscar_movimiento_de_factura",
    title: "Buscar el movimiento de una factura",
    description:
      "Dado el importe (y opcionalmente la fecha y el proveedor) de UNA factura, propone los movimientos bancarios que mejor encajan, en las delegaciones que se indiquen o en todas, ordenados de mejor a peor y con los motivos. No modifica nada.",
    inputSchema: objetoSchema(
      {
        importe: { type: "number", description: "Importe de la factura, en positivo." },
        fecha: { type: "string", description: "Fecha de la factura (AAAA-MM-DD); afina mucho el resultado." },
        proveedor: { type: "string", description: "Nombre del proveedor; se busca en el concepto del movimiento." },
        numero: { type: "string", description: "Número de factura; a veces aparece en el concepto." },
        delegaciones: CAMPO_DELEGACIONES,
        ventana_dias: { type: "number", description: "Cuántos días alrededor de la fecha mirar (por defecto 90)." },
        incluir_con_factura: {
          type: "boolean",
          description: "Incluir también movimientos que ya tienen otra factura vinculada.",
        },
        limite: { type: "number", description: "Cuántos candidatos devolver (por defecto 10)." },
      },
      ["importe"],
    ),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (args, ctx) => {
      const ambito = await resolveAmbitoDelegaciones(ctx.admin, lista(args, "delegaciones"))
      const candidatos = await buscarCandidatosParaFactura(
        ctx.admin,
        {
          importe: numero(args, "importe"),
          fecha: fecha(args, "fecha"),
          proveedor: texto(args, "proveedor"),
          numero: texto(args, "numero"),
        },
        {
          ambito,
          ventanaDias: numero(args, "ventana_dias"),
          incluirConFactura: booleano(args, "incluir_con_factura"),
          limite: numero(args, "limite"),
        },
      )
      return { total: candidatos.length, candidatos }
    },
  },
  {
    name: "buscar_factura_de_movimiento",
    title: "Buscar la factura de un movimiento",
    description:
      "El camino inverso: dado un movimiento, propone las facturas de su delegación que podrían corresponderle, comparando contra el importe que a cada una le queda por pagar.",
    inputSchema: objetoSchema(
      { movimiento_id: { type: "string" }, limite: { type: "number" } },
      ["movimiento_id"],
    ),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (args, ctx) => {
      const candidatas = await buscarFacturasParaMovimiento(
        ctx.admin,
        textoObligatorio(args, "movimiento_id"),
        { limite: numero(args, "limite"), baseUrl: ctx.baseUrl },
      )
      return { total: candidatas.length, candidatas }
    },
  },
  {
    name: "conciliar_facturas",
    title: "Cuadrar un lote de facturas",
    description:
      "Recibe una lista de facturas (importe y, si se sabe, fecha, proveedor y número) y busca a qué movimiento bancario corresponde cada una, en las delegaciones indicadas o en todas. " +
      "Es lo que resuelve 'toma estos 12 importes, dime de qué movimiento es cada uno'. " +
      "Por defecto SOLO PROPONE. Con aplicar=true vincula automáticamente los casos claros (importe exacto y con ventaja clara sobre el segundo candidato) y deja los dudosos para que decida una persona.",
    inputSchema: objetoSchema(
      {
        facturas: {
          type: "array",
          description: "Las facturas a cuadrar (máximo 100).",
          items: {
            type: "object",
            properties: {
              referencia: { type: "string", description: "Etiqueta libre para reconocer esta línea en el resultado." },
              importe: { type: "number", description: "Importe de la factura, en positivo." },
              fecha: { type: "string", description: "AAAA-MM-DD." },
              proveedor: { type: "string" },
              numero: { type: "string" },
              delegacion: { type: "string", description: "Limita esta línea a una delegación concreta." },
              factura_id: { type: "string", description: "Si la factura ya está en MCM Bank, su id." },
            },
            required: ["importe"],
          },
        },
        delegaciones: CAMPO_DELEGACIONES,
        ventana_dias: { type: "number", description: "Días alrededor de la fecha de cada factura (por defecto 90)." },
        max_candidatos: { type: "number", description: "Candidatos por factura (por defecto 5)." },
        aplicar: {
          type: "boolean",
          description: "Vincular automáticamente los casos claros. Por defecto false (solo propone).",
        },
        crear_facturas: {
          type: "boolean",
          description:
            "Con aplicar=true, registrar en la bandeja las facturas que aún no existan en MCM Bank antes de vincularlas.",
        },
        usuario_email: CAMPO_USUARIO_EMAIL,
      },
      ["facturas"],
    ),
    scope: (args) => (args.aplicar ? "write" : "read"),
    handler: async (args, ctx) => {
      const aplicar = booleano(args, "aplicar") ?? false
      const items = listaDeObjetos(args, "facturas") ?? []
      const actor = aplicar ? await actorDe(args, ctx) : null

      return conciliarLote(
        ctx.admin,
        {
          items: items.map((item) => ({
            referencia: texto(item, "referencia"),
            importe: numero(item, "importe"),
            fecha: fecha(item, "fecha"),
            proveedor: texto(item, "proveedor"),
            numero: texto(item, "numero"),
            delegacion: texto(item, "delegacion"),
            factura_id: texto(item, "factura_id"),
          })),
          delegaciones: lista(args, "delegaciones") ?? null,
          ventanaDias: numero(args, "ventana_dias"),
          maxCandidatos: numero(args, "max_candidatos"),
          aplicar,
          crearFacturas: booleano(args, "crear_facturas"),
        },
        actor?.id ?? null,
      )
    },
  },

  // ---------------------------------------------------------------- Archivos
  {
    name: "subir_archivo",
    title: "Subir una factura o documento",
    description:
      "Sube un archivo (PDF, imagen, hoja de cálculo…) y lo adjunta a un movimiento o a una factura. " +
      "Al adjuntarlo a un movimiento como factura, además se registra solo en la sección Facturas ya conciliado con ese movimiento, igual que si se hubiera hecho desde la app. " +
      `El contenido va en base64 y el máximo por API son ${Math.round(MAX_BYTES_API / 1024 / 1024)} MB (por encima, hay que subirlo desde la aplicación).`,
    inputSchema: objetoSchema(
      {
        movimiento_id: { type: "string", description: "Adjuntar a este movimiento. Indica esto o factura_id." },
        factura_id: { type: "string", description: "Adjuntar a esta factura de la bandeja." },
        nombre: { type: "string", description: "Nombre del fichero con su extensión, p. ej. 'mercadona-oct.pdf'." },
        contenido_base64: { type: "string", description: "Contenido del fichero codificado en base64." },
        tipo_mime: { type: "string", description: "Si se omite, se deduce de la extensión." },
        descripcion: { type: "string", description: "Nota corta sobre el archivo." },
        bucket: {
          type: "string",
          enum: ["facturas", "documentos"],
          description: "'facturas' (por defecto) o 'documentos' para material que no es una factura.",
        },
        crear_factura: {
          type: "boolean",
          description:
            "Solo para movimientos y bucket 'facturas': crear también la entidad factura. Por defecto true.",
        },
        usuario_email: CAMPO_USUARIO_EMAIL,
      },
      ["nombre", "contenido_base64"],
    ),
    scope: "write",
    handler: async (args, ctx) => {
      const actor = await actorDe(args, ctx)
      const archivo = {
        nombre: textoObligatorio(args, "nombre"),
        contenido_base64: textoObligatorio(args, "contenido_base64"),
        tipo_mime: texto(args, "tipo_mime"),
        descripcion: texto(args, "descripcion"),
        bucket: opcion(args, "bucket", ["facturas", "documentos"] as const),
      }

      const movimientoId = texto(args, "movimiento_id")
      const facturaId = texto(args, "factura_id")
      if (!movimientoId && !facturaId) {
        throw badRequest("Indica a qué se adjunta: 'movimiento_id' o 'factura_id'.")
      }
      if (movimientoId && facturaId) {
        throw badRequest(
          "Indica solo uno: 'movimiento_id' o 'factura_id'. Para adjuntarlo a los dos, súbelo al movimiento y se registrará también en su factura.",
        )
      }

      const resultado = movimientoId
        ? await subirArchivoAMovimiento(ctx.admin, {
            movimientoId,
            archivo,
            crearFactura: booleano(args, "crear_factura"),
            actorId: actor.id,
            baseUrl: ctx.baseUrl,
          })
        : await subirArchivoAFactura(ctx.admin, {
            facturaId: facturaId as string,
            archivo,
            actorId: actor.id,
            baseUrl: ctx.baseUrl,
          })

      return { ...resultado, firmado_por: nombreActor(actor) }
    },
  },
  {
    name: "obtener_url_archivo",
    title: "Enlace de descarga de un archivo",
    description:
      "Devuelve una URL temporal (5 minutos) para descargar un archivo adjunto. Úsala para abrir o leer una factura ya subida.",
    inputSchema: objetoSchema(
      {
        archivo_id: { type: "string", description: "Id del archivo (aparece en los adjuntos del movimiento o la factura)." },
        segundos: { type: "number", description: "Validez del enlace en segundos (por defecto 300)." },
      },
      ["archivo_id"],
    ),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (args, ctx) => {
      const { fila } = await localizarArchivo(ctx.admin, textoObligatorio(args, "archivo_id"))
      const segundos = Math.min(Math.max(numero(args, "segundos") ?? 300, 30), 3600)
      const url = await urlFirmada(ctx.admin, fila.bucket, fila.path_storage, segundos)
      return {
        url,
        nombre: fila.nombre_original,
        tipo_mime: fila.tipo_mime,
        caduca_en_segundos: segundos,
      }
    },
  },
  {
    name: "eliminar_archivo",
    title: "Borrar un archivo",
    description: "Borra un archivo adjunto y su fichero. Irreversible.",
    inputSchema: objetoSchema({ archivo_id: { type: "string" } }, ["archivo_id"]),
    scope: "write",
    annotations: { destructiveHint: true, idempotentHint: true },
    handler: async (args, ctx) => {
      await eliminarArchivo(ctx.admin, textoObligatorio(args, "archivo_id"))
      return { eliminado: true, archivo_id: args.archivo_id }
    },
  },

  // ------------------------------------------------------------------ Avisos
  {
    name: "listar_avisos",
    title: "Ver avisos y tareas",
    description:
      "Notas y tareas del canal entre la oficina técnica y los tesoreros. Por defecto solo las pendientes, de todas las delegaciones: es la forma de ver de un vistazo qué tiene cada delegación por resolver.",
    inputSchema: objetoSchema({
      delegaciones: CAMPO_DELEGACIONES,
      estado: {
        type: "string",
        enum: ["pendiente", "hecha", "todas"],
        description: "Por defecto 'pendiente'.",
      },
      tipo: { type: "string", enum: ["tarea", "nota"] },
      destinatario: {
        type: "string",
        enum: ["oficina_tecnica", "delegacion"],
        description: "A quién va dirigido el aviso.",
      },
      texto: { type: "string", description: "Filtra por el contenido." },
      limite: { type: "number", description: "Por defecto 100." },
    }),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (args, ctx) =>
      listarAvisos(ctx.admin, {
        delegaciones: lista(args, "delegaciones") ?? null,
        estado: opcion(args, "estado", ["pendiente", "hecha", "todas"] as const),
        tipo: opcion(args, "tipo", ["tarea", "nota"] as const),
        destinatario: opcion(args, "destinatario", ["oficina_tecnica", "delegacion"] as const),
        texto: texto(args, "texto"),
        limite: numero(args, "limite"),
      }),
  },
  {
    name: "crear_aviso",
    title: "Dejar una nota o tarea",
    description:
      "Escribe una nota o una tarea en el canal de una delegación. Es el módulo de comunicación entre la oficina técnica y los tesoreros: aparece en el panel de avisos de esa delegación. " +
      "Usa tipo 'tarea' cuando esperas que alguien haga algo (se puede marcar como hecha) y 'nota' cuando solo informas. Con notificar=true además se envía por correo a quien corresponda.",
    inputSchema: objetoSchema(
      {
        delegacion: { type: "string", description: "Nombre, código o id de la delegación." },
        contenido: { type: "string", description: "El texto del aviso (máximo 2000 caracteres)." },
        tipo: { type: "string", enum: ["tarea", "nota"], description: "Por defecto 'nota'." },
        destinatario: {
          type: "string",
          enum: ["delegacion", "oficina_tecnica"],
          description:
            "A quién va dirigido: 'delegacion' (los tesoreros, por defecto) u 'oficina_tecnica' (los gestores centrales).",
        },
        referencia: { type: "string", description: "Etiqueta corta de contexto, máximo 60 caracteres." },
        notificar: { type: "boolean", description: "Enviarlo además por correo." },
        usuario_email: CAMPO_USUARIO_EMAIL,
      },
      ["delegacion", "contenido"],
    ),
    scope: "write",
    handler: async (args, ctx) => {
      const actor = await actorDe(args, ctx)
      const resultado = await crearAviso(
        ctx.admin,
        {
          delegacion: textoObligatorio(args, "delegacion"),
          contenido: textoObligatorio(args, "contenido"),
          tipo: opcion(args, "tipo", ["tarea", "nota"] as const),
          destinatario: opcion(args, "destinatario", ["delegacion", "oficina_tecnica"] as const),
          referencia: texto(args, "referencia"),
          notificar: booleano(args, "notificar"),
        },
        actor.id,
      )
      return { ...resultado, firmado_por: nombreActor(actor) }
    },
  },
  {
    name: "actualizar_aviso",
    title: "Editar o cerrar un aviso",
    description:
      "Cambia el texto de un aviso o lo marca como hecho (estado 'hecha') o de nuevo pendiente.",
    inputSchema: objetoSchema(
      {
        id: { type: "string" },
        contenido: { type: "string" },
        referencia: { type: "string" },
        destinatario: { type: "string", enum: ["delegacion", "oficina_tecnica"] },
        estado: { type: "string", enum: ["pendiente", "hecha"] },
        usuario_email: CAMPO_USUARIO_EMAIL,
      },
      ["id"],
    ),
    scope: "write",
    annotations: { idempotentHint: true },
    handler: async (args, ctx) => {
      const actor = await actorDe(args, ctx)
      const aviso = await actualizarAviso(
        ctx.admin,
        textoObligatorio(args, "id"),
        {
          contenido: texto(args, "contenido"),
          referencia: "referencia" in args ? texto(args, "referencia") ?? null : undefined,
          destinatario: opcion(args, "destinatario", ["delegacion", "oficina_tecnica"] as const),
          estado: opcion(args, "estado", ["pendiente", "hecha"] as const),
        },
        actor.id,
      )
      return { aviso }
    },
  },
  {
    name: "eliminar_aviso",
    title: "Borrar un aviso",
    description: "Borra una nota o tarea. Irreversible; para archivarla, mejor marcarla como hecha.",
    inputSchema: objetoSchema({ id: { type: "string" } }, ["id"]),
    scope: "write",
    annotations: { destructiveHint: true, idempotentHint: true },
    handler: async (args, ctx) => {
      await eliminarAviso(ctx.admin, textoObligatorio(args, "id"))
      return { eliminado: true, id: args.id }
    },
  },
  {
    name: "notificar_aviso",
    title: "Enviar un aviso por correo",
    description:
      "Envía (o reenvía) por correo un aviso ya creado: a los tesoreros de su delegación o a la oficina técnica, según a quién vaya dirigido. Nunca se envía a su autor.",
    inputSchema: objetoSchema(
      { id: { type: "string" }, usuario_email: CAMPO_USUARIO_EMAIL },
      ["id"],
    ),
    scope: "write",
    handler: async (args, ctx) => {
      const actor = await actorDe(args, ctx)
      const id = textoObligatorio(args, "id")
      const { destinatarios } = await notificarAviso(ctx.admin, id, actor.id)
      return { aviso: await obtenerAviso(ctx.admin, id), notificados: destinatarios }
    },
  },

  // -------------------------------------------------------------- Pagos MCM
  {
    name: "listar_pagos_mcm",
    title: "Ver pagos MCM",
    description:
      "Reembolsos a personas del movimiento (kilometraje, gastos adelantados). Solo lectura: darlos de alta se hace desde la aplicación.",
    inputSchema: objetoSchema({
      delegaciones: CAMPO_DELEGACIONES,
      estados: { type: "array", items: { type: "string" } },
      limite: { type: "number" },
      offset: { type: "number" },
    }),
    scope: "read",
    annotations: { readOnlyHint: true },
    handler: async (args, ctx) =>
      listarPagosMcm(ctx.admin, {
        delegaciones: lista(args, "delegaciones") ?? null,
        estados: lista(args, "estados"),
        limite: numero(args, "limite"),
        offset: numero(args, "offset"),
      }),
  },
]

export const HERRAMIENTAS_POR_NOMBRE = new Map(HERRAMIENTAS.map((h) => [h.name, h]))

/** Definiciones tal y como las espera `tools/list` del protocolo MCP. */
export function definicionesDeHerramientas() {
  return HERRAMIENTAS.map((h) => ({
    name: h.name,
    title: h.title,
    description: h.description,
    inputSchema: h.inputSchema,
    ...(h.annotations ? { annotations: { title: h.title, ...h.annotations } } : {}),
  }))
}

export function permisoDe(herramienta: HerramientaMcp, args: Args): ApiScope {
  return typeof herramienta.scope === "function" ? herramienta.scope(args) : herramienta.scope
}
