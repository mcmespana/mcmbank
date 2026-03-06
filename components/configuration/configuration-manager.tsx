"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import type { Delegacion } from "@/lib/types/database"

interface DelegacionWithCount extends Delegacion {
  movimientos: number
}

interface UserInfo {
  id: string
  email: string
  delegaciones: { id: string; nombre: string }[]
  rol: string | null
}

export function ConfigurationManager() {
  const [delegaciones, setDelegaciones] = useState<DelegacionWithCount[]>([])
  const [users, setUsers] = useState<UserInfo[]>([])
  const [editingDelegacion, setEditingDelegacion] = useState<DelegacionWithCount | null>(null)
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    fetchDelegaciones()
    fetchUsers()
  }, [])

  async function fetchDelegaciones() {
    const { data } = await (supabase as any).from("delegacion").select("*")
    const results: DelegacionWithCount[] = []
    if (data) {
      for (const d of data) {
        const { count } = await (supabase as any)
          .from("movimiento")
          .select("*", { count: "exact", head: true })
          .eq("delegacion_id", d.id)
        results.push({ ...d, movimientos: count ?? 0 })
      }
    }
    setDelegaciones(results)
  }

  async function fetchUsers() {
    const res = await fetch("/api/admin/users")
    if (!res.ok) return
    const json = await res.json()
    const baseUsers: UserInfo[] = json.users.map((u: any) => ({
      id: u.id,
      email: u.email,
      delegaciones: [],
      rol: null,
    }))
    const { data } = await (supabase as any)
      .from("membresia")
      .select("usuario_id, rol, delegacion:delegacion_id (id, nombre)")
    baseUsers.forEach((u) => {
      const memberships = (data || []).filter((m: any) => m.usuario_id === u.id)
      u.delegaciones = memberships.map((m: any) => m.delegacion).filter(Boolean)
      u.rol = memberships[0]?.rol || null
    })
    setUsers(baseUsers)
  }

  async function saveDelegacion(patch: { nombre: string; codigo: string | null }) {
    if (!editingDelegacion) return
    await (supabase as any).from("delegacion").update(patch).eq("id", editingDelegacion.id)
    await fetchDelegaciones()
    setEditingDelegacion(null)
  }

  async function saveUser(updated: UserInfo & { password?: string }) {
    if (updated.password) {
      await fetch(`/api/admin/users/${updated.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: updated.password }),
      })
    }
    const { data: current } = await (supabase as any)
      .from("membresia")
      .select("delegacion_id")
      .eq("usuario_id", updated.id)
    const currentIds = (current || []).map((m: any) => m.delegacion_id)
    const selectedIds = updated.delegaciones.map((d) => d.id)
    const toRemove = currentIds.filter((id: any) => !selectedIds.includes(id))
    const toAdd = selectedIds.filter((id) => !currentIds.includes(id))
    if (toRemove.length) {
      await (supabase as any).from("membresia").delete().in("delegacion_id", toRemove).eq("usuario_id", updated.id)
    }
    for (const id of toAdd) {
      await (supabase as any)
        .from("membresia")
        .insert({ usuario_id: updated.id, delegacion_id: id, rol: updated.rol || "solo_lectura" })
    }
    await (supabase as any)
      .from("membresia")
      .update({ rol: updated.rol || "solo_lectura" })
      .in("delegacion_id", selectedIds)
      .eq("usuario_id", updated.id)
    await fetchUsers()
    setEditingUser(null)
  }

  async function deleteUser(user: UserInfo) {
    await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" })
    await (supabase as any).from("membresia").delete().eq("usuario_id", user.id)
    await fetchUsers()
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-xl font-semibold mb-2">Delegaciones</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Movimientos</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {delegaciones.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.nombre}</TableCell>
                <TableCell>{d.codigo}</TableCell>
                <TableCell>{d.movimientos}</TableCell>
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

      <section>
        <h2 className="text-xl font-semibold mb-2">Usuarios</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Delegaciones</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.rol}</TableCell>
                <TableCell>{u.delegaciones.map((d) => d.nombre).join(", ") || "-"}</TableCell>
                <TableCell className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingUser(u)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteUser(u)}>
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <Sheet open={!!editingDelegacion} onOpenChange={(o) => !o && setEditingDelegacion(null)}>
        <SheetContent side="right" className="w-full sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Editar delegación</SheetTitle>
          </SheetHeader>
          {editingDelegacion && (
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget as HTMLFormElement)
                saveDelegacion({
                  nombre: formData.get("nombre") as string,
                  codigo: (formData.get("codigo") as string) || null,
                })
              }}
            >
              <Input name="nombre" defaultValue={editingDelegacion.nombre} placeholder="Nombre" />
              <Input name="codigo" defaultValue={editingDelegacion.codigo || ""} placeholder="Código" />
              <p className="text-xs text-muted-foreground">UUID: {editingDelegacion.id}</p>
              <Button type="submit">Guardar</Button>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <SheetContent side="right" className="w-full sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Editar usuario</SheetTitle>
          </SheetHeader>
          {editingUser && (
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget as HTMLFormElement)
                const password = (formData.get("password") as string) || undefined
                const role = formData.get("rol") as string
                const delegacionIds = formData.getAll("delegaciones") as string[]
                const delegacionesSeleccionadas = delegaciones.filter((d) =>
                  delegacionIds.includes(d.id),
                )
                saveUser({ ...editingUser, rol: role, delegaciones: delegacionesSeleccionadas, password })
              }}
            >
              <p className="text-sm">{editingUser.email}</p>
              <Select name="rol" defaultValue={editingUser.rol || "solo_lectura"}>
                <SelectTrigger>
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gestor_central">Gestor Central</SelectItem>
                  <SelectItem value="tesorero">Tesorero</SelectItem>
                  <SelectItem value="solo_lectura">Solo Lectura</SelectItem>
                </SelectContent>
              </Select>
              <Input type="password" name="password" placeholder="Nueva contraseña" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Delegaciones</p>
                {delegaciones.map((d) => (
                  <label key={d.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="delegaciones"
                      value={d.id}
                      defaultChecked={editingUser.delegaciones.some((dd) => dd.id === d.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{d.nombre}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar</Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
