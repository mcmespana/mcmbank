"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { EmojiPicker } from "frimousse"
import { Plus } from "lucide-react"

// Emojis recomendados organizados por categorías
const emojiCategories = [
  {
    label: "💰 Dineritos",
    emojis: ["💶","💵","💳","🏦","📈","📉","🧾","💸","🪙","🤑","🤲"]
  },
  {
    label: "🍕 Comida & Campamentos",
    emojis: ["🍞","🥪","🍕","🍎","🍫","🥤","🍲","🧃","🍉","🥘","🌭","🔥","🏕️"]
  },
  {
    label: "🚌 Transporte & Aventuras",
    emojis: ["🚌","🚐","🚍","🚎","🚲","🛴","🚏","⛽","🛣️","🗺️","🧭","🛟","🚦"]
  },
  {
    label: "📚 Materiales & Actividades",
    emojis: ["📚","✏️","🖍️","🖊️","📒","📦","🛍️","🎲","🎨","🎭","🎶","🥁","⚽","🏀","🏐","🧩","🔭","🪁"]
  },
  {
    label: "💻 Tech & Comms",
    emojis: ["💻","🖥️","🖱️","📱","📡","📷","🎤","🎧","📹","🛰️","⌨️","🖨️","🤖","📢"]
  },
  {
    label: "🎉 Eventos & Fiestuqui",
    emojis: ["🎉","🥳","🎊","🏟️","🏫","⛪","🎪","🤹","🎤","🎬","🎯","🪩","🎇","🎆","🕺","💃","🎷"]
  },
  {
    label: "🙋 Personas & Voluntariado",
    emojis: ["🙋","🙋‍♂️","🙋‍♀️","👥","🫂","🤝","🤲","💬","❤️","✨","🌍","✝️","☮️","🤗","🤪","🦸","🧙‍♂️"]
  },
  {
    label: "🧩 Emojis chulísimos",
    emojis: ["🦄","🪅","🪩","🛸","🦖","🥷","🪗","🪀","🧃","🧦","🥒","🧌","👾","🍄","🐙"]
  }
]

interface EmojiPickerButtonProps {
  value?: string
  onChange: (emoji: string) => void
  className?: string
  size?: "sm" | "md" | "lg"
}

export function EmojiPickerButton({ value = "📁", onChange, className, size = "md" }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false)
  const [showFullPicker, setShowFullPicker] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)

  const sizeClasses = {
    sm: "h-8 w-8 text-sm",
    md: "h-10 w-10 text-lg",
    lg: "h-12 w-12 text-xl",
  }

  useEffect(() => {
    if (showFullPicker) {
      // Usamos un pequeño timeout para asegurar que el elemento es visible y focuseable
      setTimeout(() => {
        viewportRef.current?.focus()
      }, 100)
    }
  }, [showFullPicker])

  const handleEmojiSelect = (emoji: { emoji: string }) => {
    onChange(emoji.emoji)
    setOpen(false)
    setShowFullPicker(false)
  }

  const handleQuickEmojiSelect = (emoji: string) => {
    onChange(emoji)
    setOpen(false)
    setShowFullPicker(false)
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
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-96 p-0" align="start">
        {!showFullPicker ? (
          // ... (vista de emojis recomendados sin cambios)
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Elige un emoji</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullPicker(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Ver todos <Plus className="ml-1 h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {emojiCategories.map((category, categoryIndex) => (
                <div key={categoryIndex} className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">{category.label}</h4>
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-0.5">
                    {category.emojis.map((emoji, emojiIndex) => (
                      <Button
                        key={`${emoji}-${emojiIndex}`}
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0 hover:bg-accent hover:scale-110 transition-[background-color,transform] duration-150"
                        onClick={() => handleQuickEmojiSelect(emoji)}
                      >
                        <span className="text-xl">{emoji}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Vista del picker completo - AHORA SÍ
          <div className="w-full">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="text-sm font-semibold">Todos los emojis</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullPicker(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Volver
              </Button>
            </div>
            <EmojiPicker.Root onEmojiSelect={handleEmojiSelect}>
              <div className="p-3 border-b">
                <EmojiPicker.Search
                  placeholder="Buscar emoji..."
                  className="w-full appearance-none rounded-md bg-accent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <EmojiPicker.Viewport
                ref={viewportRef}
                className="h-96 overflow-y-auto focus:outline-none force-scroll"
                tabIndex={-1}
              >
                <EmojiPicker.Loading className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    Cargando emojis...
                  </div>
                </EmojiPicker.Loading>
                <EmojiPicker.Empty className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                  <div className="text-center">
                    <div className="text-2xl mb-2">🔍</div>
                    No se encontraron emojis
                  </div>
                </EmojiPicker.Empty>
                <EmojiPicker.List
                  className="pb-2"
                  components={{
                    CategoryHeader: ({ category, ...props }) => (
                      <div
                        className="sticky top-0 bg-background/95 backdrop-blur-sm px-3 py-2 text-xs font-semibold text-primary border-b border-border/50 z-10"
                        {...props}
                      >
                        {category.label}
                      </div>
                    ),
                    Row: ({ children, ...props }) => (
                      <div className="flex gap-0.5 px-2 py-0.5" {...props}>
                        {children}
                      </div>
                    ),
                    Emoji: ({ emoji, ...props }) => (
                      <button
                        className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent data-[active]:bg-accent data-[active]:scale-110 transition-[background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        {...props}
                      >
                        <span className="text-xl">{emoji.emoji}</span>
                      </button>
                    ),
                  }}
                />
              </EmojiPicker.Viewport>
            </EmojiPicker.Root>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
