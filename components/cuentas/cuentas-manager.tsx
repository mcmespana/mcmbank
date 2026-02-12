"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Plus, Search, Building2, PiggyBank, Copy, Info, Edit, Trash2, Check, User } from "lucide-react"
import { BankAvatar } from "@/components/bank-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CuentaEditForm } from "./cuenta-edit-form"
import { DeleteAccountDialog } from "./delete-account-dialog"
import { RelatedMovementsSheet } from "@/components/transactions/related-movements-sheet"
import type { Cuenta } from "@/lib/types/database"
import { useCuentas } from "@/hooks/use-cuentas"
import { useDelegationContext } from "@/contexts/delegation-context"
import { supabase } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils/format"

export function CuentasManager() {
  const { selectedDelegation } = useDelegationContext()
  console.log("CuentasManager: selectedDelegation", selectedDelegation)
  const {
    cuentas: cuentasWithDelegacion,
    loading,
    error,
    forceRefresh,
    addCuenta,
    updateCuenta,
    removeCuenta,
  } = useCuentas(selectedDelegation)
  console.log("CuentasManager: cuentas after useCuentas", cuentasWithDelegacion)
  const cuentas = useMemo(
    () => cuentasWithDelegacion.map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { delegacion, ...cuenta } = item
      return cuenta
    }),
    [cuentasWithDelegacion],
  )
  const [searchTerm, setSearchTerm] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)
  const [editingCuenta, setEditingCuenta] = useState<Cuenta | null>(null)
  const [deletingCuenta, setDeletingCuenta] = useState<Cuenta | null>(null)
  const [copiedIban, setCopiedIban] = useState<string | null>(null)
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [operationStates, setOperationStates] = useState<Record<string, 'creating' | 'updating' | 'deleting'>>({})
  const [viewingAccount, setViewingAccount] = useState<Cuenta | null>(null)

  // Función para actualizar el estado de una operación
  const setOperationState = useCallback((cuentaId: string, state: 'creating' | 'updating' | 'deleting' | null) => {
    console.log(`🔄 setOperationState: ${cuentaId} -> ${state}`)
    setOperationStates(prev => {
      if (state === null) {
        const newStates = { ...prev }
        delete newStates[cuentaId]
        console.log(`🧹 Limpiando estado para cuenta ${cuentaId}`)
        return newStates
      }
      console.log(`✅ Estableciendo estado ${state} para cuenta ${cuentaId}`)
      return { ...prev, [cuentaId]: state }
    })
  }, [])

  // Función para limpiar automáticamente el estado de una operación
  const clearOperationStateAfterDelay = useCallback((cuentaId: string, delay: number = 1500) => {
    console.log(`⏰ Programando limpieza automática para cuenta ${cuentaId} en ${delay}ms`)
    setTimeout(() => {
      console.log(`⏰ Ejecutando limpieza automática para cuenta ${cuentaId}`)
      setOperationState(cuentaId, null)
    }, delay)
  }, [setOperationState])

  useEffect(() => {
    console.log("CuentasManager: cuentas state updated", cuentas)
    async function fetchBalances() {
      const entries = await Promise.all(
        cuentas.map(async (c) => {
          const { data, error } = await (supabase as any)
            .from("movimiento")
            .select("importe")
            .eq("cuenta_id", c.id)

          if (error) {
            console.error("Error fetching balance:", error)
            return [c.id, 0]
          }

          const balance = (data || []).reduce((sum: number, m: any) => sum + m.importe, 0)
          return [c.id, balance]
        }),
      )

      setBalances(Object.fromEntries(entries))
    }

    if (cuentas.length) {
      fetchBalances()
    } else {
      setBalances({})
    }
  }, [cuentas])

  // Limpiar estados de operación cuando cambie la delegación
  useEffect(() => {
    console.log("🧹 Limpiando estados de operación por cambio de delegación")
    setOperationStates({})
  }, [selectedDelegation])

  // Limpiar estados de operación al desmontar el componente
  useEffect(() => {
    return () => {
      console.log("🧹 Limpiando estados de operación al desmontar componente")
      setOperationStates({})
    }
  }, [])

  const handleCreateCuenta = async (cuentaData: Partial<Cuenta>) => {
    if (!selectedDelegation) return

    console.log("handleCreateCuenta: Attempting to create account", cuentaData)

    try {
      const { data, error } = await (supabase as any).from("cuenta").insert({
        delegacion_id: selectedDelegation,
        nombre: cuentaData.nombre || "",
        tipo: cuentaData.tipo,
        origen: cuentaData.origen,
        banco_nombre: cuentaData.banco_nombre || null,
        iban: cuentaData.iban || null,
        color: cuentaData.color || "#4ECDC4",
        personas_autorizadas: cuentaData.personas_autorizadas || null,
        descripcion: cuentaData.descripcion || null,
      }).select()

      if (error) {
        console.error("handleCreateCuenta: Error creating account", error)
        throw error
      }

      // Aplicar actualización optimista inmediatamente
      if (data && data[0]) {
        const newCuenta = {
          ...data[0],
          delegacion: {
            id: selectedDelegation,
            organizacion_id: "", // Se llenará con el refresh
            codigo: null,
            nombre: "", // Se llenará con el refresh
            creado_en: new Date().toISOString()
          }
        }
        addCuenta(newCuenta)

        // Marcar como en proceso de creación
        setOperationState(newCuenta.id, 'creating')

        // Limpiar el estado después de 1.5 segundos
        clearOperationStateAfterDelay(newCuenta.id, 1500)
      }

      console.log("handleCreateCuenta: Account created successfully")
      setIsCreateSheetOpen(false)
    } catch (error) {
      console.error("handleCreateCuenta: Error in try-catch", error)
      throw error
    }
  }

  const handleUpdateCuenta = async (cuentaData: Partial<Cuenta>) => {
    if (!editingCuenta) return

    console.log("handleUpdateCuenta: Attempting to update account", cuentaData)

    // Marcar como en proceso de actualización
    setOperationState(editingCuenta.id, 'updating')

    // Aplicar actualización optimista inmediatamente
    updateCuenta(editingCuenta.id, cuentaData)

    try {
      const { error } = await (supabase as any)
        .from("cuenta")
        .update(cuentaData)
        .eq("id", editingCuenta.id)

      if (error) {
        console.error("handleUpdateCuenta: Error updating account", error)
        // Revertir actualización optimista en caso de error
        await forceRefresh()
        throw error
      }

      console.log("handleUpdateCuenta: Account updated successfully")
      // Limpiar estado inmediatamente después de éxito
      setOperationState(editingCuenta.id, null)
      setEditingCuenta(null)
    } catch (error) {
      console.error("handleUpdateCuenta: Error in try-catch", error)
      // Limpiar estado en caso de error
      setOperationState(editingCuenta.id, null)
      throw error
    }
  }

  const handleDeleteCuenta = async (cuentaId: string) => {
    console.log("handleDeleteCuenta: Attempting to delete account", cuentaId)

    // Marcar como en proceso de eliminación
    setOperationState(cuentaId, 'deleting')

    // Aplicar eliminación optimista inmediatamente
    removeCuenta(cuentaId)

    try {
      const { error } = await (supabase as any).from("cuenta").delete().eq("id", cuentaId)
      if (error) {
        console.error("handleDeleteCuenta: Error deleting account", error)
        // Revertir eliminación optimista en caso de error
        await forceRefresh()
        throw error
      }
      console.log("handleDeleteCuenta: Account deleted successfully")
      // No necesitamos limpiar el estado aquí porque la cuenta ya no existe
      setDeletingCuenta(null)
    } catch (error) {
      console.error("handleDeleteCuenta: Error in try-catch", error)
      // Limpiar estado en caso de error
      setOperationState(cuentaId, null)
      throw error
    }
  }

  const getConnectionStatus = (cuenta: Cuenta) => {
    if (cuenta.tipo === "caja") return null
    if (cuenta.origen === "conectada") return "connected"
    return "disconnected"
  }

  const getConnectionBadgeColor = (status: string | null) => {
    if (!status) return "bg-gray-200"
    switch (status) {
      case "connected":
        return "bg-green-500"
      case "disconnected":
        return "bg-gray-400"
      default:
        return "bg-gray-200"
    }
  }

  const getBankColor = (cuenta: Cuenta) => {
    // Usar el color de la base de datos o un color por defecto
    return cuenta.color || "#4ECDC4"
  }

  const copyToClipboard = async (text: string) => {
    try {
      // Verificar si navigator.clipboard está disponible
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback para navegadores que no soportan la API moderna
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }

      setCopiedIban(text)
      setTimeout(() => setCopiedIban(null), 2000)
    } catch (err) {
      console.error("Error copying to clipboard:", err)
      // Mostrar un mensaje al usuario o usar un fallback
      alert("No se pudo copiar al portapapeles. Por favor, selecciona y copia el texto manualmente.")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Cargando cuentas...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">Error: {error}</p>
      </div>
    )
  }

  const filteredCuentas = cuentas
    .filter(
      (cuenta) =>
        cuenta.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cuenta.banco_nombre?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      // Primero bancos, luego cajas
      if (a.tipo !== b.tipo) {
        return a.tipo === "banco" ? -1 : 1
      }
      // Luego por nombre de banco
      if (a.banco_nombre && b.banco_nombre) {
        return a.banco_nombre.localeCompare(b.banco_nombre)
      }
      // Finalmente por nombre de cuenta
      return a.nombre.localeCompare(b.nombre)
    })

  const bancosCount = cuentas.filter((c) => c.tipo === "banco").length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:gap-6">
        {searchOpen ? (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Buscar cuentas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10"
                autoFocus
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSearchOpen(false)
                setSearchTerm("")
              }}
              className="h-10"
            >
              Cerrar
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setSearchOpen(true)}
              className="h-10"
            >
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button
              onClick={() => setIsCreateSheetOpen(true)}
              className="h-10"
              size="default"
              disabled={Object.values(operationStates).some(state => state === 'creating')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Cuenta
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Total Cuentas</div>
                <div className="text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-100">{cuentas.length}</div>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-xl border border-green-200 dark:border-green-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Saldo Total</div>
                <div className="text-2xl sm:text-3xl font-bold text-green-900 dark:text-green-100">
                  {formatCurrency(Object.values(balances).reduce((sum, balance) => sum + balance, 0))}
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <PiggyBank className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Bancos</div>
                <div className="text-2xl sm:text-3xl font-bold text-purple-900 dark:text-purple-100">
                  {bancosCount}
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredCuentas.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-4">
              <Building2 className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No hay cuentas</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "No se encontraron cuentas con ese criterio" : "Comienza creando tu primera cuenta"}
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsCreateSheetOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Cuenta
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredCuentas.map((cuenta) => {
              const connectionStatus = getConnectionStatus(cuenta)
              const bankColor = getBankColor(cuenta)
              const balance = balances[cuenta.id] || 0
              const isCreating = operationStates[cuenta.id] === 'creating'
              const isUpdating = operationStates[cuenta.id] === 'updating'
              const isDeleting = operationStates[cuenta.id] === 'deleting'

              return (
                <Card
                  key={cuenta.id}
                  className={`group hover:shadow-lg transition-all duration-200 border-border bg-card ${isCreating ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20' :
                    isUpdating ? 'ring-2 ring-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' :
                      isDeleting ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-950/20' : ''
                    }`}
                >
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col gap-4">
                      {/* Primera fila: Icono + Info básica + Saldo */}
                      <div className="flex items-center gap-4">
                        {/* Account Icon */}
                        <div className="relative flex-shrink-0">
                          <div
                            className={`h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white dark:ring-gray-800 transition-transform group-hover:scale-105 overflow-hidden ${isCreating ? 'animate-pulse' :
                              isUpdating ? 'animate-pulse' :
                                isDeleting ? 'animate-pulse' : ''
                              }`}
                            style={{ backgroundColor: bankColor }}
                          >
                            <BankAvatar
                              account={cuenta}
                              size="lg"
                              accountColor={bankColor}
                            />
                          </div>

                          {/* Connection Status Badge */}
                          {connectionStatus && (
                            <div
                              className={`absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full ${getConnectionBadgeColor(connectionStatus)} border-2 sm:border-3 border-white dark:border-gray-800 shadow-sm`}
                            >
                              <div className="h-full w-full rounded-full bg-current opacity-80" />
                            </div>
                          )}

                          {/* Operation Status Badge */}
                          {isCreating && (
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-blue-500 border-2 border-white dark:border-gray-800 shadow-sm flex items-center justify-center">
                              <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-white animate-pulse" />
                            </div>
                          )}
                          {isUpdating && (
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-yellow-500 border-2 border-white dark:border-gray-800 shadow-sm flex items-center justify-center">
                              <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-white animate-pulse" />
                            </div>
                          )}
                          {isDeleting && (
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-red-500 border-2 border-white dark:border-gray-800 shadow-sm flex items-center justify-center">
                              <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-white animate-pulse" />
                            </div>
                          )}
                        </div>

                        {/* Account Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg sm:text-xl font-semibold text-foreground truncate leading-tight">
                                  {cuenta.nombre}
                                  {isCreating && (
                                    <span className="ml-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-normal">
                                      (Creando...)
                                    </span>
                                  )}
                                  {isUpdating && (
                                    <span className="ml-2 text-xs sm:text-sm text-yellow-600 dark:text-yellow-400 font-normal">
                                      (Actualizando...)
                                    </span>
                                  )}
                                  {isDeleting && (
                                    <span className="ml-2 text-xs sm:text-sm text-red-600 dark:text-red-400 font-normal">
                                      (Eliminando...)
                                    </span>
                                  )}
                                </h3>
                                {cuenta.descripcion && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-muted-foreground hover:text-foreground flex-shrink-0"
                                      >
                                        <Info className="h-3 w-3 sm:h-4 sm:w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-3">
                                      <div className="space-y-2">
                                        <h4 className="font-medium text-sm">Descripción</h4>
                                        <p className="text-sm text-muted-foreground">{cuenta.descripcion}</p>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                              <p className="text-sm sm:text-base text-muted-foreground font-medium">
                                {cuenta.tipo === "banco" ? cuenta.banco_nombre : "Caja - Efectivo"}
                              </p>
                            </div>

                            {/* Balance - Always visible on the right */}
                            <div className="flex-shrink-0">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                                    <Badge
                                      variant="secondary"
                                      className={`text-sm sm:text-lg font-semibold px-2 sm:px-4 py-1 sm:py-2 cursor-pointer hover:opacity-80 transition-opacity ${balance >= 0
                                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                                        }`}
                                    >
                                      {balance >= 0 ? "+" : ""}
                                      {formatCurrency(balance).replace("€", "").trim()}
                                    </Badge>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-3">
                                  <div className="space-y-2">
                                    <h4 className="font-medium text-sm">Información del Saldo</h4>
                                    <p className="text-sm text-muted-foreground">
                                      Saldo calculado según las transacciones registradas, no tiene porque coincidir con el
                                      del banco si no lo tienes bien sincronizado
                                    </p>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Segunda fila: IBAN y personas autorizadas */}
                      <div className="space-y-3">
                        {/* IBAN */}
                        {cuenta.tipo === "banco" && cuenta.iban && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs sm:text-sm text-muted-foreground font-mono bg-muted px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border break-all inline-block">
                              {cuenta.iban}
                            </code>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(cuenta.iban!)}
                                  className={`h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-muted flex-shrink-0 transition-all duration-200 ${copiedIban === cuenta.iban
                                    ? "bg-green-100 hover:bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                                    : "hover:bg-muted"
                                    }`}
                                >
                                  {copiedIban === cuenta.iban ? (
                                    <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  ) : (
                                    <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-2">
                                <p className="text-sm">{copiedIban === cuenta.iban ? "¡Copiado!" : "Copiar IBAN"}</p>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}

                        {/* Personas autorizadas y botones de acción */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            {cuenta.personas_autorizadas && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                                    <div className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                                      <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                                        <span className="text-xs font-medium">
                                          {cuenta.personas_autorizadas.split(",").length}
                                        </span>
                                      </div>
                                      <span className="text-sm">
                                        {cuenta.personas_autorizadas.split(",").length === 1
                                          ? " persona autorizada"
                                          : ` personas autorizadas`}
                                      </span>
                                    </div>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-3">
                                  <div className="space-y-2">
                                    <h4 className="font-medium text-sm">Personas Autorizadas</h4>
                                    <div className="space-y-1">
                                      {cuenta.personas_autorizadas.split(",").map((persona, index) => (
                                        <div
                                          key={index}
                                          className="text-sm text-muted-foreground flex items-center gap-2"
                                        >
                                          <User className="h-3 w-3 text-green-500" />
                                          {persona.trim()}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewingAccount(cuenta)}
                              disabled={isCreating || isUpdating || isDeleting}
                              className="h-8 w-8 sm:h-9 sm:w-9 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-950 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Ver movimientos"
                            >
                              <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingCuenta(cuenta)}
                              disabled={isCreating || isUpdating || isDeleting}
                              className="h-8 w-8 sm:h-9 sm:w-9 p-0 hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-950 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Editar cuenta"
                            >
                              <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingCuenta(cuenta)}
                              disabled={isCreating || isUpdating || isDeleting}
                              className="h-8 w-8 sm:h-9 sm:w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Eliminar cuenta"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Sheet - Right Side */}
      <Sheet
        open={isCreateSheetOpen || !!editingCuenta}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateSheetOpen(false)
            setEditingCuenta(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingCuenta ? "Editar Cuenta" : "Crear Nueva Cuenta"}</SheetTitle>
          </SheetHeader>
          <div className="py-6">
            <CuentaEditForm
              cuenta={
                editingCuenta || {
                  id: "",
                  delegacion_id: selectedDelegation || "",
                  nombre: "",
                  tipo: "banco",
                  origen: "manual",
                  banco_nombre: "",
                  iban: "",
                  color: "#4ECDC4",
                  personas_autorizadas: null,
                  descripcion: null,
                  creado_en: "",
                }
              }
              onSave={editingCuenta ? handleUpdateCuenta : handleCreateCuenta}
              onCancel={() => {
                setIsCreateSheetOpen(false)
                setEditingCuenta(null)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      {deletingCuenta && (
        <DeleteAccountDialog
          cuenta={deletingCuenta}
          onConfirm={() => handleDeleteCuenta(deletingCuenta.id)}
          onCancel={() => setDeletingCuenta(null)}
        />
      )}

      <RelatedMovementsSheet
        account={viewingAccount}
        open={!!viewingAccount}
        onOpenChange={(open) => {
          if (!open) setViewingAccount(null)
        }}
      />
    </div>
  )
}
