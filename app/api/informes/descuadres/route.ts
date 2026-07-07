import { NextResponse } from "next/server"
import { requireDelegationAccess } from "@/lib/services/informe-auth"
import {
  buildContext,
  buildDefaultMapeo,
  computeDescuadres,
  type MapeoConfig,
  type PeriodoTipo,
} from "@/lib/services/memoria-economica"

const MAX_MOVIMIENTOS = 300

/**
 * Movimientos del periodo que descuadran la memoria económica (sin categoría,
 * de categorías sin fila en el informe, o contados en más de una fila).
 */
export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const delegacionId = body.delegacionId as string
  const periodoTipo = (body.periodoTipo as PeriodoTipo) || "curso"
  const anio = Number(body.anio)
  const mapeoEntrada = (body.mapeo as MapeoConfig | undefined) ?? null

  if (!anio) return NextResponse.json({ error: "Falta el año" }, { status: 400 })

  const access = await requireDelegationAccess(delegacionId)
  if (access.error) return access.error

  try {
    const ctx = await buildContext(access.supabase, delegacionId, periodoTipo, anio)
    const mapeo = mapeoEntrada ?? buildDefaultMapeo(ctx)
    const todos = computeDescuadres(ctx, mapeo)
    return NextResponse.json({
      movimientos: todos.slice(0, MAX_MOVIMIENTOS),
      total: todos.length,
      periodo: { inicio: ctx.rango.inicio, fin: ctx.rango.fin },
    })
  } catch (err: any) {
    console.error("Error en descuadres de memoria:", err?.message || err)
    return NextResponse.json(
      { error: err?.message || "Error calculando los descuadres" },
      { status: 500 },
    )
  }
}
