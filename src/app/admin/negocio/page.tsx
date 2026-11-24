'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { useUser } from '@/hooks/useUser'
import { getSiteConfig, upsertSiteConfig } from '@/lib/supabase/queries'
import { saveErrorMessage, triggerVercelDeploy } from '@/lib/utils'
import { SaveButton } from '@/components/admin/SaveButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { HoursSchedule } from '@/types/database'

const DAYS: { key: keyof HoursSchedule; label: string }[] = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
]

const EMPTY_HOURS: HoursSchedule = {
  lunes: '', martes: '', miercoles: '', jueves: '',
  viernes: '', sabado: '', domingo: '',
}

export default function NegocioPage() {
  const { siteId } = useUser()
  const [deployHook, setDeployHook] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [fields, setFields] = useState({
    business_name: '', tagline: '', description: '',
    phone: '', whatsapp: '', email: '',
    address: '', map_embed_url: '', hero_title: '', hero_subtitle: '',
  })
  const [hours, setHours] = useState<HoursSchedule>(EMPTY_HOURS)

  useEffect(() => {
    if (!siteId) return
    getSiteConfig(siteId).then((config) => {
      if (!config) return
      setFields({
        business_name: config.business_name ?? '',
        tagline: config.tagline ?? '',
        description: config.description ?? '',
        phone: config.phone ?? '',
        whatsapp: config.whatsapp ?? '',
        email: config.email ?? '',
        address: config.address ?? '',
        map_embed_url: config.map_embed_url ?? '',
        hero_title: config.hero_title ?? '',
        hero_subtitle: config.hero_subtitle ?? '',
      })
      setHours({ ...EMPTY_HOURS, ...(config.hours ?? {}) })
      setDeployHook(config.vercel_deploy_hook ?? null)
    })
  }, [siteId])

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((prev) => ({ ...prev, [key]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!siteId) return
    startTransition(async () => {
      const { error } = await upsertSiteConfig(siteId, { ...fields, hours })
      if (error) { toast.error(saveErrorMessage(error)); return }
      await triggerVercelDeploy(deployHook)
      setSaved(true)
      toast.success('Cambios guardados')
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Mi negocio</h1>
        <p className="mt-1 text-sm text-zinc-500">Información general que aparece en tu sitio web.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Datos generales</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Nombre del negocio</Label>
              <Input id="business_name" value={fields.business_name} onChange={set('business_name')} placeholder="Ej: La Esquina" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Eslogan</Label>
              <Input id="tagline" value={fields.tagline} onChange={set('tagline')} placeholder="Una frase corta que te representa" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" value={fields.description} onChange={set('description')} placeholder="Contá de qué se trata tu negocio..." rows={3} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Contacto</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" value={fields.phone} onChange={set('phone')} placeholder="+54 341 000-0000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp (solo números)</Label>
                <Input id="whatsapp" value={fields.whatsapp} onChange={set('whatsapp')} placeholder="5493410000000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email de contacto</Label>
              <Input id="email" type="email" value={fields.email} onChange={set('email')} placeholder="contacto@minegocio.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" value={fields.address} onChange={set('address')} placeholder="Calle 123, Ciudad" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="map_embed_url">URL del mapa de Google Maps</Label>
              <Textarea id="map_embed_url" value={fields.map_embed_url} onChange={set('map_embed_url')} placeholder="https://www.google.com/maps/embed?pb=..." rows={2} className="text-xs" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Horarios de atención</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {DAYS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-zinc-600">{label}</span>
                <Input
                  value={hours[key] ?? ''}
                  onChange={(e) => setHours((h) => ({ ...h, [key]: e.target.value }))}
                  placeholder="Ej: 9:00 a 18:00 o Cerrado"
                  className="text-sm"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Textos del sitio</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hero_title">Título principal</Label>
              <Input id="hero_title" value={fields.hero_title} onChange={set('hero_title')} placeholder="Bienvenidos a nuestro local" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero_subtitle">Subtítulo</Label>
              <Input id="hero_subtitle" value={fields.hero_subtitle} onChange={set('hero_subtitle')} placeholder="La mejor calidad al mejor precio" />
            </div>
          </CardContent>
        </Card>

        <Separator />
        <SaveButton isPending={isPending} saved={saved} />
      </form>
    </div>
  )
}
