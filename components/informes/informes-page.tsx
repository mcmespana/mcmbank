"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useDelegationRole } from "@/hooks/use-delegation-role"
import { useIsAdmin } from "@/hooks/use-is-admin"
import { useInformes } from "@/hooks/use-informes"
import { InformeCard } from "./informe-card"
import { SubirInformeSheet } from "./subir-informe-sheet"
import { PdfViewerDialog } from "./pdf-viewer-dialog"
import { GenerarInformeDialog } from "./generar/generar-informe-dialog"
import type { InformeArchivo, InformeConArchivos } from "@/lib/types/database"
import type { InformeEstado } from "@/lib/types/informes"
import { Upload, Sparkles, FileBarChart, AlertCircle, Loader2 } from "lucide-react"

export function InformesPage() {
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const delegacion = getCurrentDelegation()
  const { role } = useDelegationRole(selectedDelegation)
  const isAdmin = useIsAdmin()
  const canWrite = isAdmin || role === "tesorero" || role === "gestor_central"

  const { informes, loading, error, refetch, updateInforme, deleteInforme } =
    useInformes(selectedDelegation)

  const [subirOpen, setSubirOpen] = useState(false)
  const [editing, setEditing] = useState<InformeConArchivos | null>(null)
  const [viewing, setViewing] = useState<InformeArchivo | null>(null)
  const [deleting, setDeleting] = useState<InformeConArchivos | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [generarOpen, setGenerarOpen] = useState(false)
  const [generarDraft, setGenerarDraft] = useState<InformeConArchivos | null>(null)

  const searchParams = useSearchParams()
  useEffect(() => {
    const g = searchParams.get("google")
    if (!g) return
    if (g === "ok") toast.success("Google conectado correctamente")
    else if (g === "state") toast.error("La conexión con Google caducó. Inténtalo de nuevo.")
    else toast.error("No se pudo conectar con Google")
    // limpiar el parámetro de la URL
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/informes")
    }
  }, [searchParams])

  const anuales = useMemo(
    () => informes.filter((i) => i.tipo === "anual"),
    [informes],
  )

  const handleChangeEstado = async (informe: InformeConArchivos, estado: InformeEstado) => {
    try {
      await updateInforme(informe.id, { estado })
      toast.success("Estado actualizado")
    } catch (err) {
      console.error(err)
      toast.error("No se pudo actualizar el estado")
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      await deleteInforme(deleting)
      toast.success("Informe eliminado")
      setDeleting(null)
    } catch (err) {
      console.error(err)
      toast.error("No se pudo eliminar el informe")
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileBarChart className="h-6 w-6 text-primary" />
            Informes
          </h1>
          <p className="text-sm text-muted-foreground">
            {delegacion ? delegacion.nombre : "Selecciona una delegación"} · archivo y memorias económicas
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSubirOpen(true)} disabled={!selectedDelegation}>
              <Upload className="mr-2 h-4 w-4" /> Subir informe
            </Button>
            <Button
              onClick={() => {
                setGenerarDraft(null)
                setGenerarOpen(true)
              }}
              disabled={!selectedDelegation}
            >
              <Sparkles className="mr-2 h-4 w-4" /> Generar informe
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="anuales">
        <TabsList>
          <TabsTrigger value="anuales">Anuales</TabsTrigger>
          <TabsTrigger value="actividad" disabled>
            Por actividad
            <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px]">
              Próximamente
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="anuales" className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="h-28 animate-pulse bg-muted/40" />
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={<AlertCircle className="h-6 w-6 text-destructive" />}
              title="Error al cargar los informes"
              description={error}
            >
              <Button variant="outline" onClick={refetch}>
                Reintentar
              </Button>
            </EmptyState>
          ) : anuales.length === 0 ? (
            <EmptyState
              icon={<FileBarChart className="h-6 w-6" />}
              title="Aún no hay informes"
              description={
                canWrite
                  ? "Sube un informe existente o genera la memoria económica anual."
                  : "Todavía no se ha publicado ningún informe en esta delegación."
              }
            >
              {canWrite && (
                <Button onClick={() => setSubirOpen(true)} disabled={!selectedDelegation}>
                  <Upload className="mr-2 h-4 w-4" /> Subir informe
                </Button>
              )}
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {anuales.map((informe) => (
                <InformeCard
                  key={informe.id}
                  informe={informe}
                  canWrite={canWrite}
                  onView={setViewing}
                  onEdit={(i) => {
                    if (i.origen === "generado" && i.es_borrador) {
                      setGenerarDraft(i)
                      setGenerarOpen(true)
                    } else {
                      setEditing(i)
                      setSubirOpen(true)
                    }
                  }}
                  onDelete={setDeleting}
                  onChangeEstado={handleChangeEstado}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actividad" className="mt-4">
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title="Informes por actividad"
            description="Esta sección estará disponible próximamente."
          />
        </TabsContent>
      </Tabs>

      {/* Subir / Editar */}
      {delegacion && (
        <SubirInformeSheet
          open={subirOpen}
          onOpenChange={(o) => {
            setSubirOpen(o)
            if (!o) setEditing(null)
          }}
          delegacionId={delegacion.id}
          delegacionNombre={delegacion.nombre}
          informe={editing}
          onSaved={refetch}
        />
      )}

      {/* Visor */}
      <PdfViewerDialog archivo={viewing} onClose={() => setViewing(null)} />

      {/* Confirmar borrado */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar informe</DialogTitle>
            <DialogDescription>
              ¿Seguro que quieres eliminar “{deleting?.titulo}”? Se borrarán también sus archivos. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deletingBusy}>
              {deletingBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generar memoria económica */}
      {delegacion && (
        <GenerarInformeDialog
          open={generarOpen}
          onOpenChange={(o) => {
            setGenerarOpen(o)
            if (!o) setGenerarDraft(null)
          }}
          delegacionId={delegacion.id}
          delegacionNombre={delegacion.nombre}
          initialInforme={generarDraft}
          onSaved={refetch}
        />
      )}
    </div>
  )
}
