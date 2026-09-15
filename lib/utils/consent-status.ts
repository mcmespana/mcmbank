/**
 * Umbral (en días) por debajo del cual avisamos de que el consentimiento PSD2
 * de una cuenta conectada está a punto de caducar y hay que renovarlo.
 */
export const CONSENT_WARNING_DAYS = 20

export interface ConsentStatus {
  /** Días enteros que faltan para caducar (negativo si ya caducó). */
  diasRestantes: number
  expirado: boolean
  /** true si conviene mostrar un aviso (caducado o caduca pronto). */
  requiereAviso: boolean
}

/**
 * Calcula el estado del consentimiento de una conexión de Enable Banking a
 * partir de `banco_conexion.estado` y `consent_valid_until`. Compartido entre
 * el banner del Dashboard (`useConsentAlerts`) y la tarjeta de cuenta en
 * `/cuentas`, para que ambos avisen con el mismo criterio.
 */
export function getConsentStatus(
  estado: string | null | undefined,
  consentValidUntil: string | null | undefined,
): ConsentStatus | null {
  if (!consentValidUntil) return null

  const until = new Date(consentValidUntil).getTime()
  if (Number.isNaN(until)) return null

  const now = Date.now()
  const diasRestantes = Math.ceil((until - now) / 86_400_000)
  const expirado = until < now || estado === "expirada" || estado === "revocada"

  return {
    diasRestantes,
    expirado,
    requiereAviso: expirado || diasRestantes <= CONSENT_WARNING_DAYS,
  }
}

/** Texto corto y consistente para mostrar un estado de consentimiento en pantalla. */
export function textoConsentimiento(status: Pick<ConsentStatus, "diasRestantes" | "expirado">): string {
  if (status.expirado) return "Consentimiento caducado"
  if (status.diasRestantes <= 0) return "Caduca hoy"
  if (status.diasRestantes === 1) return "Caduca mañana"
  return `Caduca en ${status.diasRestantes} días`
}
