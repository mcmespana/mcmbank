"use client"

import { useState, useEffect } from "react"
import { Plus, Search, Building2, PiggyBank, Copy, Info, Edit, Trash2, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CuentaEditForm } from "@/components/cuentas/cuenta-edit-form"
import { DeleteAccountDialog } from "@/components/cuentas/delete-account-dialog"
import type { Cuenta } from "@/lib/types/database"

// Mock data para desarrollo
const mockCuentas: Cuenta[] = [
  {
    id: "1",
    delegacion_id: "1",
    nombre: "Cuenta Principal",
    tipo: "banco",
    origen: "manual",
    banco_nombre: "Banco Santander",
    iban: "ES91 2100 0418 4502 0005 1332",
    color: "#4ECDC4",
    personas_autorizadas: "Juan Pérez, María García",
    descripcion: "Cuenta principal para gastos diarios y recibos",
    creado_en: "2025-01-01T00:00:00Z"
  },
  {
    id: "2",
    delegacion_id: "1",
    nombre: "Caja de Ahorro",
    tipo: "caja",
    origen: "manual",
    banco_nombre: null,
    iban: null,
    color: "#FF6B6B",
    personas_autorizadas: "Juan Pérez",
    descripcion: "Ahorros para emergencias",
    creado_en: "2025-01-01T00:00:00Z"
  },
  {
    id: "3",
    delegacion_id: "1",
    nombre: "Cuenta Empresarial",
    tipo: "banco",
    origen: "manual",
    banco_nombre: "BBVA",
    iban: "ES91 2100 0418 4502 0005 1333",
    color: "#45B7D1",
    personas_autorizadas: "Juan Pérez, Ana López",
    descripcion: "Cuenta para gastos empresariales",
    creado_en: "2025-01-01T00:00:00Z"
  }
]

// Mock balances para desarrollo
const mockBalances: Record<string, number> = {
  "1": 1250.75,
  "2": 500.00,
  "3": -250.50
}

