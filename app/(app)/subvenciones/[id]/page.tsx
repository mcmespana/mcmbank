import { SubvencionDetail } from "@/components/subvenciones/subvencion-detail"

export default async function SubvencionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SubvencionDetail id={id} />
}
