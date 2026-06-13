"use client"

import { useEffect, useState } from "react"
import { Loader2, Link2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { DateField } from "@/components/ui/date-field"

type Aspsp = {
  name: string
  country: string
  logo?: string
  psu_types: Array<"personal" | "business">
  maximum_consent_validity: number
  sandbox?: boolean
  beta?: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  cuentaId: string
  cuentaNombre: string
}

export function CuentaConnectDialog({ open, onOpenChange, cuentaId, cuentaNombre }: Props) {
  const [aspsps, setAspsps] = useState<Aspsp[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [country, setCountry] = useState("ES")
  const [aspspName, setAspspName] = useState<string>("")
  const [psuType, setPsuType] = useState<"personal" | "business">("business")
  const [validDays, setValidDays] = useState(90)
  const [historyMode, setHistoryMode] = useState<"all" | "from">("all")
  const [syncDesdeFecha, setSyncDesdeFecha] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setLoading(true)
    fetch(`/api/bank-sync/aspsps?country=${country}`)
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.detalle || j.error || `HTTP ${r.status}`)
        setAspsps(j.aspsps || [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [open, country])

  const selected = aspsps.find((a) => a.name === aspspName)
  const maxDaysAllowed = selected ? Math.min(180, Math.floor(selected.maximum_consent_validity / 86400)) : 90

  const connect = async () => {
    if (!aspspName) return
    if (historyMode === "from" && !syncDesdeFecha) {
      setError("Indica la fecha desde la que quieres traer los movimientos.")
      return
    }
    setConnecting(true)
    setError(null)
    try {
      const res = await fetch("/api/bank-sync/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuenta_id: cuentaId,
          aspsp_name: aspspName,
          aspsp_country: country,
          psu_type: psuType,
          valid_days: Math.min(validDays, maxDaysAllowed),
          sync_desde_fecha: historyMode === "from" ? syncDesdeFecha : null,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.detalle || body.error || `HTTP ${res.status}`)
      window.location.href = body.url
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setConnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Conectar {cuentaNombre} con el banco
          </DialogTitle>
          <DialogDescription>
            Selecciona el banco y el tipo de cliente. Serás redirigido al banco para autorizar el acceso a
            tus movimientos durante {validDays} días.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>País</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ES">España</SelectItem>
                <SelectItem value="PT">Portugal</SelectItem>
                <SelectItem value="FR">Francia</SelectItem>
                <SelectItem value="IT">Italia</SelectItem>
                <SelectItem value="DE">Alemania</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Banco</Label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando bancos...
              </div>
            ) : (
              <Select value={aspspName} onValueChange={setAspspName}>
                <SelectTrigger>
                  <SelectValue placeholder={`${aspsps.length} bancos disponibles`} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {aspsps.map((a) => (
                    <SelectItem key={`${a.name}-${a.country}`} value={a.name}>
                      {a.name}
                      {a.sandbox ? " (sandbox)" : ""}
                      {a.beta ? " (beta)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tipo de cliente</Label>
            <Select value={psuType} onValueChange={(v) => setPsuType(v as "personal" | "business")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="business"
                  disabled={selected ? !selected.psu_types.includes("business") : false}
                >
                  Empresa / Asociación
                </SelectItem>
                <SelectItem
                  value="personal"
                  disabled={selected ? !selected.psu_types.includes("personal") : false}
                >
                  Personal
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Días de consentimiento</Label>
            <Input
              type="number"
              min={1}
              max={maxDaysAllowed}
              value={validDays}
              onChange={(e) => setValidDays(Number(e.target.value) || 90)}
            />
            <p className="text-xs text-muted-foreground">
              Máximo permitido por este banco: {maxDaysAllowed} días. Al vencer tendrás que renovar.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Movimientos a importar</Label>
            <Select value={historyMode} onValueChange={(v) => setHistoryMode(v as "all" | "from")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los disponibles</SelectItem>
                <SelectItem value="from">Desde una fecha concreta</SelectItem>
              </SelectContent>
            </Select>
            {historyMode === "from" ? (
              <>
                <DateField value={syncDesdeFecha} onChange={setSyncDesdeFecha} />
                <p className="text-xs text-muted-foreground">
                  Se importarán los movimientos desde esta fecha. Si el banco no conserva tanto histórico,
                  rechazará la petición; en ese caso elige una fecha más reciente o importa lo anterior desde Excel.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Intentaremos traer todo el histórico que permita el banco (hasta 2 años). Por PSD2, muchos
                bancos limitan a los últimos 90 días.
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap font-mono text-xs">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={connecting}>
            Cancelar
          </Button>
          <Button onClick={connect} disabled={!aspspName || connecting}>
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirigiendo...
              </>
            ) : (
              "Conectar con el banco"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
