"use client"

import { useEffect, useState } from "react"
import { useDelegationContext } from "@/contexts/delegation-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { supabase } from "@/lib/supabase/client"
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
}

export function ConfigPage() {
  const { setSelectedDelegation } = useDelegationContext()
  const isAdmin = useIsAdmin()
  const [delegaciones, setDelegaciones] = useState<DelegacionWithCount[]>([])
  const [users, setUsers] = useState<UserData[]>([])
  const [editingDelegacion, setEditingDelegacion] = useState<DelegacionWithCount | null>(null)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [userForm, setUserForm] = useState({ role: "", password: "", delegaciones: [] as string[] })

  useEffect(() => {
    setSelectedDelegation(null)
  }, [setSelectedDelegation])

  useEffect(() => {
    const fetchDelegaciones = async () => {
      const { data } = await supabase.from("delegacion").select("id,codigo,nombre")
      const withCounts: DelegacionWithCount[] = await Promise.all(
        (data || []).map(async (d) => {
          const { count } = await supabase
            .from("movimiento")
            .select("id", { count: "exact", head: true })
            .eq("delegacion_id", d.id)
          return { ...d, movimientos: count || 0 }
        })
      )
      setDelegaciones(withCounts)
    }
    const fetchUsers = async () => {
      const res = await fetch("/api/admin/users")
      const json = await res.json()
      setUsers(json.users || [])
    }
    if (isAdmin) {
      fetchDelegaciones()
      fetchUsers()
    }
  }, [isAdmin])

  if (!isAdmin) {
    return <p className="text-center text-muted-foreground">Acceso restringido</p>
  }

  return (
    <div className="space-y-10">
      {/* Delegaciones Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Delegaciones</h2>
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
        <h2 className="text-xl font-semibold mb-4">Usuarios</h2>
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
              const role = u.membresias[0]?.rol || "-"
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
                          role: role,
                          password: "",
                          delegaciones: u.membresias.map((m) => m.delegacion?.id || ""),
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
                  body: JSON.stringify(userForm),
                })
                setUsers((prev) =>
                  prev.map((u) =>
                    u.id === editingUser.id
                      ? {
                          ...u,
                          membresias: userForm.delegaciones.map((d) => ({
                            usuario_id: editingUser.id,
                            rol: userForm.role,
                            delegacion: delegaciones.find((del) => del.id === d) || null,
                          })),
                        }
                      : u
                  )
                )
                setEditingUser(null)
              }}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input value={editingUser.email} disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rol</label>
                <Input
                  value={userForm.role}
                  onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="admin | usuario"
                  required
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
                <div className="max-h-40 overflow-y-auto space-y-1 p-2 border rounded-md">
                  {delegaciones.map((d) => (
                    <label key={d.id} className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={userForm.delegaciones.includes(d.id)}
                        onChange={(e) => {
                          setUserForm((f) => {
                            const set = new Set(f.delegaciones)
                            if (e.target.checked) set.add(d.id)
                            else set.delete(d.id)
                            return { ...f, delegaciones: Array.from(set) }
                          })
                        }}
                      />
                      <span>{d.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit">Guardar</Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
