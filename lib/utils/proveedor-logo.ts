/**
 * Identidad y logo de un proveedor.
 *
 * Dos cosas viven aquí, y las dos son puras (sin red y sin Supabase) para que
 * las pueda usar tanto el navegador como el servidor:
 *
 *  1. `normalizarClaveProveedor`, que convierte "MERCADONA, S.A." y "Mercadona"
 *     en la misma clave. Es la que impide que existan dos Mercadonas.
 *  2. El catálogo de dominios conocidos, que es lo que permite encontrar el
 *     logo de un proveedor recién creado sin que nadie escriba su web.
 */

/**
 * Formas jurídicas y sufijos que no distinguen a una empresa de sí misma.
 * "Mercadona" y "Mercadona S.A." son el mismo proveedor.
 */
const SUFIJOS_JURIDICOS = [
  "sociedad limitada",
  "sociedad anonima",
  "sl unipersonal",
  "slu",
  "slp",
  "sll",
  "sal",
  "sau",
  "sa",
  "sl",
  "scp",
  "sc",
  "cb",
  "coop",
  "scoop",
  "sccl",
  "aie",
  "ute",
  "srl",
  "ltd",
  "limited",
  "inc",
  "llc",
  "gmbh",
  "bv",
  "nv",
  "spa",
  "srls",
]

/**
 * Clave canónica de un proveedor: minúsculas, sin acentos, sin puntuación y
 * sin forma jurídica.
 *
 *   "MERCADONA, S.A."  → "mercadona"
 *   "Mercadona"        → "mercadona"
 *   "Leroy  Merlín"    → "leroy merlin"
 *
 * Sobre ella va el índice único de proveedores globales, así que dos altas que
 * normalicen igual chocan en la base de datos en lugar de convertirse en dos
 * fichas del mismo sitio.
 */
export function normalizarClaveProveedor(nombre: string | null | undefined): string {
  const base = (nombre ?? "")
    .normalize("NFD")
    // Quita los diacríticos que NFD acaba de separar (Merlín → Merlin).
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // La puntuación pasa a espacio, no se borra: "a.b" no debe ser "ab".
    // La ñ ya no llega aquí: NFD la separó en n + tilde y la tilde se ha ido,
    // así que "Peñalba" y "Penalba" caen en la misma clave, que es lo que se
    // quiere de una clave cuyo trabajo es detectar duplicados.
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

  if (!base) return ""

  // "S.A." ha quedado como "s a" al pasar la puntuación a espacios, así que las
  // rachas de letras sueltas se vuelven a pegar antes de buscar sufijos: sin
  // esto, "MERCADONA, S.A." no coincidiría con el sufijo "sa" y quedarían dos
  // claves distintas para el mismo proveedor.
  let palabras: string[] = []
  for (const palabra of base.split(/\s+/)) {
    const anterior = palabras[palabras.length - 1]
    if (palabra.length === 1 && anterior && anterior.length <= 2 && /^[a-z]+$/.test(anterior)) {
      palabras[palabras.length - 1] = anterior + palabra
    } else {
      palabras.push(palabra)
    }
  }

  // Los sufijos jurídicos solo se quitan del final y nunca si son lo único que
  // queda: hay proveedores que se llaman literalmente "SA" o "Coop".
  let quitado = true
  while (quitado && palabras.length > 1) {
    quitado = false
    for (const sufijo of SUFIJOS_JURIDICOS) {
      const partes = sufijo.split(" ")
      if (partes.length > palabras.length - 1) continue
      const cola = palabras.slice(-partes.length).join(" ")
      if (cola === sufijo) {
        palabras = palabras.slice(0, -partes.length)
        quitado = true
        break
      }
    }
  }

  return palabras.join(" ")
}

/**
 * Dominios de los proveedores típicos de una delegación, indexados por clave
 * normalizada. Sirve para que el logo aparezca solo, sin que nadie escriba la
 * web: supermercados, ferretería, transporte, suministros, telefonía, seguros
 * y los sitios donde se hacen las convivencias y los campamentos.
 *
 * Añadir uno son dos palabras. Si un proveedor no está aquí se intenta
 * adivinar el dominio, y si tampoco, se sube el logo a mano.
 */
