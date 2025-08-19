"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Palette } from "lucide-react"

interface ColorPickerProps {
  value?: string
  onChange: (color: string) => void
  className?: string
}

// Colores predefinidos especialmente chulos
const PREDEFINED_COLORS = [
  "#FF6B6B", // Rojo coral
  "#4ECDC4", // Turquesa
  "#45B7D1", // Azul cielo
  "#96CEB4", // Verde menta
  "#FFEAA7", // Amarillo crema
  "#DDA0DD", // Lila
  "#98D8C8", // Verde agua
  "#F7DC6F", // Amarillo dorado
  "#BB8FCE", // Violeta
  "#85C1E9", // Azul claro
  "#F8C471", // Naranja claro
  "#82E0AA", // Verde lima
  "#F1948A", // Rosa salmón
  "#85C1E9", // Azul cielo
  "#D7BDE2", // Lila claro
  "#FAD7A0", // Melocotón
  "#A9DFBF", // Verde manzana
  "#F9E79F", // Amarillo limón
  "#D5A6BD", // Rosa pálido
  "#A3E4D7", // Verde azulado
]

export function ColorPicker({ value = "#4ECDC4", onChange, className }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [customColor, setCustomColor] = useState(value)

  const handleColorSelect = (color: string) => {
    onChange(color)
    setCustomColor(color)
    setOpen(false)
  }

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color)
    onChange(color)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`h-10 w-10 ${className}`}
          type="button"
          style={{ backgroundColor: value }}
        >
          <Palette className="h-4 w-4 text-white" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <Label>Seleccionar color</Label>
          
          {/* Colores predefinidos */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Colores predefinidos</Label>
            <div className="grid grid-cols-5 gap-2">
              {PREDEFINED_COLORS.map((color, index) => (
                <button
                  key={`${color}-${index}`}
                  type="button"
                  onClick={() => handleColorSelect(color)}
                  className={`h-8 w-8 rounded-full border-2 transition-all hover:scale-110 ${
                    value === color ? "border-primary ring-2 ring-primary/20" : "border-border"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Color personalizado */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Color personalizado</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={customColor}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                className="h-10 w-20 p-1"
              />
              <Input
                type="text"
                value={customColor}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>

          {/* Vista previa */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Vista previa</Label>
            <div 
              className="h-16 w-full rounded-lg border flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: customColor }}
            >
              {customColor}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
