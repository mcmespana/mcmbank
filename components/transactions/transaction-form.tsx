"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { describirError } from "@/lib/utils/describir-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Building2 } from "lucide-react"
import { format } from "date-fns"
import { DateField } from "@/components/ui/date-field"
import { parseEuropeanNumber } from "@/lib/utils/number"
import type { MovimientoConRelaciones, Categoria, Cuenta } from "@/lib/types/database"

interface TransactionFormProps {
  movement?: MovimientoConRelaciones | null
  accounts: Cuenta[]
  categories: Categoria[]
  onSave: (data: Partial<MovimientoConRelaciones>) => Promise<void>
  onCancel: () => void
  mode: "create" | "edit"
}

function getDefaultAccountId(accounts: Cuenta[]): string {
  if (accounts.length === 1) {
    return accounts[0].id
  }

  const oldestBankAccount = accounts
    .filter((account) => account.tipo === "banco")
    .sort((a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime())[0]

  return oldestBankAccount?.id || ""
}

export function TransactionForm({ movement, accounts, categories, onSave, onCancel, mode }: TransactionFormProps) {
  const defaultAccountId = movement?.cuenta_id || getDefaultAccountId(accounts)
  const [formData, setFormData] = useState({
    concepto: movement?.concepto || "",
    // Importe como texto para permitir la coma decimal española (270,41).
    importe: movement?.importe != null ? String(movement.importe) : "",
    fecha: movement?.fecha ? new Date(movement.fecha) : new Date(),
    categoria_id: movement?.categoria_id || "",
    cuenta_id: defaultAccountId,
    notas: movement?.notas || "",
    tipo: (movement && "tipo" in movement ? (movement as any).tipo : undefined) || "gasto",
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mode !== "create" || movement || formData.cuenta_id) {
      return
    }

    const nextDefaultAccountId = getDefaultAccountId(accounts)
    if (!nextDefaultAccountId) {
      return
    }

    setFormData((prev) => ({ ...prev, cuenta_id: nextDefaultAccountId }))
  }, [accounts, formData.cuenta_id, mode, movement])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.concepto.trim() || !formData.cuenta_id || !formData.categoria_id) {
      toast.error("Faltan campos obligatorios: concepto, cuenta y categoría")
      return
    }

    const importe = parseEuropeanNumber(formData.importe)

    if (!Number.isFinite(importe)) {
      toast.error("Introduce un importe válido")
      return
    }

    if (importe === 0) {
      toast.error("El importe no puede ser 0")
      return
    }

    setLoading(true)

    try {
      await onSave({
        concepto: formData.concepto.trim(),
        importe,
        fecha: format(formData.fecha, "yyyy-MM-dd"),
        categoria_id: formData.categoria_id,
        cuenta_id: formData.cuenta_id,
        notas: formData.notas.trim(),
      })
    } catch (error) {
      console.error("Error saving transaction:", error)
      toast.error(describirError(error, "No se ha podido guardar la transacción"))
    } finally {
      setLoading(false)
    }
  }

  const availableCategories = categories
    .filter((cat) => cat.esta_activa !== false)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {mode === "create" ? "Nueva Transacción" : "Editar Transacción"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label>Tipo de transacción *</Label>
            <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ingreso">Ingreso</SelectItem>
                <SelectItem value="gasto">Gasto</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Concept and Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="concepto">Concepto *</Label>
              <Input
                id="concepto"
                value={formData.concepto}
                onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                placeholder="Descripción de la transacción"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="importe">Importe *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="importe"
                  type="text"
                  inputMode="decimal"
                  value={formData.importe}
                  onChange={(e) => setFormData({ ...formData, importe: e.target.value })}
                  placeholder="0,00"
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          {/* Date and Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <DateField
                value={formData.fecha ? format(formData.fecha, "yyyy-MM-dd") : null}
                onChange={(iso) => setFormData({ ...formData, fecha: new Date(`${iso}T00:00:00`) })}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select value={formData.categoria_id} onValueChange={(value) => setFormData({ ...formData, categoria_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{categoria.emoji || "📁"}</span>
                        <span>{categoria.nombre}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Account */}
          <div className="space-y-2">
            <Label>Cuenta *</Label>
            <Select value={formData.cuenta_id} onValueChange={(value) => setFormData({ ...formData, cuenta_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((cuenta) => (
                  <SelectItem key={cuenta.id} value={cuenta.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>{cuenta.nombre}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              placeholder="Notas adicionales (opcional)"
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} aria-busy={loading} className="flex-1">
              {loading ? "Guardando..." : mode === "create" ? "Crear" : "Actualizar"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
