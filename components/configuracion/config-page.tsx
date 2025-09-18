"use client"

import { useEffect, useMemo, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { Delegacion } from "@/lib/types/database"
import { useIsAdmin } from "@/hooks/use-is-admin"

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
  membresias: UserMembresia[]
  createdAt?: string
}

export function ConfigPage() {
  const isAdmin = useIsAdmin()
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
    const { data } = await supabase.from("delegacion").select("id,codigo,nombre,organizacion_id")
    const withCounts: DelegacionWithCount[] = await Promise.all(
      (data || []).map(async (d) => {
        const { count } = await supabase
          .from("movimiento")
          .select("id", { count: "exact", head: true })
          .eq("delegacion_id", d.id)
        return { ...(d as Delegacion), movimientos: count || 0 }
      })
    )
    withCounts.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "accent" }))
    setDelegaciones(withCounts)
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
      const users = [...((json.users || []) as UserData[])].map((user) => ({
        ...user,
        createdAt: user.createdAt ?? (user as any).created_at,
      }))
      users.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bTime - aTime
      })
      setUsers(users)
    } catch (err) {
      console.error("Error cargando usuarios:", err)
      setUsers([])
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadDelegaciones()
      loadUsers()
    }
  }, [isAdmin])

  const roles = useMemo(() => [
    { value: "gestor_central", label: "Gestor Central" },
    { value: "tesorero", label: "Tesorería" },
    { value: "solo_lectura", label: "Solo Lectura" },
  ], [])

  if (!isAdmin) {
    return <p className="text-center text-muted-foreground">Acceso restringido</p>
  }

  return (
    <div className="space-y-10">
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
              <TableHead>UUID</TableHead>
              <TableHead>Movimientos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {delegaciones.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.nombre}</TableCell>
                <TableCell>{d.codigo || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{d.id}</TableCell>
                <TableCell>{d.movimientos || 0}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setEditingDelegacion(d)}>
                    Editar
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
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Delegaciones</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const uniqueRoles = new Set(u.membresias.map((m) => m.rol))
              const role = uniqueRoles.size === 1 ? (u.membresias[0]?.rol || "-") : "múltiples"
              const delegs = u.membresias.map((m) => m.delegacion?.nombre).filter(Boolean).join(", ")
              return (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{role}</TableCell>
                  <TableCell>{delegs}</TableCell>
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
                            .map((m) => ({ delegacion_id: m.delegacion!.id, rol: m.rol })),
                        })
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" })
                        setUsers((prev) => prev.filter((x) => x.id !== u.id))
                      }}
                    >
                      Eliminar
                    </Button>
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
                await supabase
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
              const { error } = await supabase
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
                <label className="text-sm font-medium">Email</label>
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
                                  if (!exists) return { ...f, memberships: [...f.memberships, { delegacion_id: d.id, rol: "tesorero" }] }
                                  return f
                                } else {
                                  return { ...f, memberships: f.memberships.filter((m) => m.delegacion_id !== d.id) }
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
              <label className="text-sm font-medium">Email</label>
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
                                if (!exists) return { ...f, memberships: [...f.memberships, { delegacion_id: d.id, rol: "tesorero" }] }
                                return f
                              } else {
                                return { ...f, memberships: f.memberships.filter((m) => m.delegacion_id !== d.id) }
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
