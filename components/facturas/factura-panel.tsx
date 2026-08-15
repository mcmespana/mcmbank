"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, BadgeCheck, Check, Eye, Loader2, Trash2, Unlink, X } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu"
import { StatusPill } from "@/components/ui/status-pill"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useCategoriaEntorno } from "@/hooks/use-categoria-entorno"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { CONTACTO_TIPO_DEFAULT_EMOJIS } from "@/lib/utils/contacto-tipos"
import { FACTURA_ESTADO_INFO } from "@/lib/utils/facturas"
import { formatMoney, parseMoney } from "@/components/ui/money-input"
import { FacturaImporte } from "./factura-importe"
import { FacturaDatosFields, FACTURA_CAMPO_IDS, type FacturaDatosFieldsValue } from "./factura-datos-fields"
import { FacturaConciliacionPanel } from "./factura-conciliacion-panel"
import { FacturaArchivos } from "./factura-archivos"
import { FacturaIaPanel } from "./factura-ia-panel"
import { FacturaVisorDialog } from "./factura-visor-dialog"
import { ContactoForm, type ContactoFormSubmitPayload } from "@/components/contactos/contacto-form"
import type {
  Categoria,
  Contacto,
  ContactoConCategoriaPredeterminada,
  Factura,
  FacturaConRelaciones,
  FacturaInsert,
  FacturaUpdate,
} from "@/lib/types/database"

export interface FacturaPanelSubmit {
  insert?: Omit<FacturaInsert, "creado_en" | "actualizado_en">
  update?: FacturaUpdate
}

interface FacturaPanelProps {
  factura: FacturaConRelaciones | null
  delegacionId: string | null
  contactos: ContactoConCategoriaPredeterminada[]
  categorias: Categoria[]
  canEdit: boolean
  canManageGlobalContact?: boolean
  onCreateContacto?: (payload: ContactoFormSubmitPayload) => Promise<Contacto | void>
  onSave: (payload: FacturaPanelSubmit) => Promise<Factura | void>
  onLinkMovimiento: (facturaId: string, movimientoId: string, creadoPor?: string) => Promise<void>
  onUnlinkMovimiento: (facturaId: string, movimientoId: string) => Promise<void>
  onMarcarPagadaFuera: (facturaId: string) => Promise<void>
  onDelete: (factura: FacturaConRelaciones) => Promise<void> | void
  onRefrescar?: () => void | Promise<void>
  onContactosCambiados?: () => void
  onClose: () => void
  /** Avisa de que se está rebuscando entre movimientos (el panel pide ancho). */
  onModoBusquedaChange?: (buscando: boolean) => void
  /** Si se llegó aquí desde un movimiento, la URL para volver a él. */
  volverHref?: string | null
  className?: string
}

const EMPTY_VALUE: FacturaDatosFieldsValue = {
  contactoId: null,
  categoriaId: null,
  concepto: "",
  numero: "",
  fechaEmision: null,
  importeDisplay: "",
  notas: "",
}

/**
 * El panel de una factura: cabecera, datos, conciliación, notas y documento.
 *
 * El orden importa y es justo el contrario del que tenía. Antes lo primero era
 * el Documento —una miniatura y un enlace— y en el modo de trabajo nuevo el
 * documento se está viendo entero a la izquierda, así que abría el panel
 * enseñando lo único que ya se veía. Ahora arriba está lo que hay que
 * rellenar, en medio lo que hay que decidir (con qué movimiento del banco se
 * corresponde), y el fichero al final, donde se gestiona pero no se mira.
 */