export default function CuentasPage() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingCuenta, setEditingCuenta] = useState<Cuenta | null>(null)
  const [deletingCuenta, setDeletingCuenta] = useState<Cuenta | null>(null)

  useEffect(() => {
    // En producción, aquí se cargarían las cuentas desde la API
    setCuentas(mockCuentas)
  }, [])

  const handleCreateCuenta = async (cuentaData: Partial<Cuenta>) => {
    // En producción, aquí se guardaría en la API
    const newCuenta: Cuenta = {
      id: Date.now().toString(),
      delegacion_id: "1",
      nombre: cuentaData.nombre || "",
      tipo: cuentaData.tipo as "banco" | "caja",
      origen: cuentaData.origen as "manual" | "conectada",
      banco_nombre: cuentaData.banco_nombre || null,
      iban: cuentaData.iban || null,
      color: cuentaData.color || "#4ECDC4",
      personas_autorizadas: cuentaData.personas_autorizadas || null,
      descripcion: cuentaData.descripcion || null,
      creado_en: new Date().toISOString()
    }
    
    setCuentas([...cuentas, newCuenta])
    setIsCreateDialogOpen(false)
  }

  const handleUpdateCuenta = async (cuentaData: Partial<Cuenta>) => {
    if (!editingCuenta) return
    
    // En producción, aquí se actualizaría en la API
    const updatedCuentas = cuentas.map(cuenta => 
      cuenta.id === editingCuenta.id 
        ? { ...cuenta, ...cuentaData }
        : cuenta
    )
    
    setCuentas(updatedCuentas)
    setEditingCuenta(null)
  }

  const handleDeleteCuenta = async (cuentaId: string) => {
    // En producción, aquí se eliminaría de la API
    setCuentas(cuentas.filter(cuenta => cuenta.id !== cuentaId))
    setDeletingCuenta(null)
  }

  const getConnectionStatus = (cuenta: Cuenta) => {
    if (cuenta.tipo === "caja") return null
    if (cuenta.origen === "conectada") return "connected"
    return "disconnected"
  }

  const getConnectionBadgeColor = (status: string | null) => {
    if (!status) return "bg-gray-200"
    switch (status) {
      case "connected": return "bg-green-500"
      case "disconnected": return "bg-gray-400"
      default: return "bg-gray-200"
    }
  }

  const getBankIcon = (cuenta: Cuenta) => {
    if (cuenta.tipo === "caja") {
      return <PiggyBank className="h-6 w-6 text-white" />
    }
    return <Building2 className="h-6 w-6 text-white" />
  }

  const getBankColor = (cuenta: Cuenta) => {
    // Usar el color de la base de datos o un color por defecto
    return cuenta.color || "#4ECDC4"
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // Aquí se podría mostrar una notificación de éxito
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  const filteredCuentas = cuentas
    .filter(cuenta => 
      cuenta.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cuenta.banco_nombre?.toLowerCase().includes(searchTerm.toLowerCase())
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cuentas</h1>
          <p className="text-gray-600 mt-2">Gestiona tus cuentas bancarias y cajas de ahorro</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Crear Cuenta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nueva Cuenta</DialogTitle>
              <DialogDescription>
                Completa los datos para crear una nueva cuenta bancaria o caja de ahorro.
              </DialogDescription>
            </DialogHeader>
            <CuentaEditForm
              cuenta={{
                id: "",
                delegacion_id: "1",
                nombre: "",
                tipo: "banco",
                origen: "manual",
                banco_nombre: "",
                iban: "",
                color: "#4ECDC4",
                personas_autorizadas: null,
                descripcion: null,
                creado_en: ""
              }}
              onSave={handleCreateCuenta}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder="Buscar cuentas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4 py-3 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {/* Accounts List */}
      <div className="grid gap-4">
        {filteredCuentas.map((cuenta) => {
          const connectionStatus = getConnectionStatus(cuenta)
          const bankColor = getBankColor(cuenta)
          const balance = mockBalances[cuenta.id] || 0
          
          return (
            <Card key={cuenta.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  {/* Left side - Icon and Info */}
                  <div className="flex items-start space-x-4">
                    {/* Account Icon */}
                    <div className="relative">
                      <div 
                        className="h-16 w-16 rounded-full flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: bankColor }}
                      >
                        {getBankIcon(cuenta)}
                      </div>
                      
                      {/* Connection Status Badge */}
                      {connectionStatus && (
                        <div className={`absolute -top-1 -right-1 h-4 w-4 rounded-full ${getConnectionBadgeColor(connectionStatus)} border-2 border-white`} />
                      )}
                    </div>

                    {/* Account Details */}
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-gray-900">{cuenta.nombre}</h3>
                      <p className="text-gray-600">
                        {cuenta.tipo === "banco" ? cuenta.banco_nombre : "Caja de Ahorro"}
                      </p>
                      
                      {/* IBAN for bank accounts */}
                      {cuenta.tipo === "banco" && cuenta.iban && (
                        <div className="flex items-center space-x-2">
                          <code className="text-sm text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                            {cuenta.iban}
                          </code>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(cuenta.iban!)}
                                  className="h-6 w-6 p-0 hover:bg-gray-200"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Copiar IBAN</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}

                      {/* Description indicator */}
                      {cuenta.descripcion && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center space-x-1 text-gray-500 cursor-help">
                                <Info className="h-3 w-3" />
                                <span className="text-xs">Descripción disponible</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>{cuenta.descripcion}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>

                  {/* Right side - Balance and Actions */}
                  <div className="flex flex-col items-end space-y-4">
                    {/* Balance */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-right">
                            <Badge 
                              variant="secondary" 
                              className={`text-lg px-3 py-2 ${
                                balance >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {balance >= 0 ? '+' : ''}{balance.toFixed(2)} €
                            </Badge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Saldo calculado según las transacciones en la aplicación, puede no coincidir con el banco si se ha desincronizado</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingCuenta(cuenta)}
                        className="h-8 px-3"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingCuenta(cuenta)}
                        className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Edit Dialog */}
      {editingCuenta && (
        <Dialog open={!!editingCuenta} onOpenChange={() => setEditingCuenta(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Cuenta</DialogTitle>
              <DialogDescription>
                Modifica los datos de la cuenta seleccionada.
              </DialogDescription>
            </DialogHeader>
            <CuentaEditForm
              cuenta={editingCuenta}
              onSave={handleUpdateCuenta}
              onCancel={() => setEditingCuenta(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingCuenta && (
        <DeleteAccountDialog
          cuenta={deletingCuenta}
          onConfirm={() => handleDeleteCuenta(deletingCuenta.id)}
          onCancel={() => setDeletingCuenta(null)}
        />
      )}
    </div>
  )
}