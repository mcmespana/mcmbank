"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, type LucideIcon } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ConfirmButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  /** Texto en reposo. */
  label: string
  /** Texto tras el primer clic. Por defecto, "¿Seguro?". */
  confirmLabel?: string
  /** Texto mientras se ejecuta. */
  busyLabel?: string
  icon?: LucideIcon
  onConfirm: () => void | Promise<void>
  /** Segundos que espera armado antes de volver a reposo. */
  segundosArmado?: number
}

/**
 * Botón de acción irreversible en dos clics, sin diálogo de por medio.
 *
 * Un modal para "¿seguro que quieres eliminar?" es un gesto caro (aparece,
 * roba el foco, hay que leerlo y buscar el botón bueno) para una decisión que
 * casi siempre ya está tomada. Dos clics sobre el mismo sitio cuestan mucho
 * menos y siguen impidiendo el borrado por accidente, que es de lo que se
 * trata: el primero cambia el botón, y hasta que no cambia no hay nada que
 * pulsar dos veces seguidas por error.
 *
 * Se desarma solo a los pocos segundos y al salir el ratón, para que no se
 * quede una bomba armada esperando en la esquina.
 */
export function ConfirmButton({
  label,
  confirmLabel = "¿Seguro?",
  busyLabel,
  icon: Icon,
  onConfirm,
  segundosArmado = 4,
  className,
  variant = "ghost",
  size = "sm",
  disabled,
  ...props
}: ConfirmButtonProps) {
  const [armado, setArmado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const desarmar = () => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
    setArmado(false)
  }

  useEffect(() => () => desarmar(), [])

  const handleClick = async () => {
    if (!armado) {
      setArmado(true)
      temporizador.current = setTimeout(() => setArmado(false), segundosArmado * 1000)
      return
    }
    desarmar()
    setOcupado(true)
    try {
      await onConfirm()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Button
      type="button"
      variant={armado ? "destructive" : variant}
      size={size}
      disabled={disabled || ocupado}
      onClick={handleClick}
      onMouseLeave={() => armado && desarmar()}
      onBlur={() => armado && desarmar()}
      aria-live="polite"
      className={cn("transition-colors", className)}
      {...props}
    >
      {ocupado ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
      ) : null}
      {ocupado ? (busyLabel ?? label) : armado ? confirmLabel : label}
    </Button>
  )
}
