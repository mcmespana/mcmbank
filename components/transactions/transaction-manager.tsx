"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { TransactionFiltersComponent } from "./transaction-filters"
import { TransactionList } from "./transaction-list"
import { TransactionDetail } from "./transaction-detail"
import { TransactionCreatePanel } from "./transaction-create-panel"
import { DateRangeFilter } from "./date-range-filter"
import { CategoryMegaSelector } from "./category-mega-selector"
import { CategoryQuickCreateSheet } from "./category-quick-create-sheet"
import { SelectionSummary } from "./selection-summary"
import { supabase } from "@/lib/supabase/client"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { useMovimientos, applyAbsoluteAmountFilter } from "@/hooks/use-movimientos"
import { useCategorias } from "@/hooks/use-categorias"
import { useCuentas } from "@/hooks/use-cuentas"
import { useContactos } from "@/hooks/use-contactos"
import useIsAdminHook from "@/hooks/use-is-admin"
import { useAuth as useCurrentUser } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Download,
  Upload,
  Filter,
  ChevronUp,
  Check,
  Tag,
  Trash2,
  Type,
  FilePlus,
  AlertTriangle,
  X,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { exportMovementsToExcel } from "@/lib/utils/export-to-excel"
import { describirError } from "@/lib/utils/describir-error"
import type { MovimientoConRelaciones, Categoria, Cuenta } from "@/lib/types/database"
import dynamic from "next/dynamic"

// Carga diferida: este panel importa xlsx (parser de Excel, pesado) de forma
// estática; que quede en un chunk aparte en vez del bundle inicial de
// /transacciones. Solo se muestra cuando `open` es true (Sheet controlado),
// así que no hace falta loading fallback (nada debería verse mientras tanto).
const TransactionImportPanel = dynamic(
  () => import("./transaction-import-panel").then((m) => m.TransactionImportPanel),
  { ssr: false },
)
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export interface TransactionFilters {
  dateFrom?: string
  dateTo?: string
  categoryIds?: string[]
  accountId?: string
  contactoIds?: string[]
  contactoTipos?: ("proveedor" | "persona_mcm" | "destinatario_mcm")[]
  search?: string
  amountFrom?: number
  amountTo?: number
  uncategorized?: boolean
  facturaPendiente?: boolean
}

