import { colorCodigo } from "@/lib/utils/subvenciones"
import { cn } from "@/lib/utils"

/**
 * La pastilla del código (`GVA VOL`, `IVAJ`…) con el color con que se pintaba
 * en el Excel (`colorCodigo()`). El color acompaña al texto, nunca lo sustituye.
 */
export function CodigoSubvencion({
  codigo,
  nombre,
  className,
}: {
  codigo: string
  nombre?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none",
        colorCodigo(codigo, nombre),
        className,
      )}
    >
      {codigo}
    </span>
  )
}
