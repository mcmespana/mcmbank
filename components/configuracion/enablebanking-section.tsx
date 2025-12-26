"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

type Aspsp = {
  name: string
  country: string
  bic?: string
  maximum_consent_validity?: number
}

type Consent = {
  id: string
  aspsp_name: string
  aspsp_country: string
  psu_type: string
  status: string
  created_at: string
  authorized_at: string | null
}

type EnableBankingAccount = {
  id: string
  provider_account_id: string
  iban: string | null
  currency: string | null
  owner_name: string | null
}

type Cuenta = {
  id: string
  nombre: string
  delegacion_id: string
  banco_nombre: string | null
  iban: string | null
}

type Link = {
  id: string
  cuenta_id: string
  enablebanking_account_id: string
  last_sync_at: string | null
  sync_start_date: string | null
}

type OverviewResponse = {
  consents: Consent[]
  accounts: EnableBankingAccount[]
  links: Link[]
  cuentas: Cuenta[]
}

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es-ES") : "—"

export function EnableBankingSection() {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [aspsps, setAspsps] = useState<Aspsp[]>([])
  const [psuType, setPsuType] = useState("business")
  const [selectedAspsp, setSelectedAspsp] = useState<Aspsp | null>(null)
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>({})
  const [syncDates, setSyncDates] = useState<Record<string, string>>({})
  const [authorizing, setAuthorizing] = useState(false)
  const [linking, setLinking] = useState<Record<string, boolean>>({})
  const [syncing, setSyncing] = useState<Record<string, boolean>>({})
  const searchParams = useSearchParams()

  const loadOverview = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/enablebanking/overview")
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Error cargando Enable Banking")
      }
      setOverview(data)
      const selections: Record<string, string> = {}
      const dates: Record<string, string> = {}
      data.links.forEach((link: Link) => {
        selections[link.enablebanking_account_id] = link.cuenta_id
        if (link.sync_start_date) {
          dates[link.enablebanking_account_id] = link.sync_start_date
        }
      })
      setLinkSelections(selections)
      setSyncDates(dates)
    } catch (err: any) {
      toast.error(err?.message || "No se pudo cargar Enable Banking")
    } finally {
      setLoading(false)
    }
  }

  const loadAspsps = async (currentPsuType: string) => {
    try {
      const res = await fetch(
        `/api/enablebanking/aspsps?country=ES&service=AIS&psu_type=${encodeURIComponent(currentPsuType)}`,
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Error cargando bancos")
      }
      setAspsps(data.aspsps || [])
      const sabadell = (data.aspsps || []).find((bank: Aspsp) =>
        bank.name.toLowerCase().includes("sabadell"),
      )
      setSelectedAspsp(sabadell || data.aspsps?.[0] || null)
    } catch (err: any) {
      toast.error(err?.message || "No se pudo cargar bancos")
    }
  }

  useEffect(() => {
    loadOverview()
  }, [])

  useEffect(() => {
    const status = searchParams.get("enablebanking")
    if (!status) return
    if (status === "authorized") {
      toast.success("Autorización completada")
    } else if (status === "failed") {
      toast.error("La autorización falló")
    }
  }, [searchParams])

  useEffect(() => {
    loadAspsps(psuType)
  }, [psuType])

  const cuentaOptions = useMemo(() => overview?.cuentas || [], [overview?.cuentas])
  const linksByAccount = useMemo(() => {
    const map: Record<string, Link> = {}
    overview?.links?.forEach((link) => {
      map[link.enablebanking_account_id] = link
    })
    return map
  }, [overview?.links])

  const handleAuthorize = async () => {
    if (!selectedAspsp) return
    setAuthorizing(true)
    try {
      const res = await fetch("/api/enablebanking/authorizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aspsp_name: selectedAspsp.name,
          aspsp_country: selectedAspsp.country,
          aspsp_bic: selectedAspsp.bic,
          psu_type: psuType,
          valid_days: 90,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "No se pudo iniciar la autorización")
      }
      window.location.assign(data.url)
    } catch (err: any) {
      toast.error(err?.message || "Error iniciando autorización")
    } finally {
      setAuthorizing(false)
    }
  }

  const handleLink = async (accountId: string) => {
    const cuentaId = linkSelections[accountId]
    if (!cuentaId) {
      toast.error("Selecciona una cuenta de MCM Bank")
      return
    }
    setLinking((prev) => ({ ...prev, [accountId]: true }))
    try {
      const res = await fetch("/api/enablebanking/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuenta_id: cuentaId,
          enablebanking_account_id: accountId,
          sync_start_date: syncDates[accountId] || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "No se pudo vincular la cuenta")
      }
      toast.success("Cuenta vinculada")
      await loadOverview()
    } catch (err: any) {
      toast.error(err?.message || "Error vinculando la cuenta")
    } finally {
      setLinking((prev) => ({ ...prev, [accountId]: false }))
    }
  }

  const handleSync = async (linkId: string, accountId: string) => {
    setSyncing((prev) => ({ ...prev, [accountId]: true }))
    try {
      const res = await fetch("/api/enablebanking/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_id: linkId }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Error sincronizando")
      }
      toast.success("Sincronización completada")
      await loadOverview()
    } catch (err: any) {
      toast.error(err?.message || "Error sincronizando")
    } finally {
      setSyncing((prev) => ({ ...prev, [accountId]: false }))
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Integración bancaria (Enable Banking)</h2>
        <p className="text-sm text-muted-foreground">
          Autoriza cuentas bancarias desde Sabadell y vincúlalas con MCM Bank.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Autorizar banco</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo de PSU</Label>
              <Select value={psuType} onValueChange={setPsuType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Empresa</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Banco</Label>
              <Select
                value={selectedAspsp?.name || ""}
                onValueChange={(value) => {
                  const bank = aspsps.find((item) => item.name === value) || null
                  setSelectedAspsp(bank)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona banco" />
                </SelectTrigger>
                <SelectContent>
                  {aspsps.map((bank) => (
                    <SelectItem key={`${bank.name}-${bank.country}`} value={bank.name}>
                      {bank.name} ({bank.country})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sabadell es el banco recomendado, pero puedes elegir otro si aparece en la lista.
              </p>
            </div>
          </div>
          <Button onClick={handleAuthorize} disabled={!selectedAspsp || authorizing}>
            {authorizing ? "Abriendo autorización..." : "Iniciar autorización"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Sesiones autorizadas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : overview?.consents?.length ? (
            <div className="space-y-3">
              {overview.consents.map((consent) => (
                <div
                  key={consent.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {consent.aspsp_name} ({consent.aspsp_country})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PSU {consent.psu_type} · Creado {formatDateTime(consent.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={consent.status === "authorized" ? "default" : "secondary"}>
                      {consent.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Autorizado: {formatDateTime(consent.authorized_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay sesiones autorizadas todavía.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Vincular cuentas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando cuentas...</p>
          ) : overview?.accounts?.length ? (
            <div className="space-y-4">
              {overview.accounts.map((account) => {
                const link = linksByAccount[account.id]
                return (
                  <div key={account.id} className="rounded-lg border border-border/70 p-4 space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{account.owner_name || "Cuenta bancaria"}</p>
                        <p className="text-xs text-muted-foreground">
                          IBAN: {account.iban || "—"} · {account.currency || "—"}
                        </p>
                      </div>
                      {link ? (
                        <Badge variant="outline">Vinculada</Badge>
                      ) : (
                        <Badge variant="secondary">Sin vínculo</Badge>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="md:col-span-2">
                        <Label>Cuenta MCM Bank</Label>
                        <Select
                          value={linkSelections[account.id] || ""}
                          onValueChange={(value) =>
                            setLinkSelections((prev) => ({ ...prev, [account.id]: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona cuenta" />
                          </SelectTrigger>
                          <SelectContent>
                            {cuentaOptions.map((cuenta) => (
                              <SelectItem key={cuenta.id} value={cuenta.id}>
                                {cuenta.nombre} {cuenta.banco_nombre ? `· ${cuenta.banco_nombre}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Fecha inicial</Label>
                        <Input
                          type="date"
                          value={syncDates[account.id] || ""}
                          onChange={(event) =>
                            setSyncDates((prev) => ({ ...prev, [account.id]: event.target.value }))
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <Button
                        variant="outline"
                        onClick={() => handleLink(account.id)}
                        disabled={linking[account.id]}
                      >
                        {linking[account.id] ? "Vinculando..." : "Guardar vínculo"}
                      </Button>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          Última sync: {formatDateTime(link?.last_sync_at || null)}
                        </span>
                        {link && (
                          <Button
                            size="sm"
                            onClick={() => handleSync(link.id, account.id)}
                            disabled={syncing[account.id]}
                          >
                            {syncing[account.id] ? "Sincronizando..." : "Sincronizar ahora"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no hay cuentas autorizadas. Completa la autorización del banco primero.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
