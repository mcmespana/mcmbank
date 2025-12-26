import { NextResponse } from "next/server"
import { requireGestorCentral } from "@/lib/services/enablebanking-auth"
import { syncEnableBankingLink } from "@/lib/services/enablebanking-sync"

export async function POST(req: Request) {
  const auth = await requireGestorCentral()
  if (auth.error) return auth.error

  try {
    const body = await req.json()
    const linkId = body.link_id as string | undefined
    const systemUserId = process.env.ENABLEBANKING_SYSTEM_USER_ID || auth.user.id

    const results = await syncEnableBankingLink({
      linkId,
      systemUserId,
    })

    return NextResponse.json({ ok: true, results })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error sincronizando" }, { status: 500 })
  }
}
