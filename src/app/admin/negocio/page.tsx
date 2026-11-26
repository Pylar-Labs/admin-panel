'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { getSiteConfig, upsertSiteConfig } from '@/lib/supabase/queries'
import { saveErrorMessage } from '@/lib/utils'
import { CONTRACT } from '@/lib/contract/contract.generated'
import { isOverMaxItems, isValidWhatsapp } from '@/lib/contract/limits'
import { SaveButton } from '@/components/admin/SaveButton'
import { LimitedField } from '@/components/admin/LimitedField'
import { NativeSelect } from '@/components/admin/NativeSelect'
import { NotPublishedNotice } from '@/components/admin/NotPublishedNotice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SectionIssues } from '@/components/admin/SectionIssues'
import type { AboutStat, HoursSchedule, SectionKey } from '@/types/database'

const L = CONTRACT.limits

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

const LANGUAGE_NAMES: Record<string, string> = { es: 'Español', en: 'English', pt: 'Português (Brasil)' }

// Secciones a las que puede llevar un botón. Productos y testimonios existen en la web solo si cargaste datos.
const SECTION_TARGETS: [string, string][] = [
  ['#inicio', 'Inicio'],
  ['#nosotros', 'Quiénes somos'],
  ['#servicios', 'Servicios'],
  ['#contacto', 'Contacto'],
  ['#productos', 'Productos (si cargaste productos)'],
  ['#testimonios', 'Testimonios (si cargaste testimonios)'],
]
const URL_MODE = 'url'

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'services', label: 'Servicios' },
  { key: 'products', label: 'Productos' },
  { key: 'testimonials', label: 'Testimonios' },
  { key: 'contact', label: 'Contacto' },
]

type Titles = Record<SectionKey, { title: string; subtitle: string }>
const EMPTY_TITLES: Titles = {
  services: { title: '', subtitle: '' },
  products: { title: '', subtitle: '' },
  testimonials: { title: '', subtitle: '' },
  contact: { title: '', subtitle: '' },
}

const nullIfEmpty = (s: string) => (s.trim() ? s : null)