export const DOMINIOS_CONOCIDOS: Readonly<Record<string, string>> = {
  // Supermercados y alimentación
  mercadona: "mercadona.es",
  consum: "consum.es",
  carrefour: "carrefour.es",
  lidl: "lidl.es",
  aldi: "aldi.es",
  alcampo: "alcampo.es",
  dia: "dia.es",
  "supermercados dia": "dia.es",
  eroski: "eroski.es",
  froiz: "froiz.com",
  gadis: "gadisa.es",
  ahorramas: "ahorramas.com",
  bonarea: "bonarea.com",
  coviran: "coviran.es",
  "cash lepe": "cashlepe.com",
  makro: "makro.es",
  costco: "costco.es",
  "casa ametller": "ametllerorigen.com",
  "el jamon": "supermercadoseljamon.com",
  masymas: "masymas.com",
  hiperber: "hiperber.com",
  bonpreu: "bonpreu.cat",
  "la sirena": "lasirena.es",
  "grupo dia": "dia.es",

  // Bazar, hogar, ferretería, bricolaje
  amazon: "amazon.es",
  "leroy merlin": "leroymerlin.es",
  bricomart: "bricomart.es",
  bricodepot: "bricodepot.es",
  ikea: "ikea.com",
  "aki": "aki.es",
  ferrokey: "ferrokey.eu",
  "flying tiger": "flyingtiger.com",
  tiger: "flyingtiger.com",
  action: "action.com",
  wallapop: "wallapop.com",
  aliexpress: "aliexpress.com",
  temu: "temu.com",

  // Deporte, ropa, ocio
  decathlon: "decathlon.es",
  "el corte ingles": "elcorteingles.es",
  primark: "primark.com",
  kiabi: "kiabi.es",
  zara: "zara.com",
  "sprinter": "sprinter.es",
  forum: "forumsport.com",
  "forum sport": "forumsport.com",

  // Electrónica, informática, papelería
  mediamarkt: "mediamarkt.es",
  "media markt": "mediamarkt.es",
  pccomponentes: "pccomponentes.com",
  worten: "worten.es",
  fnac: "fnac.es",
  "casa del libro": "casadellibro.com",
  abacus: "abacus.coop",
  lyreco: "lyreco.es",
  staples: "staples.es",
  vistaprint: "vistaprint.es",
  "360 impresion": "360imprimir.es",
  carlin: "carlin.es",
  folder: "folder.es",

  // Combustible y movilidad
  repsol: "repsol.com",
  cepsa: "cepsa.com",
  galp: "galp.com",
  bp: "bp.com",
  shell: "shell.es",
  ballenoil: "ballenoil.es",
  petroprix: "petroprix.com",
  plenoil: "plenoil.es",

  // Transporte y viajes
  renfe: "renfe.com",
  alsa: "alsa.es",
  avanza: "avanzabus.com",
  monbus: "monbus.es",
  vectalia: "vectalia.es",
  "damas": "damas-sa.es",
  flixbus: "flixbus.es",
  blablacar: "blablacar.es",
  iberia: "iberia.com",
  vueling: "vueling.com",
  ryanair: "ryanair.com",
  booking: "booking.com",
  airbnb: "airbnb.es",
  balearia: "balearia.com",
  trasmediterranea: "trasmed.es",
  uber: "uber.com",
  cabify: "cabify.com",

  // Mensajería y correo
  correos: "correos.es",
  seur: "seur.com",
  mrw: "mrw.es",
  gls: "gls-spain.es",
  dhl: "dhl.com",
  ups: "ups.com",
  nacex: "nacex.es",
  "tourline": "tourlineexpress.com",
  glovo: "glovoapp.com",

  // Suministros y telecomunicaciones
  endesa: "endesa.com",
  iberdrola: "iberdrola.es",
  naturgy: "naturgy.es",
  "totalenergies": "totalenergies.es",
  holaluz: "holaluz.com",
  movistar: "movistar.es",
  telefonica: "telefonica.es",
  vodafone: "vodafone.es",
  orange: "orange.es",
  yoigo: "yoigo.com",
  masmovil: "masmovil.es",
  digi: "digimobil.es",
  pepephone: "pepephone.com",
  jazztel: "jazztel.com",
  finetwork: "finetwork.com",

  // Seguros, salud y banca
  mapfre: "mapfre.es",
  axa: "axa.es",
  allianz: "allianz.es",
  generali: "generali.es",
  santalucia: "santalucia.es",
  caser: "caser.es",
  sanitas: "sanitas.es",
  adeslas: "segurcaixaadeslas.es",
  asisa: "asisa.es",
  dkv: "dkvseguros.com",
  "mutua madrilena": "mutua.es",
  caixabank: "caixabank.es",
  sabadell: "bancsabadell.com",
  santander: "bancosantander.es",
  bbva: "bbva.es",
  bankinter: "bankinter.com",
  unicaja: "unicajabanco.es",
  ibercaja: "ibercaja.es",
  "triodos": "triodos.es",
  fiare: "fiarebancaetica.coop",
  cajamar: "cajamar.es",

  // Software y servicios
  google: "google.com",
  microsoft: "microsoft.com",
  apple: "apple.com",
  adobe: "adobe.com",
  canva: "canva.com",
  zoom: "zoom.us",
  dropbox: "dropbox.com",
  mailchimp: "mailchimp.com",
  wetransfer: "wetransfer.com",
  openai: "openai.com",
  anthropic: "anthropic.com",
  vercel: "vercel.com",
  supabase: "supabase.com",
  holded: "holded.com",

  // Salud y farmacia
  "cruz roja": "cruzroja.es",

  // Instituciones que aparecen como proveedor o pagador
  "agencia tributaria": "agenciatributaria.es",
  hacienda: "agenciatributaria.es",
  "seguridad social": "seg-social.es",
  "tesoreria general de la seguridad social": "seg-social.es",
  "generalitat valenciana": "gva.es",
  "junta de andalucia": "juntadeandalucia.es",
  caritas: "caritas.es",
  unicef: "unicef.es",
  "don bosco": "salesianos.es",
  salesianos: "salesianos.es",
  "hijas de la caridad": "hijasdelacaridad.org",
}