export function TransactionManager() {
  const {
    selectedDelegation,
    delegations,
    loading: delegationsLoading,
    getCurrentDelegation,
  } = useDelegationContext()

  const [filters, setFilters] = useState<TransactionFilters>({})
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null)
  const [selectedMovementSnapshot, setSelectedMovementSnapshot] =
    useState<MovimientoConRelaciones | null>(null)
  const [detailInitialTab, setDetailInitialTab] = useState<"datos" | "archivos">("datos")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // Monta el panel de filtros una sola vez según el viewport (lg = 1024px),
  // evitando tener la versión escritorio y la móvil en el DOM a la vez.
  const isMobile = useIsMobile(1024)


  const [createFormOpen, setCreateFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [downloadState, setDownloadState] = useState<"idle" | "downloading" | "success">("idle")
  const [selectedMovementIds, setSelectedMovementIds] = useState<string[]>([])
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null)
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkConceptOpen, setBulkConceptOpen] = useState(false)
  const [bulkDescriptionOpen, setBulkDescriptionOpen] = useState(false)
  const [bulkConceptValue, setBulkConceptValue] = useState("")
  const [bulkDescriptionValue, setBulkDescriptionValue] = useState("")
  const [bulkCategoryLoading, setBulkCategoryLoading] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkConceptLoading, setBulkConceptLoading] = useState(false)
  const [bulkDescriptionLoading, setBulkDescriptionLoading] = useState(false)
  const [bulkFacturaLoading, setBulkFacturaLoading] = useState(false)
  // Progreso de la acción en lote en curso. Con 200 movimientos seleccionados
  // la barra de acciones se quedaba muda varios segundos y no había forma de
  // saber si iba, ni por dónde.
  const [bulkProgress, setBulkProgress] = useState<{ hechos: number; total: number; etiqueta: string } | null>(null)
  const searchParams = useSearchParams()

  const {
    movimientos: movements,
    loading,
    error,
    updateCategoria,
    updateMovimiento,
    createMovimiento,
    deleteMovimientos,
    restoreMovimientos,
    refetch,
    loadMore,
    hasMore,
    total: totalMovimientos,
  } = useMovimientos(selectedDelegation, {
    fechaDesde: filters.dateFrom,
    fechaHasta: filters.dateTo,
    categoriaIds: filters.categoryIds,
    cuentaId: filters.accountId,
    contactoIds: filters.contactoIds,
    contactoTipos: filters.contactoTipos,
    busqueda: filters.search,
    amountFrom: filters.amountFrom,
    amountTo: filters.amountTo,
    uncategorized: filters.uncategorized,
    facturaPendiente: filters.facturaPendiente,
  })

  // Notify on fetch error
  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  const { categorias: categories, fetchCategorias } = useCategorias(selectedDelegation)
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false)
  const pendingCategoryAssignRef = useRef<((categoryId: string) => void | Promise<void>) | null>(null)
  const { cuentas: accounts } = useCuentas(selectedDelegation)
  // Con catálogo: asignar un proveedor a un movimiento es el momento en el que
  // se crean los duplicados, así que aquí es donde más falta hace que el
  // selector ofrezca el "Mercadona" que ya existe en MCM.
  const { contactos, createContacto: createContactoFn } = useContactos(selectedDelegation, {
    incluirCatalogo: true,
  })
  const isAdmin = useIsAdminHook()
  const { user: currentUser } = useCurrentUser()

  // Al cambiar de filtro (o de delegación) la selección deja de tener sentido:
  // se hizo sobre otra lista. Antes solo se podaba contra los movimientos ya
  // cargados, y con paginación eso descartaba en silencio lo seleccionado en
  // páginas que aún no habían llegado — se pulsaba "Eliminar 40" y se borraban
  // los 12 que quedaban visibles. Ahora se vacía de golpe, y se dice.
  const filtrosFirma = JSON.stringify([selectedDelegation, filters])
  const filtrosFirmaRef = useRef(filtrosFirma)
  const seleccionRef = useRef(selectedMovementIds)
  seleccionRef.current = selectedMovementIds
  useEffect(() => {
    if (filtrosFirmaRef.current === filtrosFirma) return
    filtrosFirmaRef.current = filtrosFirma
    const anteriores = seleccionRef.current.length
    if (anteriores === 0) return
    setSelectedMovementIds([])
    setSelectionAnchorId(null)
    toast.info(
      anteriores === 1
        ? "Se ha quitado la selección al cambiar los filtros"
        : `Se han quitado los ${anteriores} movimientos seleccionados al cambiar los filtros`,
    )
  }, [filtrosFirma])

  useEffect(() => {
    if (movements.length === 0) {
      setSelectedMovementIds((prev) => (prev.length === 0 ? prev : []))
      setSelectionAnchorId(null)
      return
    }

    const availableIds = new Set(movements.map((movement) => movement.id))
    setSelectedMovementIds((prev) => {
      const filtered = prev.filter((id) => availableIds.has(id))
      return filtered.length === prev.length ? prev : filtered
    })
    setSelectionAnchorId((prev) => (prev && availableIds.has(prev) ? prev : null))
  }, [movements])

  const selectedMovements = useMemo(
    () => movements.filter((movement) => selectedMovementIds.includes(movement.id)),
    [movements, selectedMovementIds],
  )

  const allVisibleMovementIds = useMemo(
    () => movements.map((movement) => movement.id),
    [movements],
  )

  const selectionCount = selectedMovementIds.length
  const allVisibleSelected =
    selectionCount > 0 && selectionCount === allVisibleMovementIds.length && allVisibleMovementIds.length > 0

  const masterSelectionState: boolean | "indeterminate" = selectionCount
    ? allVisibleSelected
      ? true
      : "indeterminate"
    : false

  const selectionActive = selectionCount > 0

  // Si todo lo seleccionado ya está marcado, el botón de la barra se invierte y
  // sirve para quitar la marca; así una sola acción cubre los dos sentidos.
  const todoMarcadoFaltaFactura =
    selectedMovements.length > 0 && selectedMovements.every((movement) => movement.factura_pendiente)

  const clearSelection = () => {
    setSelectedMovementIds([])
    setSelectionAnchorId(null)
  }

  const handleMovementSelectionChange = (
    movementId: string,
    selected: boolean,
    rangeFromAnchor: boolean = false,
  ) => {
    if (
      rangeFromAnchor &&
      selectionAnchorId &&
      selectionAnchorId !== movementId &&
      movements.length > 0
    ) {
      const anchorIndex = movements.findIndex((m) => m.id === selectionAnchorId)
      const currentIndex = movements.findIndex((m) => m.id === movementId)
      if (anchorIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(anchorIndex, currentIndex)
        const end = Math.max(anchorIndex, currentIndex)
        const rangeIds = movements.slice(start, end + 1).map((m) => m.id)
        setSelectedMovementIds((prev) => {
          const merged = new Set(prev)
          rangeIds.forEach((id) => merged.add(id))
          return Array.from(merged)
        })
        toast.success(`Has seleccionado ${rangeIds.length} transacciones del rango.`)
        return
      }
    }

    setSelectedMovementIds((prev) => {
      if (selected) {
        if (prev.includes(movementId)) {
          return prev
        }
        return [...prev, movementId]
      }
      return prev.filter((id) => id !== movementId)
    })
    if (selected) {
      setSelectionAnchorId(movementId)
    } else if (selectionAnchorId === movementId) {
      setSelectionAnchorId(null)
    }
  }

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      clearSelection()
    } else {
      setSelectedMovementIds(allVisibleMovementIds)
      setSelectionAnchorId(allVisibleMovementIds[0] ?? null)
    }
  }

  const handleDownload = async () => {
    setDownloadState("downloading")

    // Un solo toast que pasa de "generando" a "listo" o a error. Antes se
    // cantaba "Descarga iniciada" como éxito **antes** de generar nada, así que
    // cuando fallaba salían dos toasts seguidos diciendo lo contrario.
    const promesa = exportMovementsToExcel(
      movements as unknown as MovimientoConRelaciones[],
      accounts as unknown as Cuenta[],
      categories as unknown as Categoria[],
    )

    toast.promise(promesa, {
      loading: `Generando el Excel de ${movements.length} ${movements.length === 1 ? "movimiento" : "movimientos"}…`,
      success: "Excel descargado",
      error: (err) => describirError(err, "No se ha podido generar el archivo"),
    })

    try {
      await promesa
      setDownloadState("success")
      setTimeout(() => setDownloadState("idle"), 2000)
    } catch {
      setDownloadState("idle")
    }
  }

  const handleMovementClick = (movement: MovimientoConRelaciones) => {
    setSelectedMovementId(movement.id)
    setSelectedMovementSnapshot(movement)
    setDetailInitialTab("datos")
  }

  /**
   * Ejecuta una acción sobre cada movimiento seleccionado informando del avance.
   *
   * Va de diez en diez en vez de soltar los N `UPDATE` a la vez: así el
   * contador se mueve de verdad (con `Promise.all` de golpe no hay nada
   * intermedio que contar) y no se abre una petición por movimiento contra
   * PostgREST cuando hay doscientos seleccionados.
   */
  const ejecutarEnLote = useCallback(
    async <T,>(items: T[], etiqueta: string, accion: (item: T) => Promise<unknown>) => {
      const TANDA = 10
      setBulkProgress({ hechos: 0, total: items.length, etiqueta })
      try {
        for (let i = 0; i < items.length; i += TANDA) {
          await Promise.all(items.slice(i, i + TANDA).map(accion))
          const hechos = Math.min(i + TANDA, items.length)
          setBulkProgress({ hechos, total: items.length, etiqueta })
        }
      } finally {
        setBulkProgress(null)
      }
    },
    [],
  )

  const handleBulkCategorySelect = async (categoryId: string) => {
    if (!selectionCount) {
      return
    }

    setBulkCategoryLoading(true)
    try {
      await ejecutarEnLote(selectedMovementIds, "Asignando categoría", (movementId) =>
        handleMovementUpdate(movementId, { categoria_id: categoryId } as Partial<MovimientoConRelaciones>),
      )
      toast.success(`Categoría actualizada en ${selectionCount} transacciones. Selección mantenida para más acciones.`)
      refreshUncategorizedCount()
      setBulkCategoryOpen(false)
      // Mantener selección para permitir acciones adicionales
    } catch (error) {
      console.error("Error updating categories in bulk", error)
      toast.error(describirError(error, "No se pudieron actualizar las categorías"))
    } finally {
      setBulkCategoryLoading(false)
    }
  }

  const requestCreateCategory = useCallback((assign: (categoryId: string) => void | Promise<void>) => {
    pendingCategoryAssignRef.current = assign
    setCategoryCreateOpen(true)
  }, [])

  const handleCategoryCreated = async (newCategory: Categoria) => {
    await fetchCategorias()
    const assign = pendingCategoryAssignRef.current
    pendingCategoryAssignRef.current = null
    setCategoryCreateOpen(false)
    if (assign) {
      await assign(newCategory.id)
    }
    toast.success(`Categoría "${newCategory.nombre}" creada y asignada`)
  }

  const handleBulkConceptSubmit = async () => {
    const nextConcept = bulkConceptValue.trim()
    if (!nextConcept) {
      toast.error("Escribe un concepto para actualizar")
      return
    }

    setBulkConceptLoading(true)
    try {
      await ejecutarEnLote(selectedMovementIds, "Unificando concepto", (movementId) =>
        handleMovementUpdate(movementId, { concepto: nextConcept }),
      )
      toast.success(`Concepto actualizado en ${selectionCount} transacciones. Selección mantenida para más acciones.`)
      setBulkConceptOpen(false)
      setBulkConceptValue("")
      // Mantener selección para permitir acciones adicionales
    } catch (error) {
      console.error("Error updating concept in bulk", error)
      toast.error(describirError(error, "No se pudieron actualizar los conceptos"))
    } finally {
      setBulkConceptLoading(false)
    }
  }

  const handleBulkDescriptionSubmit = async () => {
    const appendText = bulkDescriptionValue.trim()
    if (!appendText) {
      toast.error("Escribe un texto para añadir a la descripción")
      return
    }

    setBulkDescriptionLoading(true)
    try {
      await ejecutarEnLote(selectedMovements, "Añadiendo nota", (movement) => {
        const currentDescription = (movement.descripcion || "").trimEnd()
        const newDescription = currentDescription ? `${currentDescription}\n${appendText}` : appendText
        return handleMovementUpdate(movement.id, { descripcion: newDescription })
      })
      toast.success(`Descripción ampliada en ${selectionCount} transacciones. Selección mantenida para más acciones.`)
      setBulkDescriptionOpen(false)
      setBulkDescriptionValue("")
      // Mantener selección para permitir acciones adicionales
    } catch (error) {
      console.error("Error appending description in bulk", error)
      toast.error(describirError(error, "No se pudieron actualizar las descripciones"))
    } finally {
      setBulkDescriptionLoading(false)
    }
  }

  /**
   * Marca (o desmarca) "falta factura" en todo lo seleccionado.
   *
   * Es la acción en lote que más falta hacía: repasar el extracto de un mes y
   * señalar de una vez los veinte cargos de los que no ha llegado el papel.
   * Los que ya tienen factura vinculada se saltan — ahí la marca es mentira.
   */
  const handleBulkFacturaPendiente = async (pendiente: boolean) => {
    const objetivo = pendiente
      ? selectedMovements.filter((movement) => !movement.factura_id && !movement.factura_pendiente)
      : selectedMovements.filter((movement) => movement.factura_pendiente)

    if (objetivo.length === 0) {
      toast.info(
        pendiente
          ? "Los seleccionados ya están marcados o ya tienen factura"
          : "Ninguno de los seleccionados estaba marcado",
      )
      return
    }

    setBulkFacturaLoading(true)
    try {
      await ejecutarEnLote(
        objetivo,
        pendiente ? "Marcando falta factura" : "Quitando la marca",
        (movement) => handleMovementUpdate(movement.id, { factura_pendiente: pendiente }),
      )
      const conFactura = pendiente ? selectionCount - objetivo.length : 0
      toast.success(
        pendiente
          ? `Marcados ${objetivo.length} movimientos como "falta factura"` +
              (conFactura > 0 ? ` (${conFactura} se han saltado: ya tenían factura)` : "")
          : `Marca quitada en ${objetivo.length} movimientos`,
      )
    } catch (error) {
      console.error("Error updating factura_pendiente in bulk", error)
      toast.error(describirError(error, "No se pudo cambiar la marca de factura"))
    } finally {
      setBulkFacturaLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!selectionCount) {
      return
    }

    setBulkDeleting(true)
    try {
      const borrados = await deleteMovimientos(selectedMovementIds)
      if (selectedMovementId && selectedMovementIds.includes(selectedMovementId)) {
        setSelectedMovementId(null)
        setSelectedMovementSnapshot(null)
      }
      const cuantos = selectionCount
      clearSelection()
      setBulkDeleteOpen(false)

      // Deshacer, que es la acción más destructiva de la app y hasta ahora no
      // tenía vuelta atrás. Se reinsertan con su id original, así que lo que
      // vuelve es el movimiento y no una copia. Doce segundos porque darse
      // cuenta de que has borrado el mes equivocado lleva más de cinco.
      toast.success(`Has eliminado ${cuantos} ${cuantos === 1 ? "transacción" : "transacciones"}`, {
        duration: 12000,
        action:
          borrados.length > 0
            ? {
                label: "Deshacer",
                onClick: () => {
                  restoreMovimientos(borrados)
                    .then(() => toast.success("Recuperadas. Los archivos adjuntos no vuelven."))
                    .catch((err) => toast.error(describirError(err, "No se han podido recuperar")))
                },
              }
            : undefined,
      })
    } catch (error) {
      console.error("Error deleting movements in bulk", error)
      toast.error(describirError(error, "No se pudieron eliminar las transacciones"))
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleOpenFiles = (movement: MovimientoConRelaciones) => {
    setSelectedMovementId(movement.id)
    setSelectedMovementSnapshot(movement)
    setDetailInitialTab("archivos")
  }

  const handleMovementUpdate = async (
    movementId: string,
    patch: Partial<MovimientoConRelaciones>,
  ) => {
    try {
      const patchWithCategory = { ...patch }
      const { categoria_id: categoriaIdForMovement, ...movementPatch } = patchWithCategory

      if (categoriaIdForMovement !== undefined) {
        await updateCategoria(movementId, categoriaIdForMovement)
        refreshUncategorizedCount()
      }

      if (Object.keys(movementPatch).length > 0) {
        await updateMovimiento(movementId, movementPatch)
      }

      if (selectedMovementId === movementId) {
        setSelectedMovementSnapshot((prev) =>
          prev
            ? {
              ...prev,
              ...movementPatch,
              ...(categoriaIdForMovement !== undefined
                ? { categoria_id: categoriaIdForMovement }
                : {}),
            }
            : prev,
        )
      }
    } catch (error) {
      console.error("Error updating movement:", error)
      throw error
    }
  }

  const handleCreateMovement = async (
    data: Partial<MovimientoConRelaciones>,
  ) => {
    try {
      const accountDelegationId =
        accounts.find((a) => a.id === data.cuenta_id)?.delegacion_id || selectedDelegation
      if (!accountDelegationId) {
        throw new Error("Delegación no seleccionada")
      }
      await createMovimiento({
        ...data,
        // Normalize optional UUIDs to null instead of empty string
        categoria_id: (data as { categoria_id?: string | null })?.categoria_id || null,
        delegacion_id: accountDelegationId,
      })
      await refetch()
      setCreateFormOpen(false)
    } catch (error) {
      console.error("Error creating movement:", error)
      toast.error("Error al crear la transacción")
      throw error
    }
  }

  const clearFilters = () => {
    setFilters({})
  }

  const [uncategorizedCount, setUncategorizedCount] = useState(0)
  const [uncategorizedCountRevision, setUncategorizedCountRevision] = useState(0)

  const refreshUncategorizedCount = useCallback(() => {
    setUncategorizedCountRevision((r) => r + 1)
  }, [])

  useEffect(() => {
    if (!selectedDelegation) {
      setUncategorizedCount(0)
      return
    }
    let countQuery = supabase
      .from("movimiento")
      .select("id", { count: "exact", head: true })
      .eq("delegacion_id", selectedDelegation)
      .eq("ignorado", false)
      .is("categoria_id", null)

    if (filters.dateFrom) countQuery = countQuery.gte("fecha", filters.dateFrom)
    if (filters.dateTo) countQuery = countQuery.lte("fecha", filters.dateTo)
    if (filters.accountId) countQuery = countQuery.eq("cuenta_id", filters.accountId)
    if (filters.search) {
      const term = filters.search.replace(/%/g, "\\%").replace(/,/g, "\\,")
      countQuery = countQuery.or(`concepto.ilike.%${term}%,descripcion.ilike.%${term}%`)
    }
    countQuery = applyAbsoluteAmountFilter(countQuery, filters.amountFrom, filters.amountTo)

    countQuery.then(({ count }) => setUncategorizedCount(count ?? 0))
  }, [
    selectedDelegation,
    uncategorizedCountRevision,
    filters.dateFrom,
    filters.dateTo,
    filters.accountId,
    filters.search,
    filters.amountFrom,
    filters.amountTo,
  ])

  const [facturaPendienteCount, setFacturaPendienteCount] = useState(0)

  useEffect(() => {
    if (!selectedDelegation) {
      setFacturaPendienteCount(0)
      return
    }
    let countQuery = supabase
      .from("movimiento")
      .select("id", { count: "exact", head: true })
      .eq("delegacion_id", selectedDelegation)
      .eq("ignorado", false)
      .eq("factura_pendiente", true)

    if (filters.dateFrom) countQuery = countQuery.gte("fecha", filters.dateFrom)
    if (filters.dateTo) countQuery = countQuery.lte("fecha", filters.dateTo)
    if (filters.accountId) countQuery = countQuery.eq("cuenta_id", filters.accountId)

    countQuery.then(({ count }) => setFacturaPendienteCount(count ?? 0))
  }, [selectedDelegation, filters.dateFrom, filters.dateTo, filters.accountId, movements])

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === "dateFrom" || key === "dateTo") return false
    if (key === "categoryIds" || key === "contactoIds" || key === "contactoTipos") {
      return Array.isArray(value) && value.length > 0
    }
    return value !== undefined && value !== "" && value !== false
  })

  useEffect(() => {
    if (!selectedMovementId) {
      return
    }

    const updatedMovement = movements.find((movement) => movement.id === selectedMovementId) || null

    if (updatedMovement) {
      if (updatedMovement !== selectedMovementSnapshot) {
        setSelectedMovementSnapshot(updatedMovement)
      }
    } else if (!loading) {
      setSelectedMovementId(null)
      setSelectedMovementSnapshot(null)
    }
  }, [selectedMovementId, movements, loading, selectedMovementSnapshot])

  useEffect(() => {
    const panel = searchParams.get("panel")
    if (panel === "create") {
      setCreateFormOpen(true)
    }
    if (panel === "import") {
      setImportOpen(true)
    }
    if (searchParams.get("uncategorized") === "1") {
      setFilters((prev) => ({ ...prev, uncategorized: true }))
    }

    // Llega desde el saldo por proveedor: ese proveedor, y de propina el mismo
    // periodo y las mismas actividades que se estaban mirando allí.
    const contactoParam = searchParams.get("contacto")
    if (contactoParam) {
      setFilters((prev) => ({ ...prev, contactoIds: [contactoParam] }))
    }

    // Llega desde el dashboard (Balance) con categorías preseleccionadas
    const categoriasParam = searchParams.get("categorias")
    if (categoriasParam) {
      const ids = categoriasParam.split(",").filter(Boolean)
      if (ids.length > 0) {
        setFilters((prev) => ({ ...prev, categoryIds: ids }))
      }
    }

    // Rango de fechas por URL (p. ej. desde la conciliación de informes)
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")
    if (desde || hasta) {
      setFilters((prev) => ({
        ...prev,
        dateFrom: desde ?? prev.dateFrom,
        dateTo: hasta ?? prev.dateTo,
      }))
    }

    const movId = searchParams.get("mov")
    if (movId) {
      const found = movements.find((m) => m.id === movId)
      if (found) {
        setSelectedMovementId(found.id)
        setSelectedMovementSnapshot(found)
        setDetailInitialTab("datos")
      }
    }
  }, [searchParams, movements])

  if (delegationsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando delegaciones...</p>
        </div>
      </div>
    )
  }

  if (delegations.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No tienes acceso a ninguna delegación</p>
      </div>
    )
  }

  return (
    // En móvil la pantalla va a sangre: el `p-3` del `main` dejaba un canal
    // vacío a cada lado que no aporta nada aquí y sí le quita ancho a cada
    // concepto. A partir de `sm` manda el margen de la página, como el resto.
    <div className="-mx-3 flex h-[calc(100vh-5rem)] overflow-hidden sm:mx-0 sm:h-[calc(100vh-6rem)] md:h-[calc(100vh-7rem)] lg:h-[calc(100vh-8rem)]">
      {/* Desktop Sidebar Filters */}
      <div
        className={`hidden lg:block border-r bg-card transition-[width] duration-300 ${sidebarCollapsed ? "w-0 overflow-hidden" : "w-80"
          }`}
      >
        {!sidebarCollapsed && !isMobile && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Filtros</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(true)}
                className="hover:bg-muted"
                title="Ocultar filtros"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            <TransactionFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={clearFilters}
              categories={categories}
              accounts={accounts}
              contactos={contactos}
              uncategorizedCount={uncategorizedCount}
              facturaPendienteCount={facturaPendienteCount}
            />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header with Date Filter and Actions */}
        <div className="sticky top-0 z-10 bg-background border-b p-2 space-y-4 sm:p-4">
          <div className="flex items-center justify-between gap-2 min-h-[40px]">
            {/* Date Filter with show filters button - Responsive width */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Desktop Show Filters Button */}
              {sidebarCollapsed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSidebarCollapsed(false)}
                  className="hidden lg:flex flex-shrink-0"
                  title="Mostrar filtros"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              <h1 className="hidden xl:block text-lg font-bold flex-shrink-0 mr-1">Movimientos</h1>
              <div className="w-[200px] sm:w-[240px] md:w-[260px] flex-shrink-0">
                <DateRangeFilter
                  dateFrom={filters.dateFrom}
                  dateTo={filters.dateTo}
                  onDateRangeChange={(dateFrom, dateTo) => setFilters((prev) => ({ ...prev, dateFrom, dateTo }))}
                />
              </div>
              {/* Búsqueda rápida inline (sincronizada con el filtro del sidebar) */}
              <div className="relative hidden md:block flex-1 max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar concepto, contacto…"
                  value={filters.search || ""}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value || undefined }))}
                  className="h-9 pl-9 pr-8"
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, search: undefined }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons - Responsive text visibility */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Mobile Filter Button */}
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`lg:hidden flex-shrink-0 relative ${hasActiveFilters ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
                  }`}
                title="Filtros"
              >
                <Filter className="h-4 w-4" />
                <span className="sr-only">Filtros</span>
                {hasActiveFilters && (
                  <div className="absolute -top-1 -right-1 h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
                )}
              </Button>

              {/* Add Button - Show text on md+ screens */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateFormOpen(true)}
                className="flex-shrink-0"
                title="Añadir transacción"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden md:ml-2 md:inline">Añadir</span>
              </Button>

              {/* Import Button - Show text on md+ screens */}
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 bg-transparent"
                title="Importar transacciones"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="h-4 w-4" />
                <span className="hidden md:ml-2 md:inline">Importar</span>
              </Button>

              {/* Download Button - Show text on md+ screens */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={downloadState === "downloading"}
                className={`flex-shrink-0 bg-transparent ${downloadState === "success" ? "bg-green-500 hover:bg-green-600 text-white" : ""
                  }`}
                title="Descargar transacciones"
              >
                {downloadState === "downloading" ? (
                  <LoadingSpinner size="sm" />
                ) : downloadState === "success" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="hidden md:ml-2 md:inline">
                  {downloadState === "downloading"
                    ? "Descargando..."
                    : downloadState === "success"
                      ? "Descargado"
                      : "Descargar"}
                </span>
              </Button>
            </div>
          </div>

          {selectionActive && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 sm:p-4 shadow-sm animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-start gap-3">
                  <Checkbox
                    checked={masterSelectionState}
                    onCheckedChange={handleToggleSelectAllVisible}
                    className="mt-1 h-5 w-5 border-2"
                    aria-label="Seleccionar todo lo visible"
                  />
                  <div className="min-w-0 space-y-1">
                    <SelectionSummary movements={selectedMovements as unknown as MovimientoConRelaciones[]} />
                    <p className="text-xs text-muted-foreground">
                      <kbd className="rounded border bg-background/80 px-1 py-0.5 font-mono text-[10px]">Shift</kbd>
                      +Click sobre otro círculo para seleccionar todo el rango.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setBulkCategoryOpen(true)}
                    className="flex items-center gap-1"
                  >
                    <Tag className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only">Editar categoría</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkConceptOpen(true)}
                    className="flex items-center gap-1"
                  >
                    <Type className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only">Unificar concepto</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkDescriptionOpen(true)}
                    className="flex items-center gap-1"
                  >
                    <FilePlus className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only">Añadir nota</span>
                  </Button>
                  {/* Marcar "falta factura" de golpe: repasar el extracto de un
                      mes y señalar los cargos sin papel es justo lo que se hace
                      en tanda. Si todo lo seleccionado ya está marcado, el
                      botón se invierte y sirve para quitar la marca. */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkFacturaPendiente(!todoMarcadoFaltaFactura)}
                    disabled={bulkFacturaLoading}
                    className="flex items-center gap-1"
                    title={
                      todoMarcadoFaltaFactura
                        ? "Quitar la marca de falta factura"
                        : "Marcar como pendientes de factura"
                    }
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only">
                      {todoMarcadoFaltaFactura ? "Quitar falta factura" : "Falta factura"}
                    </span>
                  </Button>
                  <Button
                    variant="destructiveGhost"
                    size="sm"
                    onClick={() => setBulkDeleteOpen(true)}
                    className="flex items-center gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only">Eliminar</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="flex items-center gap-1"
                    title="Limpiar selección"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only">Limpiar</span>
                  </Button>
                </div>
              </div>

              {/* Progreso de la acción en curso. Antes la barra se quedaba muda
                  hasta que terminaba: con doscientos seleccionados eso son
                  varios segundos sin saber si va o se ha colgado. */}
              {bulkProgress && (
                <div className="mt-3 space-y-1.5" role="status" aria-live="polite">
                  <div className="flex items-center justify-between gap-2 text-xs font-medium text-primary">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <LoadingSpinner size="sm" />
                      <span className="truncate">{bulkProgress.etiqueta}…</span>
                    </span>
                    <span className="tabular-nums shrink-0">
                      {bulkProgress.hechos}/{bulkProgress.total}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-primary/15">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-200"
                      style={{
                        width: `${bulkProgress.total ? (bulkProgress.hechos / bulkProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {filtersOpen && isMobile && (
            <Card className="lg:hidden p-4 border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-blue-600" />
                  <h3 className="font-semibold text-blue-700 dark:text-blue-300">Filtros</h3>
                  {hasActiveFilters && <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" />}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFiltersOpen(false)}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:text-blue-400"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
              <TransactionFiltersComponent
                filters={filters}
                onFiltersChange={setFilters}
                onClearFilters={clearFilters}
                categories={categories}
                accounts={accounts}
                contactos={contactos}
                uncategorizedCount={uncategorizedCount}
                facturaPendienteCount={facturaPendienteCount}
              />
            </Card>
          )}
        </div>

        {/* Transaction List — el scroll vive dentro de TransactionList: el
            virtualizador necesita ser dueño de su contenedor de scroll. */}
        <div className="flex-1 min-h-0 overflow-hidden">

          <TransactionList
            movements={movements}
            accounts={accounts as unknown as Cuenta[]}
            categories={categories as unknown as Categoria[]}
            loading={loading}
            error={error}
            total={totalMovimientos}
            loaded={movements.length}
            onMovementClick={(movement) => handleMovementClick(movement as unknown as MovimientoConRelaciones)}
            onMovementUpdate={async (movementId, patch) => {
              const fullPatch: Partial<MovimientoConRelaciones> = patch
              await handleMovementUpdate(movementId, fullPatch)
            }}
            onLoadMore={loadMore}
            hasMore={hasMore}
            onOpenFiles={(movement) => handleOpenFiles(movement as unknown as MovimientoConRelaciones)}
            selectedMovementIds={selectedMovementIds}
            onMovementSelectionChange={handleMovementSelectionChange}
            onRequestCreateCategory={requestCreateCategory}
          />
        </div>
      </div>

      <TransactionDetail
        movement={selectedMovementSnapshot}
        accounts={accounts as unknown as Cuenta[]}
        categories={categories as unknown as Categoria[]}
        contactos={contactos}
        delegacionId={selectedDelegation}
        canManageGlobalContact={isAdmin}
        onCreateContacto={async (payload) => {
          if (!payload.insert) return
          return await createContactoFn({ ...payload.insert, creado_por: currentUser?.id ?? null })
        }}
        open={selectedMovementId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMovementId(null)
            setSelectedMovementSnapshot(null)
          }
        }}
        onUpdate={async (movementId, patch) => {
          const fullPatch: Partial<MovimientoConRelaciones> = patch
          await handleMovementUpdate(movementId, fullPatch)
        }}
        initialTab={detailInitialTab}
        onRequestCreateCategory={requestCreateCategory}
      />

      {/* Create Transaction Panel */}
      <TransactionCreatePanel
        accounts={accounts as unknown as Cuenta[]}
        categories={categories as unknown as Categoria[]}
        contactos={contactos}
        delegacionId={selectedDelegation}
        canManageGlobalContact={isAdmin}
        onCreateContacto={async (payload) => {
          if (!payload.insert) return
          return await createContactoFn({ ...payload.insert, creado_por: currentUser?.id ?? null })
        }}
        open={createFormOpen}
        onOpenChange={setCreateFormOpen}
        onCreate={handleCreateMovement}
      />

      <TransactionImportPanel
        accounts={accounts as unknown as Cuenta[]}
        open={importOpen}
        onOpenChange={setImportOpen}
        delegacionId={selectedDelegation}
        onImported={() => {
          refetch()
          // Refetch adicional después de un delay para asegurar sincronización
          setTimeout(() => {
            refetch()
          }, 1000)
        }}
      />

      <Dialog
        open={bulkCategoryOpen}
        onOpenChange={(open) => {
          if (!bulkCategoryLoading) {
            setBulkCategoryOpen(open)
          }
        }}
      >
        <DialogContent className="max-w-4xl w-[calc(100%-1rem)] sm:w-full p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Seleccionar categoría en bloque</DialogTitle>
            <DialogDescription>
              Selecciona la categoría que se aplicará a las {selectionCount} transacciones seleccionadas.
            </DialogDescription>
          </DialogHeader>
          <CategoryMegaSelector
            categories={categories as unknown as Categoria[]}
            selectedCategoryId={undefined}
            onSelect={handleBulkCategorySelect}
            onClose={() => setBulkCategoryOpen(false)}
            bulkSelectionLabel={`${selectionCount} transacciones seleccionadas`}
            onCreateCategory={() => {
              setBulkCategoryOpen(false)
              requestCreateCategory(handleBulkCategorySelect)
            }}
          />
        </DialogContent>
      </Dialog>

      <CategoryQuickCreateSheet
        open={categoryCreateOpen}
        onOpenChange={(open) => {
          setCategoryCreateOpen(open)
          if (!open) {
            pendingCategoryAssignRef.current = null
          }
        }}
        organizacionId={getCurrentDelegation()?.organizacion_id}
        delegacionId={selectedDelegation}
        canManageGlobal={isAdmin}
        categories={categories as unknown as Categoria[]}
        onCreated={handleCategoryCreated}
      />

      <Dialog
        open={bulkConceptOpen}
        onOpenChange={(open) => {
          if (!bulkConceptLoading) {
            setBulkConceptOpen(open)
            if (!open) {
              setBulkConceptValue("")
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unificar concepto</DialogTitle>
            <DialogDescription>
              El nuevo concepto se aplicará a las {selectionCount} transacciones seleccionadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={bulkConceptValue}
              onChange={(event) => setBulkConceptValue(event.target.value)}
              placeholder="Introduce el concepto que compartirán todas"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Usa un nombre claro y con cariño. Si te arrepientes siempre puedes volver a editarlo individualmente.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (!bulkConceptLoading) {
                  setBulkConceptOpen(false)
                  setBulkConceptValue("")
                }
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleBulkConceptSubmit} disabled={bulkConceptLoading}>
              {bulkConceptLoading ? <LoadingSpinner size="sm" /> : "Aplicar concepto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkDescriptionOpen}
        onOpenChange={(open) => {
          if (!bulkDescriptionLoading) {
            setBulkDescriptionOpen(open)
            if (!open) {
              setBulkDescriptionValue("")
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Añadir nota a la descripción</DialogTitle>
            <DialogDescription>
              El texto que escribas se colocará al final de la descripción existente de cada transacción seleccionada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={bulkDescriptionValue}
              onChange={(event) => setBulkDescriptionValue(event.target.value)}
              rows={4}
              placeholder="Escribe la nota extra que quieres añadir"
            />
            <p className="text-xs text-muted-foreground">
              Añadiremos la nota con un salto de línea. Perfecto para matices, chistes internos o recordatorios del futuro.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (!bulkDescriptionLoading) {
                  setBulkDescriptionOpen(false)
                  setBulkDescriptionValue("")
                }
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleBulkDescriptionSubmit} disabled={bulkDescriptionLoading}>
              {bulkDescriptionLoading ? <LoadingSpinner size="sm" /> : "Añadir a todas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!bulkDeleting) {
            setBulkDeleteOpen(open)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 animate-bounce" />
              ¡Alerta roja!
            </DialogTitle>
            <DialogDescription>
              Esta operación eliminará para siempre las {selectionCount} transacciones seleccionadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-destructive animate-pulse">
              ¿ESTÁS ABSOLUTAMENTE SEGURO DE QUE QUIERES ELIMINARLAS?
            </p>
            <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <span className="text-3xl animate-bounce">🤯</span>
              <div className="text-sm text-destructive">
                Respira hondo, revisa la selección y confirma solo si no hay vuelta atrás.
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Esta acción no se puede deshacer. Si mañana te arrepientes prometemos enviarte un gif de ánimo, pero los datos no
              volverán.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!bulkDeleting) {
                  setBulkDeleteOpen(false)
                }
              }}
            >
              Mejor no
            </Button>
            <Button type="button" variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <LoadingSpinner size="sm" /> : "Eliminar para siempre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
