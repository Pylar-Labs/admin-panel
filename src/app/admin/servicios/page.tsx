'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useUser } from '@/hooks/useUser'
import { getServices, upsertService, deleteService } from '@/lib/supabase/queries'
import { saveErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { SaveButton } from '@/components/admin/SaveButton'
import { LimitedField } from '@/components/admin/LimitedField'
import { NativeSelect } from '@/components/admin/NativeSelect'
import { SectionIssues } from '@/components/admin/SectionIssues'
import { CONTRACT } from '@/lib/contract/contract.generated'
import { isOverMaxItems } from '@/lib/contract/limits'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Service } from '@/types/database'

const EMPTY_FORM = { title: '', description: '', order: 0, icon: '' }
const L = CONTRACT.limits

export default function ServiciosPage() {
  const { siteId } = useUser()
  const [items, setItems] = useState<Service[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Pedir los datos y aplicarlos van separados: el estado se guarda dentro de un .then, no dentro del efecto.
  const fetchData = useCallback(async () => {
    if (!siteId) return null
    const data = await getServices(siteId)
    return { data }
  }, [siteId])

  const apply = useCallback((loaded: Awaited<ReturnType<typeof fetchData>>) => {
    if (!loaded) return
    setItems(loaded.data)
  }, [])

  const load = useCallback(() => fetchData().then(apply), [fetchData, apply])

  useEffect(() => {
    fetchData().then(apply)
  }, [fetchData, apply])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(item: Service) {
    setEditing(item)
    setForm({
      title: item.title ?? '',
      description: item.description ?? '',
      order: item.order ?? 0,
      icon: item.icon ?? '',
    })
    setDialogOpen(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!siteId) return
    startTransition(async () => {
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        title: form.title,
        description: form.description,
        order: form.order,
        icon: form.icon || null, // un valor fuera de la lista se conserva tal cual hasta que el cliente elija otro
      }
      const { error } = await upsertService(siteId, payload)
      if (error) { toast.error(saveErrorMessage(error)); return }
      toast.success(editing ? 'Servicio actualizado' : 'Servicio agregado')
      setDialogOpen(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      load()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const { error } = await deleteService(id)
      if (error) { toast.error('Error al eliminar.'); return }
      toast.success('Servicio eliminado')
      setConfirmId(null)
      load()
    })
  }

  async function handleToggle(item: Service) {
    if (!siteId) return
    const { error } = await upsertService(siteId, { id: item.id, active: !item.active })
    if (error) { toast.error(saveErrorMessage(error)); return }
    load()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Servicios</h1>
          <p className="mt-1 text-sm text-zinc-500">Lo que ofrecés a tus clientes.</p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5">
          <Plus size={15} /> Agregar
        </Button>
      </div>

      <SectionIssues section="servicios" refreshKey={saved} />

      {isOverMaxItems(items.length, CONTRACT.maxItems.services) && (
        <p className="text-sm text-destructive">Máximo {CONTRACT.maxItems.services} servicios: se guardan igual, pero hay que dejar {CONTRACT.maxItems.services} para publicar.</p>
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400">
          Todavía no hay servicios. ¡Agregá el primero!
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-zinc-900 truncate">{item.title}</p>
                  {item.description && (
                    <p className="mt-0.5 text-sm text-zinc-500 line-clamp-1">{item.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch checked={item.active ?? false} onCheckedChange={() => handleToggle(item)} aria-label="Activo" />
                  <button onClick={() => openEdit(item)} className="text-zinc-400 hover:text-zinc-700">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setConfirmId(item.id)} className="text-zinc-400 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="title">Nombre del servicio</Label>
              <LimitedField id="title" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} limit={L['services[].title']} placeholder="Ej: Corte de cabello" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descripción</Label>
              <LimitedField id="desc" multiline rows={2} value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} limit={L['services[].description']} placeholder="Breve descripción del servicio..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-icon">Ícono</Label>
              <NativeSelect id="svc-icon" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}>
                <option value="">Pendiente de elegir…</option>
                {form.icon && !(CONTRACT.icons as readonly string[]).includes(form.icon) && (
                  <option value={form.icon}>{form.icon} (no está en la lista: elegí otro)</option>
                )}
                {CONTRACT.icons.map((name) => <option key={name} value={name}>{name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-order">Orden</Label>
              <Input id="svc-order" type="number" min={0} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className="w-24" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <SaveButton isPending={isPending} saved={saved} label={editing ? 'Guardar cambios' : 'Agregar'} />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmId} onOpenChange={() => setConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>¿Eliminar servicio?</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-500">Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={isPending} onClick={() => confirmId && handleDelete(confirmId)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
