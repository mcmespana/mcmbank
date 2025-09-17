import { NextResponse } from "next/server"

import { ServerDatabaseService } from "@/lib/services/server-database"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const delegaciones = await ServerDatabaseService.getUserDelegaciones(user.id)
    return NextResponse.json({ delegaciones })
  } catch (error) {
    console.error("Error fetching delegaciones", error)
    return NextResponse.json({ error: "Error cargando delegaciones" }, { status: 500 })
  }
}

