'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useUser } from '@/hooks/useUser'
import { getProducts, upsertProduct, deleteProduct, getSiteConfig, upsertSiteConfig } from '@/lib/supabase/queries'
import { saveErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { SaveButton } from '@/components/admin/SaveButton'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { LimitedField } from '@/components/admin/LimitedField'
import { NativeSelect } from '@/components/admin/NativeSelect'
import { CONTRACT } from '@/lib/contract/contract.generated'
import { isOverMaxItems } from '@/lib/contract/limits'
import { makeSlug } from '@/lib/slug'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionIssues } from '@/components/admin/SectionIssues'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Product } from '@/types/database'

const EMPTY_FORM = { name: '', description: '', price: '', category: '', order: 0, image_url: '' }
const EMPTY_CATALOG = { currency: 'ARS', show_prices: true, group_by_category: false, product_cta_label: '' }
const L = CONTRACT.limits
// El contrato no admite decimales en estas monedas (lo dice en la descripción del precio).
const NO_DECIMALS = ['CLP', 'COP']

export default function CatalogoPage() {
  const { siteId } = useUser()
  const [items, setItems] = useState<Product[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  // Parte de la ruta de la foto: distinta para cada producto, para que una foto no pise a otra.
  const [photoKey, setPhotoKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [catalog, setCatalog] = useState(EMPTY_CATALOG)
  const [savedCatalog, setSavedCatalog] = useState(false)
  const [isPendingCatalog, startCatalogTransition] = useTransition()

  // Pedir los datos y aplicarlos van separados: el estado se guarda dentro de un .then, no dentro del efecto.
  const fetchData = useCallback(async () => {
    if (!siteId) return null
    const [data, config] = await Promise.all([getProducts(siteId), getSiteConfig(siteId)])
    return { data, config }
  }, [siteId])

  const apply = useCallback((loaded: Awaited<ReturnType<typeof fetchData>>) => {
    if (!loaded) return
    setItems(loaded.data)
    if (loaded.config) {
      const c = loaded.config
      setCatalog({ currency: c.currency, show_prices: c.show_prices, group_by_category: c.group_by_category, product_cta_label: c.product_cta_label ?? '' })
    }
  }, [])

  const load = useCallback(() => fetchData().then(apply), [fetchData, apply])

  useEffect(() => {
    fetchData().then(apply)
  }, [fetchData, apply])

  const categories = ['all', ...Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[]))]
  const filtered = filter === 'all' ? items : items.filter((i) => i.category === filter)

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setPhotoKey(crypto.randomUUID())
    setDialogOpen(true)
  }

  function openEdit(item: Product) {
    setEditing(item)
    setPhotoKey(item.id)
    setForm({
      name: item.name ?? '',
      description: item.description ?? '',
      price: item.price != null ? String(item.price) : '',
      category: item.category ?? '',
      order: item.order ?? 0,
      image_url: item.image_url ?? '',
    })
    setDialogOpen(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!siteId) return
    startTransition(async () => {
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        name: form.name,
        description: form.description,
        price: form.price ? parseFloat(form.price) : null,
        category: form.category || null,
        order: form.order,
        image_url: form.image_url || null,
        // El identificador se crea una sola vez y no cambia al renombrar (RF-5).
        ...(editing ? {} : { slug: makeSlug(form.name, items.flatMap((i) => (i.slug ? [i.slug] : []))) }),
      }
      const { error } = await upsertProduct(siteId, payload)
      if (error) { toast.error(saveErrorMessage(error)); return }
      toast.success(editing ? 'Producto actualizado' : 'Producto agregado')
      setDialogOpen(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      load()
    })
  }

  function handleSaveCatalog(e: React.FormEvent) {
    e.preventDefault()
    if (!siteId) return
    startCatalogTransition(async () => {
      const { error } = await upsertSiteConfig(siteId, { ...catalog, product_cta_label: catalog.product_cta_label.trim() ? catalog.product_cta_label : null })
      if (error) { toast.error(saveErrorMessage(error)); return }
      setSavedCatalog(true)
      toast.success('Ajustes del catálogo guardados')
      setTimeout(() => setSavedCatalog(false), 2500)
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const { error } = await deleteProduct(id)
      if (error) { toast.error('Error al eliminar.'); return }
      toast.success('Producto eliminado')
      setConfirmId(null)
      load()
    })
  }

  async function handleToggle(item: Product) {
    if (!siteId) return
    const { error } = await upsertProduct(siteId, { id: item.id, active: !item.active })
    if (error) { toast.error(saveErrorMessage(error)); return }
    load()
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Catálogo</h1>
          <p className="mt-1 text-sm text-zinc-500">Tus productos o servicios con foto y precio.</p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5">
          <Plus size={15} /> Agregar
        </Button>
      </div>

      <SectionIssues section="catalogo" refreshKey={saved || savedCatalog} />

      <form onSubmit={handleSaveCatalog}>
        <Card>
          <CardHeader><CardTitle className="text-base">Ajustes del catálogo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cat-currency">Moneda</Label>
                <NativeSelect id="cat-currency" value={catalog.currency} onChange={(e) => setCatalog((c) => ({ ...c, currency: e.target.value }))}>
                  {CONTRACT.currencies.map((code) => <option key={code} value={code}>{code}</option>)}
                </NativeSelect>
                {NO_DECIMALS.includes(catalog.currency) && <p className="text-xs text-zinc-500">En {catalog.currency} los precios van sin decimales.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-cta">Texto del botón de consulta (opcional)</Label>
                <LimitedField id="cat-cta" value={catalog.product_cta_label} onChange={(v) => setCatalog((c) => ({ ...c, product_cta_label: v }))} limit={L['productGridConfig.ctaLabel']} placeholder="Consultar por WhatsApp" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="cat-show-prices">Mostrar precios en la web</Label>
              <Switch id="cat-show-prices" checked={catalog.show_prices} onCheckedChange={(v) => setCatalog((c) => ({ ...c, show_prices: v }))} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="cat-group">Agrupar los productos por categoría</Label>
              <Switch id="cat-group" checked={catalog.group_by_category} onCheckedChange={(v) => setCatalog((c) => ({ ...c, group_by_category: v }))} />
            </div>
            <SaveButton isPending={isPendingCatalog} saved={savedCatalog} />
          </CardContent>
        </Card>
      </form>

      {isOverMaxItems(items.length, CONTRACT.maxItems.products) && (
        <p className="text-sm text-destructive">Máximo {CONTRACT.maxItems.products} productos: se guardan igual, pero hay que dejar {CONTRACT.maxItems.products} para publicar.</p>
      )}

      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === cat ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {cat === 'all' ? 'Todos' : cat}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400">
          {items.length === 0 ? 'El catálogo está vacío. ¡Agregá el primer producto!' : 'No hay productos en esta categoría.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`relative flex gap-3 rounded-xl border p-3 transition-opacity ${
                item.active ? 'border-zinc-200 bg-white' : 'border-zinc-100 bg-zinc-50 opacity-60'
              }`}
            >
              {item.image_url ? (
                <img src={item.image_url} alt={item.name ?? ''} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-16 w-16 shrink-0 rounded-lg bg-zinc-100" />
              )}
              <div className="flex-1 min-w-0 pb-7">
                <div className="flex items-start justify-between gap-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                  {item.category && <Badge variant="secondary" className="shrink-0 text-xs">{item.category}</Badge>}
                </div>
                {item.description && <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{item.description}</p>}
                {item.price != null && <p className="mt-1 text-xs font-medium text-zinc-700">{item.price.toLocaleString('es-AR', { style: 'currency', currency: catalog.currency })}</p>}
              </div>
              <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
                <Switch checked={item.active ?? false} onCheckedChange={() => handleToggle(item)} aria-label="Activo" />
                <button onClick={() => openEdit(item)} className="text-zinc-400 hover:text-zinc-700"><Pencil size={14} /></button>
                <button onClick={() => setConfirmId(item.id)} className="text-zinc-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Foto del producto</Label>
              <ImageUpload
                bucket="images"
                path={`${siteId}/catalogo/${photoKey}`}
                currentUrl={form.image_url || null}
                onUpload={(url) => setForm((f) => ({ ...f, image_url: url }))}
                label="Subir foto"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-name">Nombre</Label>
              <LimitedField id="prod-name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} limit={L['products[].name']} placeholder="Ej: Torta de chocolate" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-desc">Descripción</Label>
              <LimitedField id="prod-desc" multiline rows={2} value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} limit={L['products[].description']} placeholder="Descripción breve..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prod-price">Precio{catalog.show_prices ? ' (obligatorio para publicar)' : ' (opcional)'}</Label>
                <Input id="prod-price" type="number" min={0} step={NO_DECIMALS.includes(catalog.currency) ? '1' : '0.01'} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-cat">Categoría</Label>
                <LimitedField id="prod-cat" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} limit={L['products[].category']} placeholder="Ej: Postres" />
                {catalog.group_by_category && !form.category && <p className="text-xs text-destructive">Obligatoria para publicar: el catálogo agrupa por categoría.</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-order">Orden</Label>
              <Input id="prod-order" type="number" min={0} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className="w-24" />
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
          <DialogHeader><DialogTitle>¿Eliminar producto?</DialogTitle></DialogHeader>
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
