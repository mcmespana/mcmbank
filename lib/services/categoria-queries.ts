// Lógica de query compartida entre DatabaseService (cliente) y
// ServerDatabaseService (servidor) para categoria_orden_delegacion.
// Client-agnostic: recibe el cliente Supabase ya instanciado por el caller.

/**
 * Fija el orden de una categoría para una delegación, con upsert atómico
 * (evita la carrera update-then-insert de la versión anterior). Solo toca
 * `orden`: si la fila no existía, `esta_activa` toma su DEFAULT (true) en la
 * tabla; si ya existía, `esta_activa` se deja como estaba (no se incluye en
 * el payload, así que PostgREST no la sobreescribe en el UPDATE del upsert).
 */
export async function upsertCategoriaOrden(
  supabase: any,
  params: { delegacionId: string; categoriaId: string; orden: number },
): Promise<void> {
  const { error } = await supabase.from("categoria_orden_delegacion").upsert(
    {
      delegacion_id: params.delegacionId,
      categoria_id: params.categoriaId,
      orden: params.orden,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "delegacion_id,categoria_id" },
  )

  if (error) throw error
}

/**
 * Fija la visibilidad (esta_activa) de una categoría para una delegación,
 * con upsert atómico. Incluye `orden: ordenFallback` porque la fila es
 * NOT NULL sin DEFAULT en esa columna (hace falta un valor si la fila es
 * nueva); el caller siempre pasa el orden efectivo actual, así que si la
 * fila ya existía, el upsert lo deja en el mismo valor que ya tenía.
 */
export async function upsertCategoriaVisibilidad(
  supabase: any,
  params: { delegacionId: string; categoriaId: string; estaActiva: boolean; ordenFallback: number },
): Promise<void> {
  const { error } = await supabase.from("categoria_orden_delegacion").upsert(
    {
      delegacion_id: params.delegacionId,
      categoria_id: params.categoriaId,
      esta_activa: params.estaActiva,
      orden: params.ordenFallback,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "delegacion_id,categoria_id" },
  )

  if (error) throw error
}