/** Formas jurídicas y palabras que no ayudan a adivinar un dominio. */
const RUIDO_DOMINIO = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "grupo", "hermanos"])

/**
 * Dominios candidatos para un proveedor, del más fiable al más especulativo.
 * Quien los use debe probarlos en orden y quedarse con el primero que
 * responda con una imagen.
 *
 * `dominioExplicito` (el que alguien ha escrito en la ficha) siempre gana; el
 * catálogo va después; y solo al final se especula con el nombre.
 */
export function dominiosCandidatos(
  nombre: string | null | undefined,
  dominioExplicito?: string | null,
  opciones: { especular?: boolean } = {},
): string[] {
  const candidatos: string[] = []

  const limpio = limpiarDominio(dominioExplicito)
  if (limpio) candidatos.push(limpio)

  const clave = normalizarClaveProveedor(nombre)
  if (!clave) return candidatos

  const conocido = DOMINIOS_CONOCIDOS[clave]
  if (conocido) candidatos.push(conocido)

  // La especulación acierta a menudo ("Rutas Rodriguez" → rutasrodriguez.com),
  // pero también puede acertar un dominio aparcado o de otra empresa con nombre
  // parecido, y entonces el proveedor se queda con el logo de un desconocido.
  // Por eso viene desactivada por defecto: solo especula quien ha pulsado
  // "Buscar logo" a mano y ve el resultado al instante para poder quitarlo.
  if (opciones.especular) {
    const palabras = clave.split(" ").filter((p) => !RUIDO_DOMINIO.has(p))
    const pegado = palabras.join("")
    if (pegado.length >= 3) {
      candidatos.push(`${pegado}.es`, `${pegado}.com`)
    }
    if (palabras.length > 1 && palabras[0].length >= 4) {
      candidatos.push(`${palabras[0]}.es`)
    }
  }

  // Sin duplicados, conservando el orden de fiabilidad.
  return Array.from(new Set(candidatos))
}

/**
 * Deja un dominio en su forma canónica: sin esquema, sin `www.`, sin ruta y en
 * minúsculas. Devuelve null si lo que hay no puede ser un dominio.
 */
export function limpiarDominio(valor: string | null | undefined): string | null {
  const bruto = (valor ?? "").trim().toLowerCase()
  if (!bruto) return null

  const sinEsquema = bruto
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/\.$/, "")

  // Un dominio tiene al menos un punto y un TLD de dos letras o más.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(sinEsquema)) {
    return null
  }

  return sinEsquema
}
