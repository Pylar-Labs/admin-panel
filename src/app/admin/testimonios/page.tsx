'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useUser } from '@/hooks/useUser'
import { getTestimonials, upsertTestimonial, deleteTestimonial } from '@/lib/supabase/queries'
import { saveErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { SaveButton } from '@/components/admin/SaveButton'
import { LimitedField } from '@/components/admin/LimitedField'
import { SectionIssues } from '@/components/admin/SectionIssues'
import { CONTRACT } from '@/lib/contract/contract.generated'
import { isOverMaxItems } from '@/lib/contract/limits'
import { Plus, Pencil, Trash2, Star } from 'lucide-react'
import type { Testimonial } from '@/types/database'

const EMPTY_FORM = { author_name: '', role: '', text: '', rating: 5, order: 0 }
const L = CONTRACT.limits

export default function TestimoniosPage() {
  const { siteId } = useUser()
  const [items, setItems] = useState<Testimonial[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Testimonial | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Pedir los datos y aplicarlos van separados: el estado se guarda dentro de un .then, no dentro del efecto.
  const fetchData = useCallback(async () => {
    if (!siteId) return null
    const data = await getTestimonials(siteId)
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

  function openEdit(item: Testimonial) {
    setEditing(item)
    setForm({ author_name: item.author_name ?? '', role: item.role ?? '', text: item.text ?? '', rating: item.rating ?? 5, order: item.order ?? 0 })
    setDialogOpen(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!siteId) return
    startTransition(async () => {
      const values = { ...form, role: form.role.trim() ? form.role : null }
      const payload = editing ? { id: editing.id, ...values } : values
      const { error } = await upsertTestimonial(siteId, payload)
      if (error) { toast.error(saveErrorMessage(error)); return }
      toast.success(editing ? 'Testimonio actualizado' : 'Testimonio agregado')
      setDialogOpen(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      load()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const { error } = await deleteTestimonial(id)
      if (error) { toast.error('Error al eliminar.'); return }
      toast.success('Testimonio eliminado')
      setConfirmId(null)
      load()
    })
  }

  async function handleToggle(item: Testimonial) {
    if (!siteId) return
    const { error } = await upsertTestimonial(siteId, { id: item.id, active: !item.active })
    if (error) { toast.error(saveErrorMessage(error)); return }
    load()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Testimonios</h1>
          <p className="mt-1 text-sm text-zinc-500">Lo que dicen tus clientes.</p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5">
          <Plus size={15} /> Agregar
        </Button>
      </div>

      <SectionIssues section="testimonios" refreshKey={saved} />

      {isOverMaxItems(items.length, CONTRACT.maxItems.testimonials) && (
        <p className="text-sm text-destructive">Máximo {CONTRACT.maxItems.testimonials} testimonios: se guardan igual, pero hay que dejar {CONTRACT.maxItems.testimonials} para publicar.</p>
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400">
          Todavía no hay testimonios. ¡Agregá el primero!
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-zinc-900 truncate">{item.author_name}</p>
                    <div className="flex">
                      {Array.from({ length: item.rating ?? 5 }).map((_, i) => (
                        <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{item.text}</p>
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
            <DialogTitle>{editing ? 'Editar testimonio' : 'Nuevo testimonio'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="author_name">Nombre del cliente</Label>
              <LimitedField id="author_name" value={form.author_name} onChange={(v) => setForm((f) => ({ ...f, author_name: v }))} limit={L['testimonials[].name']} placeholder="María García" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rol o relación con el negocio (opcional)</Label>
              <LimitedField id="role" value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} limit={L['testimonials[].role']} placeholder="Ej: Clienta desde 2020" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text">Comentario</Label>
              <LimitedField id="text" multiline value={form.text} onChange={(v) => setForm((f) => ({ ...f, text: v }))} limit={L['testimonials[].text']} placeholder="Excelente servicio..." required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rating">Estrellas (1-5)</Label>
                <Input id="rating" type="number" min={1} max={5} value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order">Orden</Label>
                <Input id="order" type="number" min={0} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
              </div>
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
          <DialogHeader>
            <DialogTitle>¿Eliminar testimonio?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-500">Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={isPending} onClick={() => confirmId && handleDelete(confirmId)}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
