"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import dynamic from "next/dynamic"

// Importar el emoji picker de forma dinámica para evitar problemas de SSR
const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => <div className="p-4 text-center">Cargando emojis...</div>,
})

interface EmojiPickerButtonProps {
  value?: string
  onChange: (emoji: string) => void
  className?: string
  size?: "sm" | "md" | "lg"
}

export function EmojiPickerButton({ value = "📁", onChange, className, size = "md" }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false)

  const sizeClasses = {
    sm: "h-8 w-8 text-sm",
    md: "h-10 w-10 text-lg",
    lg: "h-12 w-12 text-xl",
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`${sizeClasses[size]} ${className}`}
          type="button"
        >
          <span className="text-2xl">{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <EmojiPicker
          onEmojiClick={(emojiObject) => {
            onChange(emojiObject.emoji)
            setOpen(false)
          }}
          autoFocusSearch={false}
          searchPlaceholder="Buscar emoji..."
          width={350}
          height={400}
        />
      </PopoverContent>
    </Popover>
  )
}