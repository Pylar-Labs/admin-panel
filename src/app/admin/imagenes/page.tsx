'use client'

import { useState, useTransition, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useUser } from '@/hooks/useUser'
import { getSiteConfig, upsertSiteConfig, getGallery, addGalleryImage, deleteGalleryImage } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import { saveErrorMessage, triggerVercelDeploy } from '@/lib/utils'
import { SaveButton } from '@/components/admin/SaveButton'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { NotPublishedNotice } from '@/components/admin/NotPublishedNotice'
import { Upload, X } from 'lucide-react'
import type { GalleryImage } from '@/types/database'

export default function ImagenesPage() {
  const { siteId } = useUser()
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [heroUrl, setHeroUrl] = useState<string | null>(null)
  const [deployHook, setDeployHook] = useState<string | null>(null)
  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Pedir los datos y aplicarlos van separados: el estado se guarda dentro de un .then, no dentro del efecto.
  const fetchData = useCallback(async () => {
    if (!siteId) return null
    const [config, imgs] = await Promise.all([getSiteConfig(siteId), getGallery(siteId)])
    return { config, imgs }
  }, [siteId])

  const apply = useCallback((loaded: Awaited<ReturnType<typeof fetchData>>) => {
    if (!loaded) return
    setLogoUrl(loaded.config?.logo_url ?? null)
    setHeroUrl(loaded.config?.hero_image_url ?? null)
    setDeployHook(loaded.config?.vercel_deploy_hook ?? null)
    setGallery(loaded.imgs)
  }, [])

  const load = useCallback(() => fetchData().then(apply), [fetchData, apply])

  useEffect(() => {
    fetchData().then(apply)
  }, [fetchData, apply])

  function handleSaveMain(e: React.FormEvent) {
    e.preventDefault()
    if (!siteId) return
    startTransition(async () => {
      const { error } = await upsertSiteConfig(siteId, { logo_url: logoUrl, hero_image_url: heroUrl })
      if (error) { toast.error(saveErrorMessage(error)); return }
      await triggerVercelDeploy(deployHook)
      setSaved(true)
      toast.success('Imágenes guardadas')
      setTimeout(() => setSaved(false), 2500)
    })
  }

  async function handleGalleryUpload(files: FileList) {
    if (!siteId || files.length === 0) return
    setUploading(true)
    const supabase = createClient()
    const results = await Promise.all(
      Array.from(files).map(async (file) => {
        const path = `${siteId}/gallery/${Date.now()}-${file.name}`
        const { error: upErr } = await supabase.storage.from('images').upload(path, file, { upsert: true })
        if (upErr) return null
        const { data } = supabase.storage.from('images').getPublicUrl(path)
        return `${data.publicUrl}?t=${Date.now()}`
      })
    )
    const urls = results.filter(Boolean) as string[]
    if (urls.length > 0) {
      const added = await Promise.all(urls.map((url) => addGalleryImage(siteId, url)))
      const failed = added.find((r) => r.error)
      if (failed) {
        toast.error(saveErrorMessage(failed.error))
      } else {
        await triggerVercelDeploy(deployHook)
        toast.success(`${urls.length} imagen${urls.length > 1 ? 'es' : ''} agregada${urls.length > 1 ? 's' : ''}`)
      }
      load()
    }
    if (urls.length < files.length) toast.error('Algunas imágenes no se pudieron subir.')
    setUploading(false)
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const { error } = await deleteGalleryImage(id)
      if (error) { toast.error('Error al eliminar.'); return }
      await triggerVercelDeploy(deployHook)
      toast.success('Imagen eliminada')
      setConfirmId(null)
      load()
    })
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Imágenes</h1>
        <p className="mt-1 text-sm text-zinc-500">Logo, imagen principal y galería de fotos.</p>
      </div>

      <form onSubmit={handleSaveMain} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Logo</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <NotPublishedNotice />
            <ImageUpload bucket="images" path={`${siteId}/logo`} currentUrl={logoUrl} onUpload={(url) => setLogoUrl(url || null)} label="Subir logo" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Imagen principal (hero)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <NotPublishedNotice />
            <ImageUpload bucket="images" path={`${siteId}/hero`} currentUrl={heroUrl} onUpload={(url) => setHeroUrl(url || null)} label="Subir imagen principal" />
          </CardContent>
        </Card>

        <SaveButton isPending={isPending} saved={saved} />
      </form>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-zinc-900">Galería de fotos</h2>
            <p className="text-sm text-zinc-500">Podés subir varias imágenes a la vez.</p>
            <NotPublishedNotice />
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={uploading} onClick={() => galleryInputRef.current?.click()}>
            <Upload size={14} />
            {uploading ? 'Subiendo...' : 'Subir fotos'}
          </Button>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleGalleryUpload(e.target.files)}
          />
        </div>

        {gallery.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
            La galería está vacía. Subí las primeras fotos.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((img) => (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                <img src={img.image_url ?? undefined} alt={img.caption ?? ''} className="h-full w-full object-cover" />
                <button
                  onClick={() => setConfirmId(img.id)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Eliminar"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!confirmId} onOpenChange={() => setConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>¿Eliminar imagen?</DialogTitle></DialogHeader>
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
