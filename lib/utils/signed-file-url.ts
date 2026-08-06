export async function getSignedFileUrl(pathStorage: string, bucket: "facturas" | "documentos"): Promise<string> {
  const res = await fetch("/api/files/signed-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: pathStorage, bucket }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error || "No se pudo generar el enlace del archivo")
  }

  const { url } = await res.json()
  return url as string
}
