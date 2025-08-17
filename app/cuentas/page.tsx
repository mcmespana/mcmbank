import { AccountsList } from "@/components/accounts/accounts-list"

export default function CuentasPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Cuentas</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona las cuentas bancarias y de caja de tu organización
        </p>
      </div>
      
      <AccountsList />
    </div>
  )
}