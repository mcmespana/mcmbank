"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { FileText } from "lucide-react"

export default function FacturasPage() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Facturas</h1>
            <p className="text-muted-foreground">
              Gestiona tus facturas de ingresos y gastos.
            </p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Listado de Facturas</CardTitle>
            <CardDescription>
              Aquí aparecerán tus facturas una vez las hayas añadido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No hay facturas"
              description="La función de facturas está en construcción. ¡Vuelve pronto!"
              icon={<FileText className="h-8 w-8 text-muted-foreground" />}
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
