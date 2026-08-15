"use client"

import { useEffect, useMemo, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { Delegacion } from "@/lib/types/database"
import { useIsAdminState } from "@/hooks/use-is-admin"
import { PlantillaMemoriaSection } from "@/components/configuracion/plantilla-memoria-section"
import { EnableBankingHealthSection } from "@/components/configuracion/enable-banking-health-section"
import { ConexionesMcpSection } from "@/components/configuracion/conexiones-mcp-section"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { ConfirmButton } from "@/components/ui/confirm-button"
import { Pencil } from "lucide-react"

interface DelegacionWithCount extends Delegacion {
  movimientos?: number
}

interface UserMembresia {
  usuario_id: string
  rol: string
  delegacion: { id: string; nombre: string } | null
}

interface UserData {
  id: string
  email: string | undefined
  createdAt?: string
  membresias: UserMembresia[]
}

export function ConfigPage() {
  const { isAdmin, loading: adminLoading } = useIsAdminState()
  const [delegaciones, setDelegaciones] = useState<DelegacionWithCount[]>([])
  const [users, setUsers] = useState<UserData[]>([])
  const [editingDelegacion, setEditingDelegacion] = useState<DelegacionWithCount | null>(null)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [creatingUserOpen, setCreatingUserOpen] = useState(false)
  const [creatingDelegacionOpen, setCreatingDelegacionOpen] = useState(false)
  const [userForm, setUserForm] = useState({
    email: "",
    name: "",
    password: "",
    memberships: [] as { delegacion_id: string; rol: string }[],
  })

  // La pantalla de configuración no depende de la delegación seleccionada.
  // Evitamos forzar un cambio aquí para no crear bucles con el proveedor.

  // Helpers to load data
  const loadDelegaciones = async () => {
    const { data } = await (supabase as any).from("delegacion").select("id,codigo,nombre,organizacion_id")
    const withCounts: DelegacionWithCount[] = await Promise.all(
      (data || []).map(async (d: any) => {
        const { count } = await (supabase as any)
          .from("movimiento")
          .select("id", { count: "exact", head: true })
          .eq("delegacion_id", d.id)
        return { ...(d as Delegacion), movimientos: count || 0 }
      })
    )
    const sorted = [...withCounts].sort((a, b) =>
      (a?.nombre || "").localeCompare(b?.nombre || "", "es", { sensitivity: "base" }),
    )
    setDelegaciones(sorted)
  }

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users")
      const text = await res.text()
      // Try to parse JSON if content looks like JSON
      const json = text ? JSON.parse(text) : { users: [] }
      if (!res.ok) {
        console.error("/api/admin/users error:", json?.error || text)
        setUsers([])
        return
      }
      const users = Array.isArray(json.users) ? json.users : []
      const normalizedUsers: UserData[] = users.map((user: any) => ({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt ?? user.created_at,
        membresias: Array.isArray(user.membresias) ? user.membresias : [],
      }))
      const sortedUsers = [...normalizedUsers].sort((a, b) => {
        const aDate = new Date(a.createdAt ?? 0).getTime()
        const bDate = new Date(b.createdAt ?? 0).getTime()
        return bDate - aDate
      })
      setUsers(sortedUsers)
    } catch (err) {
      console.error("Error cargando usuarios:", err)
      setUsers([])
    }
  }

  // Carga inicial de datos de administración. El setState ocurre tras await
  // (no en cascada); la regla del compiler marca este patrón "fetch al montar"
  // de forma conservadora.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isAdmin) {
      loadDelegaciones()
      loadUsers()
    }
  }, [isAdmin])
  /* eslint-enable react-hooks/set-state-in-effect */

  const roles = useMemo(
    () => [
      { value: "gestor_central", label: "Gestor Central" },
      { value: "tesorero", label: "Tesorería" },
      { value: "solo_lectura", label: "Solo Lectura" },
    ],
    [],
  )

  // Mientras se comprueba el rol no se sabe nada todavía: decir "Acceso
  // restringido" ahí le dice a un gestor central que no tiene permiso justo
  // antes de dejarle pasar (que es lo que se veía al entrar en /configuracion).
  if (adminLoading) {
    return <PageSkeleton />
  }

  if (!isAdmin) {
    return <p className="text-center text-muted-foreground">Acceso restringido</p>
  }

  return (
    <div className="space-y-10">
      <PlantillaMemoriaSection />
      <EnableBankingHealthSection />
      <ConexionesMcpSection />

      {/* Delegaciones Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Delegaciones</h2>
          <Button size="sm" onClick={() => setCreatingDelegacionOpen(true)}>Nueva delegación</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Código</TableHead>
              {/* Oculto en móvil: un UUID completo no cabe junto al resto de
                  columnas y es el dato menos útil de la fila para uso diario;
                  sigue disponible en desktop. */}
              <TableHead className="hidden md:table-cell">UUID</TableHead>
              <TableHead>Movimientos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {delegaciones.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.nombre}</TableCell>
                <TableCell>{d.codigo || "-"}</TableCell>
                <TableCell className="hidden md:table-cell font-mono text-xs">{d.id}</TableCell>
                <TableCell>{d.movimientos || 0}</TableCell>
                <TableCell className="text-right">
                  {/* En móvil solo el icono: con el texto, la columna de
                      acciones no cabía en la vista inicial de la tabla y no
                      había ninguna pista de que hubiera que desplazarla. */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingDelegacion(d)}
                    aria-label={`Editar ${d.nombre}`}
                    className="px-2 sm:px-3"
                  >
                    <Pencil className="h-4 w-4 sm:hidden" aria-hidden />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* Usuarios Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Usuarios</h2>
          <Button size="sm" onClick={() => {
            setCreatingUserOpen(true)
            setUserForm({ email: "", name: "", password: "", memberships: [] })
          }}>
            Nuevo usuario
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mail</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Delegaciones</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const uniqueRoles = new Set(u.membresias.map((m) => m.rol))
              const baseRole = uniqueRoles.size === 1 ? (u.membresias[0]?.rol || "-") : "múltiples"
              const roleLabel =
                uniqueRoles.size === 1
                  ? roles.find((r) => r.value === baseRole)?.label || baseRole
                  : "múltiples"
              const delegs = u.membresias.map((m) => m.delegacion?.nombre).filter(Boolean).join(", ")
              return (
                <TableRow key={u.id}>
                  <TableCell className="max-w-[140px] truncate sm:max-w-none" title={u.email}>{u.email}</TableCell>
                  <TableCell>{roleLabel}</TableCell>
                  {/* max-w + truncate, no un string sin límite: con varias
                      delegaciones la lista de nombres se volvía tan larga que
                      forzaba scroll horizontal en móvil. title conserva la
                      lista completa al mantener pulsado/hacer hover. */}
                  <TableCell className="hidden sm:table-cell max-w-[160px] truncate" title={delegs}>{delegs}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingUser(u)
                        setUserForm({
                          email: u.email || "",
                          name: "",
                          password: "",
                          memberships: u.membresias
                            .filter((m) => !!m.delegacion?.id)
                            .map((m) => ({
                              delegacion_id: m.delegacion!.id,
                              rol: m.rol || "tesorero",
                            })),
                        })
                      }}
                      aria-label={`Editar ${u.email ?? "usuario"}`}
                      className="px-2 sm:px-3"
                    >
                      <Pencil className="h-4 w-4 sm:hidden" aria-hidden />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                    {/* Borrar un usuario era un solo clic, sin confirmación —
                        en móvil, a un dedo de distancia del botón de editar. */}
                    <ConfirmButton
                      variant="destructive"
                      label="Eliminar"
                      busyLabel="Eliminando…"
                      className="px-2 sm:px-3"
                      onConfirm={async () => {
                        const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" })
                        if (!res.ok) {
                          toast.error("No se ha podido eliminar el usuario")
                          return
                        }
                        setUsers((prev) => prev.filter((x) => x.id !== u.id))
                        toast.success("Usuario eliminado")
                      }}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </section>

      {/* Delegacion Edit Sheet */}
      <Sheet open={!!editingDelegacion} onOpenChange={() => setEditingDelegacion(null)}>
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar delegación</SheetTitle>
          </SheetHeader>
          {editingDelegacion && (
            <form
              className="space-y-4 py-4"
              onSubmit={async (e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const nombre = formData.get("nombre") as string
                const codigo = formData.get("codigo") as string
                await (supabase as any)
                  .from("delegacion")
                  .update({ nombre, codigo })
                  .eq("id", editingDelegacion.id)
                setDelegaciones((prev) =>
                  prev.map((d) =>
                    d.id === editingDelegacion.id ? { ...d, nombre, codigo } : d
                  )
                )
                setEditingDelegacion(null)
              }}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">UUID</label>
                <Input value={editingDelegacion.id} disabled className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input name="nombre" defaultValue={editingDelegacion.nombre} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Código</label>
                <Input name="codigo" defaultValue={editingDelegacion.codigo || ""} />
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit">Guardar</Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Delegacion Create Sheet */}
      <Sheet open={creatingDelegacionOpen} onOpenChange={setCreatingDelegacionOpen}>
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nueva delegación</SheetTitle>
          </SheetHeader>
          <form
            className="space-y-4 py-4"
            onSubmit={async (e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const nombre = formData.get("nombre") as string
              const codigo = (formData.get("codigo") as string) || null
              const orgId = delegaciones[0]?.organizacion_id
              if (!orgId) {
                alert("No se puede crear: falta organizacion_id")
                return
              }
              const { error } = await (supabase as any)
                .from("delegacion")
                .insert({ nombre, codigo, organizacion_id: orgId } as any)
              if (error) {
                alert(error.message)
                return
              }
              await loadDelegaciones()
              setCreatingDelegacionOpen(false)
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input name="nombre" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Código</label>
              <Input name="codigo" />
            </div>
            <div className="pt-4 flex justify-end">
              <Button type="submit">Crear</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* User Edit Sheet */}
      <Sheet open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar usuario</SheetTitle>
          </SheetHeader>
          {editingUser && (
            <form
              className="space-y-4 py-4"
              onSubmit={async (e) => {
                e.preventDefault()
                await fetch(`/api/admin/users/${editingUser.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    password: userForm.password || undefined,
                    name: userForm.name || undefined,
                    memberships: userForm.memberships,
                  }),
                })
                  .then(async (res) => {
                    const text = await res.text()
                    const json = text ? JSON.parse(text) : {}
                    if (!res.ok) {
                      console.error('PUT /api/admin/users/:id error:', json?.error || text)
                      toast.error(json?.error || 'No se pudo guardar el usuario')
                      return
                    }
                    toast.success('Usuario actualizado')
                    await loadUsers()
                    setEditingUser(null)
                  })
              }}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">Mail</label>
                <Input value={editingUser.email} disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input
                  value={userForm.name}
                  onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre completo"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contraseña (opcional)</label>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Delegaciones</label>
                <div className="max-h-64 overflow-y-auto space-y-3 p-3 border rounded-md">
                  {delegaciones.map((d) => {
                    const current = userForm.memberships.find((m) => m.delegacion_id === d.id)
                    const checked = !!current
                    return (
                      <div key={d.id} className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setUserForm((f) => {
                                const exists = f.memberships.find((m) => m.delegacion_id === d.id)
                                if (e.target.checked) {
                                  if (!exists) {
                                    return {
                                      ...f,
                                      memberships: [
                                        ...f.memberships,
                                        { delegacion_id: d.id, rol: "tesorero" },
                                      ],
                                    }
                                  }
                                  return f
                                }
                                return {
                                  ...f,
                                  memberships: f.memberships.filter((m) => m.delegacion_id !== d.id),
                                }
                              })
                            }}
                          />
                          <span>{d.nombre}</span>
                        </label>
                        {checked && (
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            value={current?.rol || "tesorero"}
                            onChange={(e) => {
                              const value = e.target.value
                              setUserForm((f) => ({
                                ...f,
                                memberships: f.memberships.map((m) => (m.delegacion_id === d.id ? { ...m, rol: value } : m)),
                              }))
                            }}
                          >
                            {roles.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit">Guardar</Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* User Create Sheet */}
      <Sheet open={creatingUserOpen} onOpenChange={setCreatingUserOpen}>
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nuevo usuario</SheetTitle>
          </SheetHeader>
          <form
            className="space-y-4 py-4"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!userForm.email || !userForm.password) return
              await fetch(`/api/admin/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: userForm.email,
                  password: userForm.password,
                  name: userForm.name || undefined,
                  memberships: userForm.memberships,
                }),
              })
                .then(async (res) => {
                  const text = await res.text()
                  const json = text ? JSON.parse(text) : {}
                  if (!res.ok) {
                    console.error('POST /api/admin/users error:', json?.error || text)
                    toast.error(json?.error || 'No se pudo crear el usuario')
                    return
                  }
                  toast.success('Usuario creado')
                  await loadUsers()
                  setCreatingUserOpen(false)
                  setUserForm({ email: "", name: "", password: "", memberships: [] })
                })
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Mail</label>
              <Input
                value={userForm.email}
                onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                type="email"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={userForm.name}
                onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nombre completo"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contraseña</label>
              <Input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Delegaciones</label>
              <div className="max-h-64 overflow-y-auto space-y-3 p-3 border rounded-md">
                {delegaciones.map((d) => {
                  const current = userForm.memberships.find((m) => m.delegacion_id === d.id)
                  const checked = !!current
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setUserForm((f) => {
                              const exists = f.memberships.find((m) => m.delegacion_id === d.id)
                              if (e.target.checked) {
                                if (!exists) {
                                  return {
                                    ...f,
                                    memberships: [
                                      ...f.memberships,
                                      { delegacion_id: d.id, rol: "tesorero" },
                                    ],
                                  }
                                }
                                return f
                              }
                              return {
                                ...f,
                                memberships: f.memberships.filter((m) => m.delegacion_id !== d.id),
                              }
                            })
                          }}
                        />
                        <span>{d.nombre}</span>
                      </label>
                      {checked && (
                        <select
                          className="border rounded px-2 py-1 text-sm"
                          value={current?.rol || "tesorero"}
                          onChange={(e) => {
                            const value = e.target.value
                            setUserForm((f) => ({
                              ...f,
                              memberships: f.memberships.map((m) => (m.delegacion_id === d.id ? { ...m, rol: value } : m)),
                            }))
                          }}
                        >
                          {roles.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="pt-4 flex justify-end">
              <Button type="submit">Crear</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