export function FacturaPanel({
  factura,
  delegacionId,
  contactos,
  categorias,
  canEdit,
  canManageGlobalContact,
  onCreateContacto,
  onSave,
  onLinkMovimiento,
  onUnlinkMovimiento,
  onMarcarPagadaFuera,
  onDelete,
  onRefrescar,
  onContactosCambiados,
  onClose,
  onModoBusquedaChange,
  volverHref,
  className,
}: FacturaPanelProps) {
  const { user } = useAuth()
  const isEdit = Boolean(factura?.id)

  const [value, setValue] = useState<FacturaDatosFieldsValue>(EMPTY_VALUE)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [contactoCreateOpen, setContactoCreateOpen] = useState(false)
  const [contactoInitialNombre, setContactoInitialNombre] = useState("")
  const [visorAbierto, setVisorAbierto] = useState(false)

  const archivoPrincipal = factura?.archivos?.[0] ?? null

  // Sincroniza el formulario cada vez que cambia la factura mostrada.
  // `actualizado_en` entra en las dependencias a propósito: cuando la lectura
  // con IA rellena campos, la factura vuelve con datos nuevos y el formulario
  // abierto tiene que reflejarlos.
  useEffect(() => {
    setValue(
      factura
        ? {
            contactoId: factura.contacto_id,
            categoriaId: factura.categoria_id,
            concepto: factura.concepto ?? "",
            numero: factura.numero ?? "",
            fechaEmision: factura.fecha_emision,
            importeDisplay: factura.importe != null ? formatMoney(Math.abs(Number(factura.importe))) : "",
            notas: factura.notas ?? "",
          }
        : EMPTY_VALUE,
    )
    setSeleccion(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factura?.id, factura?.actualizado_en])

  // Se abre el panel con el cursor puesto en el concepto, siempre.
  //
  // Antes se enfocaba "el primer campo que falte", que suena más listo pero se
  // portaba peor: el sitio al que va el cursor cambiaba en cada factura, así
  // que había que mirar dónde había caído antes de escribir. El concepto es
  // además el campo que más se retoca (lo que trae la IA o el banco casi nunca
  // es lo que uno escribiría), y desde él se llega a los demás con el tabulador.
  useEffect(() => {
    if (!canEdit) return
    const id = window.setTimeout(() => {
      const campo = document.getElementById(FACTURA_CAMPO_IDS.concepto) as HTMLInputElement | null
      campo?.focus()
      // El cursor al final del texto: enfocar un input con contenido lo
      // selecciona entero en algunos navegadores, y la primera tecla lo borra.
      const fin = campo?.value.length ?? 0
      campo?.setSelectionRange(fin, fin)
    }, 120)
    return () => window.clearTimeout(id)
  }, [factura?.id, canEdit])

  const importeNumerico = useMemo(() => parseMoney(value.importeDisplay), [value.importeDisplay])
  // El nombre del proveedor entra en la búsqueda de candidatos: es lo que
  // permite descartar el pago de Amazon que cuadra en importe con una factura
  // de Mercadona. Se usa el nombre de la ficha, no el alias de la delegación.
  const contactoSeleccionado = useMemo(
    () => contactos.find((c) => c.id === value.contactoId) ?? null,
    [contactos, value.contactoId],
  )
  const movimientosVinculados = useMemo(() => factura?.movimientos ?? [], [factura])
  const importeYaPagado = useMemo(
    () => movimientosVinculados.reduce((sum, m) => sum + Math.abs(Number(m.importe)), 0),
    [movimientosVinculados],
  )
  const importePendiente = importeNumerico != null ? Math.max(importeNumerico - importeYaPagado, 0) : null

  const enBandeja = factura?.estado === "bandeja"

  // La actividad en la que se estaba gastando por esas fechas. Manda sobre la
  // sugerencia de la IA (que solo mira el papel) porque aquí el gasto va por
  // temporadas: en junio casi todo es del campamento de julio, y el albarán de
  // la ferretería no lo dice en ninguna parte.
  const { sugerencia: sugerenciaEntorno } = useCategoriaEntorno(
    delegacionId,
    value.fechaEmision,
    categorias,
  )

  const handleSubmit = async () => {
    if (!delegacionId) {
      toast.error("Selecciona una delegación antes de guardar la factura")
      return
    }
    if (value.importeDisplay.trim() && importeNumerico == null) {
      toast.error("El importe no es válido")
      return
    }

    const base: FacturaUpdate = {
      contacto_id: value.contactoId,
      categoria_id: value.categoriaId,
      concepto: value.concepto.trim() || null,
      numero: value.numero.trim() || null,
      fecha_emision: value.fechaEmision,
      // El importe de una factura es lo que hay que pagar, no un apunte con
      // signo: en negativo rompería el pendiente (que se acota a 0) y por tanto
      // la búsqueda de movimientos candidatos.
      importe: importeNumerico != null ? Math.abs(importeNumerico) : null,
      notas: value.notas.trim() || null,
    }

    // Confirmar es lo que saca la factura de la bandeja. Mientras esté ahí es
    // "un papel que ha llegado"; en cuanto una persona da el visto bueno a los
    // datos pasa a ser una factura registrada, aunque nadie la haya pagado aún.
    // Si además se vincula un movimiento, el trigger de scripts/048 recalcula
    // el estado a pagada/parcial por encima de esto.
    if (enBandeja) base.estado = "sin_pagar"

    setSaving(true)
    try {
      let facturaId = factura?.id
      if (isEdit && factura) {
        await onSave({ update: base })
      } else {
        // Una factura escrita a mano no pasa por la bandeja (que por defecto es
        // donde caería): la bandeja es lo que ha llegado sin revisar, y esto lo
        // acaba de teclear una persona mirando el papel.
        const created = await onSave({
          insert: { ...base, delegacion_id: delegacionId, estado: "sin_pagar" },
        })
        facturaId = created && "id" in created ? created.id : undefined
      }

      if (facturaId && seleccion) {
        await onLinkMovimiento(facturaId, seleccion, user?.id)
      }

      toast.success(
        enBandeja
          ? seleccion
            ? "Factura confirmada y vinculada"
            : "Factura confirmada"
          : isEdit
            ? "Factura actualizada"
            : "Factura creada",
      )
      onClose()
    } catch (err) {
      toast.error("No se pudo guardar: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setSaving(false)
    }
  }

  const handleUnlink = async (movimientoId: string) => {
    if (!factura) return
    try {
      await onUnlinkMovimiento(factura.id, movimientoId)
      toast.success("Movimiento desvinculado")
    } catch (err) {
      toast.error("No se pudo desvincular: " + (err instanceof Error ? err.message : "error desconocido"))
    }
  }

  const handlePagadaFuera = async () => {
    if (!factura) return
    try {
      await onMarcarPagadaFuera(factura.id)
      toast.success("Factura marcada como pagada fuera de MCM Bank")
      onClose()
    } catch (err) {
      toast.error("No se pudo actualizar: " + (err instanceof Error ? err.message : "error desconocido"))
    }
  }

  const handleDelete = async () => {
    if (!factura) return
    try {
      await onDelete(factura)
    } catch (err) {
      toast.error("No se pudo eliminar: " + (err instanceof Error ? err.message : "error desconocido"))
    }
  }

  const estadoInfo = factura ? FACTURA_ESTADO_INFO[factura.estado] : null
  const titulo =
    factura?.concepto?.trim() ||
    factura?.archivos?.[0]?.nombre_original ||
    (isEdit ? "Factura" : "Nueva factura")
  const puedeConciliar = factura ? factura.estado !== "pagada" && factura.estado !== "pagada_fuera" : true

  const menuItems: ActionMenuItem[] = [
    ...(factura && factura.estado !== "pagada_fuera"
      ? [{ label: "Marcar como pagada fuera de MCM Bank", icon: BadgeCheck, onSelect: handlePagadaFuera }]
      : []),
    ...movimientosVinculados.map((m) => ({
      label: `Desvincular ${formatCurrency(Number(m.importe))} · ${formatDate(m.fecha)}`,
      icon: Unlink,
      onSelect: () => handleUnlink(m.id),
    })),
    // Eliminar vive aquí y no en el pie: es la acción más rara de las tres y
    // era la que hacía que el pie no cupiera en un móvil.
    ...(factura
      ? [
          {
            label: "Eliminar factura",
            confirmLabel: "Sí, eliminar la factura",
            icon: Trash2,
            destructive: true,
            onSelect: () => void handleDelete(),
          },
        ]
      : []),
  ]

  return (
    // `min-w-0` no es decorativo: sin él, un hijo ancho (el pie con sus
    // botones) fija el ancho mínimo de la columna, el panel crece por encima
    // del viewport y el `overflow-hidden` del workspace le corta el lado
    // derecho — que es exactamente el corte que se veía en móvil y en pantallas
    // estrechas de escritorio.
    <div className={cn("relative flex min-h-0 min-w-0 flex-col bg-background", className)}>
      {/* Cabecera */}
      <div className="flex items-start gap-3 border-b border-border/40 px-4 py-3 sm:px-5 sm:py-4">
        {volverHref && (
          <Button
            asChild
            type="button"
            variant="ghost"
            size="icon"
            className="-ml-1 h-8 w-8 shrink-0 text-muted-foreground"
            title="Volver al movimiento"
          >
            <Link href={volverHref}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver al movimiento</span>
            </Link>
          </Button>
        )}
        {factura?.contacto ? (
          <EntityAvatar
            name={factura.contacto.nombre}
            emoji={factura.contacto.emoji}
            defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
            colorHex={factura.contacto.color}
            logoUrl={factura.contacto.logo_url}
            size="lg"
            seed={`contacto:${factura.contacto.id}`}
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="truncate text-lg font-semibold tracking-tight">{titulo}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {estadoInfo && (
              <StatusPill
                label={estadoInfo.label}
                icon={estadoInfo.icon}
                bgClass={estadoInfo.bgClass}
                textClass={estadoInfo.textClass}
                borderClass={estadoInfo.borderClass}
                size="sm"
              />
            )}
            {importeNumerico != null && (
              <FacturaImporte importe={importeNumerico} estado={factura?.estado} size="sm" />
            )}
            {factura?.estado === "pagada_parcial" && importePendiente != null && (
              <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                Falta {formatCurrency(importePendiente)}
              </span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Cerrar"
          className="-mr-1 h-8 w-8 shrink-0 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Ver el documento: solo en móvil, donde no hay visor al lado. Va arriba
          porque mirar el papel es lo primero que se hace al abrir una factura,
          y antes obligaba a bajar hasta el final del panel para encontrarlo.
          Fuera del `fieldset` a propósito: quien solo puede mirar (el fieldset
          va deshabilitado) también tiene derecho a ver el documento. */}
      {archivoPrincipal && (
        <div className="border-b border-border/40 px-4 py-2 sm:px-5 lg:hidden">
          <button
            type="button"
            onClick={() => setVisorAbierto(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2 text-left text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <Eye className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="shrink-0">Ver el documento</span>
            <span className="min-w-0 flex-1 truncate text-right text-[11px] font-normal text-muted-foreground">
              {archivoPrincipal.nombre_original}
            </span>
          </button>
        </div>
      )}

      {/* Radix envuelve el contenido en un `display: table` que crece con lo
          más ancho que haya dentro; en un panel estrecho eso se traduce en
          contenido cortado por la derecha sin barra que lo delate. Se le
          fuerza a comportarse como un bloque normal. */}
      <ScrollArea className="min-h-0 w-full flex-1 [&>div>div]:!block [&>div>div]:!min-w-0">
        <fieldset
          disabled={!canEdit}
          className="m-0 min-w-0 space-y-5 border-0 px-4 py-4 sm:px-5 disabled:opacity-70"
        >
          {/* Lectura automática: una tira, arriba del todo, porque explica de
              dónde salen los datos que hay justo debajo. */}
          {isEdit && factura && (
            <FacturaIaPanel
              factura={factura}
              canEdit={canEdit}
              onChanged={() => onRefrescar?.()}
              onCategoriaAceptada={(categoriaId) => setValue((prev) => ({ ...prev, categoriaId }))}
              // Dos sugerencias de categoría a la vez son una pregunta con dos
              // respuestas correctas: si tenemos la del entorno, esa manda.
              ocultarSugerenciaCategoria={Boolean(sugerenciaEntorno)}
            />
          )}

          <FacturaDatosFields
            value={value}
            onChange={(patch) => setValue((prev) => ({ ...prev, ...patch }))}
            contactos={contactos}
            categorias={categorias}
            sugerenciaCategoria={sugerenciaEntorno}
            onContactoAdoptado={onContactosCambiados}
            onCreateContacto={
              onCreateContacto
                ? (initialNombre) => {
                    setContactoInitialNombre(initialNombre)
                    setContactoCreateOpen(true)
                  }
                : undefined
            }
          />

          {/* Vincular con el banco */}
          {puedeConciliar && delegacionId && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Vincular factura con movimiento del banco
                </h3>
                <FacturaConciliacionPanel
                  delegacionId={delegacionId}
                  facturaId={factura?.id ?? null}
                  importePendiente={importePendiente}
                  importeYaPagado={importeYaPagado}
                  fechaEmision={value.fechaEmision}
                  contactoId={value.contactoId}
                  contactoNombre={contactoSeleccionado?.nombre ?? null}
                  seleccion={seleccion}
                  onSeleccionChange={setSeleccion}
                  onModoBusquedaChange={onModoBusquedaChange}
                />
              </div>
            </>
          )}

          {movimientosVinculados.length > 0 && (
            <div className="space-y-1">
              {movimientosVinculados.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-1.5 rounded-md border border-emerald-200/70 bg-emerald-50/60 px-2 py-1 text-[11px] text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                >
                  <Check className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {formatDate(m.fecha)} · {formatCurrency(Number(m.importe))} · {m.concepto}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUnlink(m.id)}
                    className="shrink-0 rounded p-0.5 text-emerald-700/70 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300/70 dark:hover:bg-emerald-900/40"
                    title="Desvincular este movimiento"
                  >
                    <Unlink className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Notas internas */}
          <Separator />
          <div className="space-y-1.5">
            <Label htmlFor="factura-notas">Notas internas</Label>
            <Textarea
              id="factura-notas"
              value={value.notas}
              onChange={(e) => setValue((prev) => ({ ...prev, notas: e.target.value }))}
              placeholder="Notas privadas para el equipo (opcional)."
              rows={2}
            />
          </div>

          {/* Documento, al final: a la izquierda ya se está viendo entero. */}
          {isEdit && factura && delegacionId && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Documento
                </h3>
                <FacturaArchivos
                  facturaId={factura.id}
                  delegacionId={delegacionId}
                  onCambio={() => onRefrescar?.()}
                />
              </div>
            </>
          )}
        </fieldset>
      </ScrollArea>

      {canEdit && (
        <div className="flex min-w-0 items-center gap-2 border-t border-border/40 px-4 py-3 sm:px-5">
          {factura && menuItems.length > 0 && (
            <ActionMenu
              ariaLabel="Más acciones de la factura"
              items={menuItems}
              align="start"
              side="top"
              // El pie vive dentro del workspace (z-[60]); sin esto el menú se
              // dibuja por debajo y en un móvil parece que no abre nada.
              contentClassName="z-[80]"
            />
          )}
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving} className="shrink-0">
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saving} className="min-w-0">
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" /> Guardando…
                </>
              ) : enBandeja ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{seleccion ? "Confirmar y vincular" : "Confirmar"}</span>
                </>
              ) : seleccion ? (
                <span className="truncate">Guardar y vincular</span>
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
        </div>
      )}

      <FacturaVisorDialog
        archivo={archivoPrincipal}
        open={visorAbierto}
        onOpenChange={setVisorAbierto}
      />

      {/* Alta de proveedor: una capa DENTRO del panel, no otro Sheet encima.
          Un segundo panel flotante traía su propia capa oscura, que sumada a la
          del primero dejaba la pantalla casi negra, y además tapaba el
          documento — justo lo que hace falta mirar para copiar el NIF. */}
      {onCreateContacto && contactoCreateOpen && (
        <div className="absolute inset-0 z-30 flex flex-col bg-background animate-in slide-in-from-right-4 duration-200">
          <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-ml-1 h-8 w-8"
              aria-label="Volver a la factura"
              onClick={() => setContactoCreateOpen(false)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-base font-semibold tracking-tight">Nuevo proveedor</h2>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-4 py-4 sm:px-5">
              <ContactoForm
                delegacionId={delegacionId}
                contacto={null}
                categorias={categorias}
                canManageGlobal={Boolean(canManageGlobalContact)}
                defaultTipo="proveedor"
                defaultNombre={contactoInitialNombre}
                onSubmit={async (payload) => {
                  const created = (await onCreateContacto(payload)) as Contacto | void
                  if (created?.id) {
                    setValue((prev) => ({ ...prev, contactoId: created.id }))
                  }
                  return created
                }}
                onCancel={() => setContactoCreateOpen(false)}
                onSaved={() => setContactoCreateOpen(false)}
              />
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

