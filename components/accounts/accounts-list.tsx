"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { AccountCard } from "./account-card"
import { AccountForm } from "./account-form"
import { AccountDeleteModal } from "./account-delete-modal"
import { useCuentas } from "@/hooks/use-cuentas"
import { useDelegationContext } from "@/contexts/delegation-context"
import { Plus, Search } from "lucide-react"
import type { CuentaConDelegacion } from "@/lib/types/database"

export function AccountsList() {
  const { selectedDelegation } = useDelegationContext()
  const { cuentas, loading, error, refetch } = useCuentas(selectedDelegation)
  
  const [searchTerm, setSearchTerm] = useState("")
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<CuentaConDelegacion | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<CuentaConDelegacion | null>(null)

  // Filter accounts based on search term
  const filteredAccounts = cuentas.filter(account =>
    account.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (account.banco_nombre?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (account.iban?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  )

  // Sort accounts: banks first (grouped by bank name), then cash accounts (alphabetically)
  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    // First sort by type: banco first, then caja
    if (a.tipo !== b.tipo) {
      return a.tipo === "banco" ? -1 : 1
    }
    
    // If both are banks, sort by bank name
    if (a.tipo === "banco" && b.tipo === "banco") {
      const bankA = a.banco_nombre || ""
      const bankB = b.banco_nombre || ""
      if (bankA !== bankB) {
        return bankA.localeCompare(bankB)
      }
      // If same bank, sort by account name
      return a.nombre.localeCompare(b.nombre)
    }
    
    // If both are cash accounts, sort by name
    return a.nombre.localeCompare(b.nombre)
  })

  const handleEdit = (account: CuentaConDelegacion) => {
    setEditingAccount(account)
    setEditSheetOpen(true)
  }

  const handleDelete = (account: CuentaConDelegacion) => {
    setAccountToDelete(account)
    setDeleteModalOpen(true)
  }

  const handleCreateSuccess = () => {
    setCreateSheetOpen(false)
    refetch()
  }

  const handleEditSuccess = () => {
    setEditSheetOpen(false)
    setEditingAccount(null)
    refetch()
  }

  const handleDeleteSuccess = () => {
    setDeleteModalOpen(false)
    setAccountToDelete(null)
    refetch()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-8">
        <p>Error al cargar las cuentas: {error}</p>
        <Button onClick={refetch} className="mt-4">
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with search and create button */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar cuentas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Button onClick={() => setCreateSheetOpen(true)} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Crear Cuenta
        </Button>
      </div>

      {/* Account count */}
      <div className="text-sm text-muted-foreground">
        {filteredAccounts.length === cuentas.length ? (
          `${cuentas.length} ${cuentas.length === 1 ? 'cuenta' : 'cuentas'}`
        ) : (
          `${filteredAccounts.length} de ${cuentas.length} cuentas`
        )}
      </div>

      {/* Accounts Grid */}
      {sortedAccounts.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {searchTerm ? "No se encontraron cuentas" : "No hay cuentas registradas"}
          </h3>
          <p className="text-muted-foreground mb-6">
            {searchTerm 
              ? "Intenta con otros términos de búsqueda"
              : "Comienza creando tu primera cuenta bancaria o de caja"
            }
          </p>
          {!searchTerm && (
            <Button onClick={() => setCreateSheetOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Primera Cuenta
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {sortedAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Account Sheet */}
      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Crear Nueva Cuenta</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <AccountForm
              onSuccess={handleCreateSuccess}
              onCancel={() => setCreateSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Account Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar Cuenta</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {editingAccount && (
              <AccountForm
                account={editingAccount}
                onSuccess={handleEditSuccess}
                onCancel={() => setEditSheetOpen(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Account Modal */}
      {accountToDelete && (
        <AccountDeleteModal
          account={accountToDelete}
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  )
}