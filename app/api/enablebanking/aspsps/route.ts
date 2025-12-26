import { NextResponse } from "next/server"
import { listAspsps } from "@/lib/services/enablebanking-api"
import { requireGestorCentral } from "@/lib/services/enablebanking-auth"

export async function GET(req: Request) {
  const auth = await requireGestorCentral()
  if (auth.error) return auth.error

  const { searchParams } = new URL(req.url)
  const country = searchParams.get("country") || undefined
  const psuType = searchParams.get("psu_type") || undefined
  const service = searchParams.get("service") || undefined

  try {
    const data = await listAspsps({ country, psu_type: psuType, service })
    return NextResponse.json({ aspsps: data.aspsps || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error cargando bancos" }, { status: 500 })
  }
}
