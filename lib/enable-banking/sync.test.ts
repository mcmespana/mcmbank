import { describe, it, expect, beforeEach, vi } from "vitest"
import { crearFakeAdmin, type Tablas } from "@/lib/test-utils/fake-admin"

/**
 * `syncCuenta` es el motor que trae dinero real desde el banco a la tabla
 * `movimiento`. Lo que hay que comprobar no es Enable Banking (eso no se
 * puede probar sin red), sino las reglas de negocio alrededor: que un
 * external_id ya visto no se duplique, que el signo del importe salga
 * correcto, que una sesión caducada se marque y no se reintente en silencio,
 * que la ventana de la primera sync retroceda si el banco rechaza la más
 * larga, que una paginación truncada se marque "parcial" en vez de perder
 * movimientos callados, y que el saldo inicial y el auto-enlace con pagos
 * MCM solo actúen cuando de verdad hay un único candidato razonable.
 */

vi.mock("@/lib/enable-banking/client", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/enable-banking/client")>()
  return {
    ...real,
    enableBanking: {
      getSession: vi.fn(),
      getAllTransactions: vi.fn(),
      getBalances: vi.fn(),
    },
  }
})

const CUENTA_ID = "cuenta-1"
const DELEGACION_ID = "delegacion-1"
const CONEXION_ID = "conexion-1"
const CREADOR = "11111111-1111-1111-1111-111111111111"

function cuentaRow(over: Record<string, any> = {}) {
  return {
    id: CUENTA_ID,
    delegacion_id: DELEGACION_ID,
    nombre: "Cuenta corriente",
    sync_enabled: true,
    external_account_uid: "eb-account-uid",
    banco_conexion_id: CONEXION_ID,
    last_sync_at: "2026-03-01T00:00:00Z",
    sync_desde_fecha: null,
    ...over,
  }
}

function conexionRow(over: Record<string, any> = {}) {
  return {
    id: CONEXION_ID,
    session_id: "session-abc",
    aspsp_name: "Banco Test",
    aspsp_country: "ES",
    estado: "autorizada",
    consent_valid_until: "2030-01-01T00:00:00Z",
    creado_por: CREADOR,
    ...over,
  }
}

function tx(over: Record<string, any> = {}) {
  return {
    status: "BOOK",
    credit_debit_indicator: "DBIT",
    transaction_amount: { currency: "EUR", amount: "50.00" },
    booking_date: "2026-03-10",
    remittance_information: ["Compra supermercado"],
    ...over,
  }
}

function sesionValida(over: Record<string, any> = {}) {
  return {
    session_id: "session-abc",
    accounts: [{ uid: "eb-account-uid" }],
    aspsp: { name: "Banco Test", country: "ES" },
    psu_type: "business",
    access: { valid_until: "2030-01-01T00:00:00Z" },
    ...over,
  }
}

function tablas(extra: Partial<Tablas> = {}): Tablas {
  return {
    cuenta: [cuentaRow()],
    banco_conexion: [conexionRow()],
    banco_sync_log: [],
    movimiento: [],
    pago_mcm: [],
    ...extra,
  }
}

async function setup(t: Tablas = tablas()) {
  vi.resetModules()
  const admin = crearFakeAdmin(t) as any
  const { syncCuenta, syncTodasLasCuentas } = await import("@/lib/enable-banking/sync")
  const { enableBanking } = await import("@/lib/enable-banking/client")
  return { admin, syncCuenta, syncTodasLasCuentas, enableBanking: enableBanking as any }
}

