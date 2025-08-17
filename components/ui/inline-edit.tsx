"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface InlineEditProps {
  value: string
  onSave: (value: string) => Promise<void>
  className?: string
  placeholder?: string
  disabled?: boolean
}

export function InlineEdit({ value, onSave, className, placeholder, disabled = false }: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleStartEdit = () => {
    if (disabled) return
    setIsEditing(true)
    setEditValue(value)
  }

  const handleSave = async () => {
    if (editValue.trim() === value.trim()) {
      setIsEditing(false)
      return
    }

    setIsLoading(true)
    try {
      await onSave(editValue.trim())
      setIsEditing(false)
    } catch (error) {
      console.error("Error saving:", error)
      // Reset to original value on error
      setEditValue(value)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleBlur = () => {
    // Don't auto-save on blur, let user decide with Enter/Escape
    handleSave()
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={cn("flex-1", className)}
          placeholder={placeholder}
          disabled={isLoading}
        />
        {isLoading && <LoadingSpinner size="sm" />}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded transition-colors",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      onClick={handleStartEdit}
      title={disabled ? undefined : "Click para editar"}
    >
      {value || placeholder}
    </div>
  )
}