// Texto + destino de un botón del inicio (RF-2). El destino se elige entre secciones o es una URL http(s).
function ButtonFields({
  title, label, href, onChange, required,
}: {
  title: string
  label: string
  href: string
  onChange: (label: string, href: string) => void
  required?: boolean
}) {
  const isAnchor = SECTION_TARGETS.some(([v]) => v === href)
  const mode = isAnchor ? href : href === '' ? '' : URL_MODE
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      {required && !label && !href && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange('Contactanos', '#contacto')}>
          Usar sugerencia: «Contactanos» → Contacto
        </Button>
      )}
      <div className="space-y-2">
        <Label>Texto del botón{required && ' (obligatorio para publicar)'}</Label>
        <LimitedField value={label} onChange={(v) => onChange(v, href)} limit={L['hero.ctaPrimary.label']} placeholder="Ej: Contactanos" />
      </div>
      <div className="space-y-2">
        <Label>A dónde lleva{required && ' (obligatorio para publicar)'}</Label>
        <NativeSelect
          value={mode}
          onChange={(e) => onChange(label, e.target.value === URL_MODE ? 'https://' : e.target.value)}
        >
          <option value="">Elegí un destino…</option>
          {SECTION_TARGETS.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
          <option value={URL_MODE}>Otra dirección (URL)</option>
        </NativeSelect>
        {mode === URL_MODE && (
          <>
            <Input value={href} onChange={(e) => onChange(label, e.target.value)} placeholder="https://..." />
            {!/^https?:\/\//i.test(href) && (
              <p className="text-xs text-destructive">Tiene que empezar con http:// o https:// para poder publicarse.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function NegocioPage() {
  const { siteId } = useUser()
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [fields, setFields] = useState({
    business_name: '', tagline: '', description: '',
    phone: '', whatsapp: '', email: '',
    address: '', map_embed_url: '', hero_title: '', hero_subtitle: '',
    about_title: '', about_body: '',
    hero_cta_primary_label: '', hero_cta_primary_href: '',
    hero_cta_secondary_label: '', hero_cta_secondary_href: '',
    language: 'es',
  })
  const [hours, setHours] = useState<HoursSchedule>(EMPTY_HOURS)
  const [stats, setStats] = useState<AboutStat[]>([])
  const [highlights, setHighlights] = useState<string[]>([])
  const [titles, setTitles] = useState<Titles>(EMPTY_TITLES)

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
        about_title: config.about_title ?? '',
        about_body: config.about_body ?? '',
        hero_cta_primary_label: config.hero_cta_primary_label ?? '',
        hero_cta_primary_href: config.hero_cta_primary_href ?? '',
        hero_cta_secondary_label: config.hero_cta_secondary_label ?? '',
        hero_cta_secondary_href: config.hero_cta_secondary_href ?? '',
        language: config.language ?? 'es',
      })
      setHours({ ...EMPTY_HOURS, ...(config.hours ?? {}) })
      setStats(config.about_stats ?? [])
      setHighlights(config.about_highlights ?? [])
      setTitles({
        services: { title: config.section_titles?.services?.title ?? '', subtitle: config.section_titles?.services?.subtitle ?? '' },
        products: { title: config.section_titles?.products?.title ?? '', subtitle: config.section_titles?.products?.subtitle ?? '' },
        testimonials: { title: config.section_titles?.testimonials?.title ?? '', subtitle: config.section_titles?.testimonials?.subtitle ?? '' },
        contact: { title: config.section_titles?.contact?.title ?? '', subtitle: config.section_titles?.contact?.subtitle ?? '' },
      })
    })
  }, [siteId])

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((prev) => ({ ...prev, [key]: e.target.value }))
  }
  // Para los campos con contador (LimitedField entrega el texto, no el evento).
  function setText(key: keyof typeof fields) {
    return (value: string) => setFields((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!siteId) return
    // Se guarda lo escrito aunque pase un límite (RF-7); solo se descartan filas totalmente vacías.
    const section_titles = Object.fromEntries(
      SECTIONS.flatMap(({ key }) => {
        const entry = Object.fromEntries(
          Object.entries(titles[key]).filter(([, v]) => v.trim())
        )
        return Object.keys(entry).length ? [[key, entry]] : []
      })
    )
    startTransition(async () => {
      const { error } = await upsertSiteConfig(siteId, {
        ...fields,
        about_title: nullIfEmpty(fields.about_title),
        about_body: nullIfEmpty(fields.about_body),
        hero_cta_primary_label: nullIfEmpty(fields.hero_cta_primary_label),
        hero_cta_primary_href: nullIfEmpty(fields.hero_cta_primary_href),
        hero_cta_secondary_label: nullIfEmpty(fields.hero_cta_secondary_label),
        hero_cta_secondary_href: nullIfEmpty(fields.hero_cta_secondary_href),
        about_stats: stats.filter((s) => s.value.trim() || s.label.trim()),
        about_highlights: highlights.filter((h) => h.trim()),
        section_titles,
        hours,
      })
      if (error) { toast.error(saveErrorMessage(error)); return }
      setSaved(true)
      toast.success('Cambios guardados')
      setTimeout(() => setSaved(false), 2500)
    })
  }

  const whatsappBad = fields.whatsapp !== '' && !isValidWhatsapp(fields.whatsapp, CONTRACT.whatsappDigits)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Mi negocio</h1>
        <p className="mt-1 text-sm text-zinc-500">Información general que aparece en tu sitio web.</p>
      </div>

      <SectionIssues section="negocio" refreshKey={saved} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Datos generales</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Nombre del negocio</Label>
              <LimitedField id="business_name" value={fields.business_name} onChange={setText('business_name')} limit={L['name']} placeholder="Ej: La Esquina" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Eslogan</Label>
              <LimitedField id="tagline" value={fields.tagline} onChange={setText('tagline')} limit={L['tagline']} placeholder="Una frase corta que te representa" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <LimitedField id="description" multiline value={fields.description} onChange={setText('description')} limit={L['description']} placeholder="Contá de qué se trata tu negocio..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Idioma de la web</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <NativeSelect id="language" aria-label="Idioma de la web" value={fields.language} onChange={(e) => setFields((p) => ({ ...p, language: e.target.value }))}>
              {CONTRACT.languages.map((code) => <option key={code} value={code}>{LANGUAGE_NAMES[code] ?? code}</option>)}
            </NativeSelect>
            <p className="text-xs text-zinc-500">Cambia los textos fijos de la web (menú, botones, pie). Lo que escribís vos no se traduce: escribilo en el idioma que elijas.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Inicio de la web</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hero_title">Título principal</Label>
              <LimitedField id="hero_title" value={fields.hero_title} onChange={setText('hero_title')} limit={L['hero.headline']} placeholder="Bienvenidos a nuestro local" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero_subtitle">Subtítulo</Label>
              <LimitedField id="hero_subtitle" multiline value={fields.hero_subtitle} onChange={setText('hero_subtitle')} limit={L['hero.subheadline']} placeholder="La mejor calidad al mejor precio" />
            </div>
            <ButtonFields
              title="Botón principal"
              required
              label={fields.hero_cta_primary_label}
              href={fields.hero_cta_primary_href}
              onChange={(l, h) => setFields((p) => ({ ...p, hero_cta_primary_label: l, hero_cta_primary_href: h }))}
            />
            <ButtonFields
              title="Botón secundario (opcional)"
              label={fields.hero_cta_secondary_label}
              href={fields.hero_cta_secondary_href}
              onChange={(l, h) => setFields((p) => ({ ...p, hero_cta_secondary_label: l, hero_cta_secondary_href: h }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Quiénes somos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="about_title">Título</Label>
              <LimitedField id="about_title" value={fields.about_title} onChange={setText('about_title')} limit={L['about.title']} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="about_body">Texto</Label>
              <LimitedField id="about_body" multiline rows={4} value={fields.about_body} onChange={setText('about_body')} limit={L['about.body']} />
            </div>

            <div className="space-y-2">
              <Label>Cifras (opcional, hasta {CONTRACT.maxItems['about.stats']})</Label>
              {stats.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr]">
                    <LimitedField value={s.value} onChange={(v) => setStats((a) => a.map((x, j) => (j === i ? { ...x, value: v } : x)))} limit={L['about.stats[].value']} placeholder="+14" />
                    <LimitedField value={s.label} onChange={(v) => setStats((a) => a.map((x, j) => (j === i ? { ...x, label: v } : x)))} limit={L['about.stats[].label']} placeholder="años de experiencia" />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Quitar cifra" onClick={() => setStats((a) => a.filter((_, j) => j !== i))}>
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))}
              {isOverMaxItems(stats.length, CONTRACT.maxItems['about.stats']) && (
                <p className="text-xs text-destructive">Máximo {CONTRACT.maxItems['about.stats']} cifras: se guardan igual, pero hay que dejar {CONTRACT.maxItems['about.stats']} para publicar.</p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setStats((a) => [...a, { value: '', label: '' }])}>
                <Plus size={14} /><span className="ml-1">Agregar cifra</span>
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Destacados (opcional, hasta {CONTRACT.maxItems['about.highlights']})</Label>
              {highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1">
                    <LimitedField value={h} onChange={(v) => setHighlights((a) => a.map((x, j) => (j === i ? v : x)))} limit={L['about.highlights[]']} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Quitar destacado" onClick={() => setHighlights((a) => a.filter((_, j) => j !== i))}>
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))}
              {isOverMaxItems(highlights.length, CONTRACT.maxItems['about.highlights']) && (
                <p className="text-xs text-destructive">Máximo {CONTRACT.maxItems['about.highlights']} destacados: se guardan igual, pero hay que dejar {CONTRACT.maxItems['about.highlights']} para publicar.</p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setHighlights((a) => [...a, ''])}>
                <Plus size={14} /><span className="ml-1">Agregar destacado</span>
              </Button>
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
                <Input id="whatsapp" value={fields.whatsapp} onChange={set('whatsapp')} placeholder="5493410000000" aria-invalid={whatsappBad || undefined} />
                <p className={whatsappBad ? 'text-xs text-destructive' : 'text-xs text-zinc-500'}>
                  Solo dígitos con código de país, de {CONTRACT.whatsappDigits.min} a {CONTRACT.whatsappDigits.max}, sin +, espacios ni guiones.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email de contacto</Label>
              <LimitedField id="email" value={fields.email} onChange={setText('email')} limit={L['contact.email']} placeholder="contacto@minegocio.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <LimitedField id="address" value={fields.address} onChange={setText('address')} limit={L['contact.address']} placeholder="Calle 123, Ciudad" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="map_embed_url">URL del mapa de Google Maps</Label>
              <Textarea id="map_embed_url" value={fields.map_embed_url} onChange={set('map_embed_url')} placeholder="https://www.google.com/maps/embed?pb=..." rows={2} className="text-xs" />
              <NotPublishedNotice />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Horarios de atención</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <NotPublishedNotice />
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
          <CardHeader><CardTitle className="text-base">Títulos de las secciones (opcional)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-zinc-500">Si los dejás vacíos, la web usa un título neutro y no muestra subtítulo.</p>
            {SECTIONS.map(({ key, label }) => (
              <div key={key} className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium text-zinc-700">{label}</p>
                <Label>Título</Label>
                <LimitedField value={titles[key].title} onChange={(v) => setTitles((t) => ({ ...t, [key]: { ...t[key], title: v } }))} limit={L[`sections.${key}.title`]} />
                <Label>Subtítulo</Label>
                <LimitedField value={titles[key].subtitle} onChange={(v) => setTitles((t) => ({ ...t, [key]: { ...t[key], subtitle: v } }))} limit={L[`sections.${key}.subtitle`]} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Separator />
        <SaveButton isPending={isPending} saved={saved} />
      </form>
    </div>
  )
}