function paginaUnica(transacciones: any[], continuation_key?: string) {
  return { pages: [{ transactions: transacciones, continuation_key }], truncated: false }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------

describe("syncCuenta · validación previa", () => {
  it("una cuenta sin conexión a Enable Banking no llega a pedir nada al banco", async () => {
    const { admin, syncCuenta, enableBanking } = await setup(
      tablas({ cuenta: [cuentaRow({ external_account_uid: null, banco_conexion_id: null })] }),
    )
    await expect(syncCuenta(admin, CUENTA_ID)).rejects.toThrow("no está conectada")
    expect(enableBanking.getSession).not.toHaveBeenCalled()
  })

  it("un consentimiento ya caducado se rechaza antes de tocar el banco", async () => {
    const { admin, syncCuenta, enableBanking } = await setup(
      tablas({ banco_conexion: [conexionRow({ consent_valid_until: "2020-01-01T00:00:00Z" })] }),
    )
    await expect(syncCuenta(admin, CUENTA_ID)).rejects.toThrow("expiró")
    expect(enableBanking.getSession).not.toHaveBeenCalled()
  })

  it("una cuenta inexistente falla con un mensaje claro", async () => {
    const { admin, syncCuenta } = await setup(tablas({ cuenta: [] }))
    await expect(syncCuenta(admin, CUENTA_ID)).rejects.toThrow(`No se pudo cargar la cuenta ${CUENTA_ID}`)
  })
})

describe("syncCuenta · sesión caducada", () => {
  it("un 401 al comprobar la sesión marca la conexión como expirada y no importa nada", async () => {
    const { EnableBankingError } = await import("@/lib/enable-banking/client")
    const { admin, syncCuenta, enableBanking } = await setup()
    enableBanking.getSession.mockRejectedValue(new EnableBankingError("/sessions/x", 401, {}))

    const res = await syncCuenta(admin, CUENTA_ID)

    expect(res.estado).toBe("error")
    expect(res.error_mensaje).toContain("expirada")
    expect(admin.tablas.banco_conexion[0].estado).toBe("expirada")
    expect(admin.tablas.movimiento).toHaveLength(0)
  })
})

describe("syncCuenta · importa transacciones", () => {
  it("inserta un gasto y un ingreso con el signo correcto", async () => {
    const { admin, syncCuenta, enableBanking } = await setup()
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue(
      paginaUnica([
        tx({ transaction_id: "t1", credit_debit_indicator: "DBIT", transaction_amount: { currency: "EUR", amount: "50.00" } }),
        tx({ transaction_id: "t2", credit_debit_indicator: "CRDT", transaction_amount: { currency: "EUR", amount: "120.00" } }),
      ]),
    )

    const res = await syncCuenta(admin, CUENTA_ID, { trigger: "manual", iniciadoPor: CREADOR })

    expect(res.estado).toBe("ok")
    expect(res.recibidas).toBe(2)
    expect(res.insertadas).toBe(2)
    expect(res.duplicadas).toBe(0)

    const importes = admin.tablas.movimiento.map((m: any) => m.importe).sort((a: number, b: number) => a - b)
    expect(importes).toEqual([-50, 120])
    expect(admin.tablas.movimiento.every((m: any) => m.delegacion_id === DELEGACION_ID)).toBe(true)
    expect(admin.tablas.cuenta[0].last_sync_status).toBe("ok")
    expect(admin.tablas.cuenta[0].last_sync_at).toBeTruthy()

    const log = admin.tablas.banco_sync_log[0]
    expect(log.estado).toBe("ok")
    expect(log.transacciones_insertadas).toBe(2)
  })

  it("una transacción cuyo external_id ya existe se cuenta como duplicada, no se reinserta", async () => {
    const existente = {
      id: "mov-existente",
      cuenta_id: CUENTA_ID,
      delegacion_id: DELEGACION_ID,
      external_id: "tid:t1",
      importe: -50,
      fecha: "2026-03-09",
    }
    const { admin, syncCuenta, enableBanking } = await setup(tablas({ movimiento: [existente] }))
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue(
      paginaUnica([tx({ transaction_id: "t1", transaction_amount: { currency: "EUR", amount: "50.00" } })]),
    )

    const res = await syncCuenta(admin, CUENTA_ID)

    expect(res.duplicadas).toBe(1)
    expect(res.insertadas).toBe(0)
    expect(admin.tablas.movimiento).toHaveLength(1) // sigue siendo solo la que ya había
  })

  it("una paginación truncada se marca 'parcial' en vez de perder movimientos en silencio", async () => {
    const { admin, syncCuenta, enableBanking } = await setup()
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue({
      pages: [{ transactions: [tx({ transaction_id: "t1" })], continuation_key: "sigue" }],
      truncated: true,
    })

    const res = await syncCuenta(admin, CUENTA_ID)

    expect(res.estado).toBe("parcial")
    expect(res.error_mensaje).toContain("Paginación truncada")
  })

  it("sin transacciones nuevas en la ventana, termina en 'ok' sin insertar nada", async () => {
    const { admin, syncCuenta, enableBanking } = await setup()
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue(paginaUnica([]))

    const res = await syncCuenta(admin, CUENTA_ID)
    expect(res.estado).toBe("ok")
    expect(res.recibidas).toBe(0)
    expect(admin.tablas.movimiento).toHaveLength(0)
  })
})

describe("syncCuenta · ventana de la primera sync", () => {
  it("si el banco rechaza la ventana más amplia con 400, prueba la siguiente más corta", async () => {
    const { EnableBankingError } = await import("@/lib/enable-banking/client")
    const { admin, syncCuenta, enableBanking } = await setup(
      tablas({ cuenta: [cuentaRow({ last_sync_at: null })] }),
    )
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions
      .mockRejectedValueOnce(new EnableBankingError("/transactions", 400, { error: "date_from too old" }))
      .mockResolvedValueOnce(paginaUnica([tx({ transaction_id: "t1" })]))

    const res = await syncCuenta(admin, CUENTA_ID)

    expect(enableBanking.getAllTransactions).toHaveBeenCalledTimes(2)
    expect(res.estado).toBe("ok")
    expect(res.insertadas).toBe(1)
    const log = admin.tablas.banco_sync_log[0]
    expect(JSON.stringify(log.log)).toContain("limitó el histórico")
  })

  it("si TODAS las ventanas fallan con 400, la sync termina en error con el último motivo", async () => {
    const { EnableBankingError } = await import("@/lib/enable-banking/client")
    const { admin, syncCuenta, enableBanking } = await setup(
      tablas({ cuenta: [cuentaRow({ last_sync_at: null })] }),
    )
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockRejectedValue(
      new EnableBankingError("/transactions", 400, { error: "nope" }),
    )

    const res = await syncCuenta(admin, CUENTA_ID)
    expect(res.estado).toBe("error")
    expect(enableBanking.getAllTransactions).toHaveBeenCalledTimes(4) // las 4 ventanas candidatas
  })

  it("con sync_desde_fecha fijada a mano, no hay fallback: se respeta esa fecha exacta", async () => {
    const { admin, syncCuenta, enableBanking } = await setup(
      tablas({ cuenta: [cuentaRow({ last_sync_at: null, sync_desde_fecha: "2025-01-01" })] }),
    )
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue(paginaUnica([]))

    await syncCuenta(admin, CUENTA_ID)
    expect(enableBanking.getAllTransactions).toHaveBeenCalledTimes(1)
    expect(enableBanking.getAllTransactions.mock.calls[0][1]).toMatchObject({ date_from: "2025-01-01" })
  })
})

describe("syncCuenta · saldo inicial (solo primera sync)", () => {
  it("calcula el saldo inicial como balance del banco menos la suma de movimientos importados", async () => {
    const { admin, syncCuenta, enableBanking } = await setup(
      tablas({ cuenta: [cuentaRow({ last_sync_at: null, sync_desde_fecha: "2026-03-01" })] }),
    )
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue(
      paginaUnica([
        tx({
          transaction_id: "t1",
          booking_date: "2026-03-05",
          credit_debit_indicator: "CRDT",
          transaction_amount: { currency: "EUR", amount: "40.00" },
        }),
      ]),
    )
    enableBanking.getBalances.mockResolvedValue({
      balances: [{ balance_type: "CLBD", balance_amount: { currency: "EUR", amount: "460.00" } }],
    })

    await syncCuenta(admin, CUENTA_ID)

    // Un ingreso de 40 ya importado + saldo_inicial (que se calcula) = 460.
    const saldoInicial = admin.tablas.movimiento.find((m: any) => m.concepto === "Saldo inicial")
    expect(saldoInicial).toBeDefined()
    expect(saldoInicial.importe).toBe(420)
    expect(saldoInicial.fecha).toBe("2026-03-04") // día antes del primer movimiento
    expect(saldoInicial.external_id).toBe(`opening:${CUENTA_ID}`)
  })

  it("es idempotente: si ya existe un saldo inicial, no lo recalcula", async () => {
    const yaExiste = { id: "mov-saldo", cuenta_id: CUENTA_ID, external_id: `opening:${CUENTA_ID}` }
    const { admin, syncCuenta, enableBanking } = await setup(
      tablas({
        cuenta: [cuentaRow({ last_sync_at: null })],
        movimiento: [yaExiste],
      }),
    )
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue(paginaUnica([]))

    await syncCuenta(admin, CUENTA_ID)
    expect(enableBanking.getBalances).not.toHaveBeenCalled()
    expect(admin.tablas.movimiento).toHaveLength(1) // solo el que ya había
  })

  it("si el saldo calculado es ~0, no inserta el movimiento de saldo inicial", async () => {
    const { admin, syncCuenta, enableBanking } = await setup(
      tablas({ cuenta: [cuentaRow({ last_sync_at: null, sync_desde_fecha: "2026-03-01" })] }),
    )
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue(
      paginaUnica([tx({ transaction_id: "t1", transaction_amount: { currency: "EUR", amount: "40.00" }, credit_debit_indicator: "CRDT" })]),
    )
    enableBanking.getBalances.mockResolvedValue({
      balances: [{ balance_type: "CLBD", balance_amount: { currency: "EUR", amount: "40.00" } }],
    })

    await syncCuenta(admin, CUENTA_ID)
    expect(admin.tablas.movimiento.some((m: any) => m.concepto === "Saldo inicial")).toBe(false)
  })

  it("si el banco no devuelve balances, no rompe la sync (queda sin saldo inicial)", async () => {
    const { admin, syncCuenta, enableBanking } = await setup(
      tablas({ cuenta: [cuentaRow({ last_sync_at: null, sync_desde_fecha: "2026-03-01" })] }),
    )
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue(paginaUnica([]))
    enableBanking.getBalances.mockRejectedValue(new Error("el banco no soporta balances"))

    const res = await syncCuenta(admin, CUENTA_ID)
    expect(res.estado).toBe("ok")
    expect(admin.tablas.movimiento).toHaveLength(0)
  })
})

describe("syncCuenta · auto-vinculación con pagos MCM pendientes", () => {
  it("un único pago pendiente con el mismo importe y fecha cercana se vincula solo", async () => {
    const pago = {
      id: "pago-1",
      delegacion_id: DELEGACION_ID,
      estado: "pendiente",
      movimiento_id: null,
      importe: 50,
      creado_en: "2026-03-09T00:00:00",
      contacto_id: null,
    }
    const { admin, syncCuenta, enableBanking } = await setup(tablas({ pago_mcm: [pago] }))
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue(
      paginaUnica([
        tx({ transaction_id: "t1", credit_debit_indicator: "DBIT", booking_date: "2026-03-10", transaction_amount: { currency: "EUR", amount: "50.00" } }),
      ]),
    )

    await syncCuenta(admin, CUENTA_ID)

    const movimiento = admin.tablas.movimiento.find((m: any) => m.external_id === "tid:t1")
    expect(movimiento.pago_mcm_id).toBe("pago-1")
    expect(admin.tablas.pago_mcm[0].movimiento_id).toBe(movimiento.id)
  })

  it("con dos candidatos igual de válidos, no decide por su cuenta", async () => {
    const pago1 = { id: "pago-1", delegacion_id: DELEGACION_ID, estado: "pendiente", movimiento_id: null, importe: 50, creado_en: "2026-03-09T00:00:00" }
    const pago2 = { id: "pago-2", delegacion_id: DELEGACION_ID, estado: "pendiente", movimiento_id: null, importe: 50, creado_en: "2026-03-08T00:00:00" }
    const { admin, syncCuenta, enableBanking } = await setup(tablas({ pago_mcm: [pago1, pago2] }))
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue(
      paginaUnica([tx({ transaction_id: "t1", booking_date: "2026-03-10", transaction_amount: { currency: "EUR", amount: "50.00" } })]),
    )

    await syncCuenta(admin, CUENTA_ID)

    const movimiento = admin.tablas.movimiento.find((m: any) => m.external_id === "tid:t1")
    expect(movimiento.pago_mcm_id ?? null).toBeNull()
    expect(admin.tablas.pago_mcm.every((p: any) => p.movimiento_id === null)).toBe(true)
  })

  it("un ingreso (no es un gasto) nunca se vincula a un pago MCM", async () => {
    const pago = { id: "pago-1", delegacion_id: DELEGACION_ID, estado: "pendiente", movimiento_id: null, importe: 50, creado_en: "2026-03-09T00:00:00" }
    const { admin, syncCuenta, enableBanking } = await setup(tablas({ pago_mcm: [pago] }))
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue(
      paginaUnica([
        tx({ transaction_id: "t1", credit_debit_indicator: "CRDT", booking_date: "2026-03-10", transaction_amount: { currency: "EUR", amount: "50.00" } }),
      ]),
    )

    await syncCuenta(admin, CUENTA_ID)
    expect(admin.tablas.pago_mcm[0].movimiento_id).toBeNull()
  })

  it("fuera de la ventana de +/-3 días, no se vincula", async () => {
    const pago = { id: "pago-1", delegacion_id: DELEGACION_ID, estado: "pendiente", movimiento_id: null, importe: 50, creado_en: "2026-02-01T00:00:00" }
    const { admin, syncCuenta, enableBanking } = await setup(tablas({ pago_mcm: [pago] }))
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue(
      paginaUnica([tx({ transaction_id: "t1", booking_date: "2026-03-10", transaction_amount: { currency: "EUR", amount: "50.00" } })]),
    )

    await syncCuenta(admin, CUENTA_ID)
    expect(admin.tablas.pago_mcm[0].movimiento_id).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe("syncTodasLasCuentas", () => {
  it("salta las cuentas cuya conexión no está autorizada o el consentimiento caducó", async () => {
    const cuentaSinAutorizar = {
      id: "cuenta-2",
      sync_enabled: true,
      banco_conexion_id: "conexion-2",
      banco_conexion: { estado: "revocada", consent_valid_until: "2030-01-01T00:00:00Z" },
    }
    const cuentaCaducada = {
      id: "cuenta-3",
      sync_enabled: true,
      banco_conexion_id: "conexion-3",
      banco_conexion: { estado: "autorizada", consent_valid_until: "2020-01-01T00:00:00Z" },
    }
    const { admin, syncTodasLasCuentas, enableBanking } = await setup(
      tablas({ cuenta: [cuentaSinAutorizar, cuentaCaducada] }),
    )

    const { resultados } = await syncTodasLasCuentas(admin)

    expect(resultados).toHaveLength(2)
    expect(resultados.every((r) => r.estado === "error")).toBe(true)
    expect(enableBanking.getSession).not.toHaveBeenCalled()
  })

  it("sincroniza cada cuenta elegible de forma independiente: una que falla no frena a las demás", async () => {
    const buena = {
      ...cuentaRow({ id: "cuenta-buena", banco_conexion_id: "conexion-buena" }),
      banco_conexion: { estado: "autorizada", consent_valid_until: "2030-01-01T00:00:00Z" },
    }
    const rota = {
      ...cuentaRow({ id: "cuenta-rota", banco_conexion_id: "conexion-rota" }),
      banco_conexion: { estado: "autorizada", consent_valid_until: "2030-01-01T00:00:00Z" },
    }
    const { admin, syncTodasLasCuentas, enableBanking } = await setup(
      tablas({
        cuenta: [buena, rota],
        banco_conexion: [
          conexionRow({ id: "conexion-buena" }),
          conexionRow({ id: "conexion-rota", session_id: null }), // sin session_id: syncCuenta la rechaza
        ],
      }),
    )
    enableBanking.getSession.mockResolvedValue(sesionValida())
    enableBanking.getAllTransactions.mockResolvedValue(paginaUnica([]))

    const { resultados } = await syncTodasLasCuentas(admin)

    const porId = new Map(resultados.map((r) => [r.cuenta_id, r]))
    expect(porId.get("cuenta-buena")?.estado).toBe("ok")
    expect(porId.get("cuenta-rota")?.estado).toBe("error")
  })
})
