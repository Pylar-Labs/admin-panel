'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { useUser } from '@/hooks/useUser'
import { getSiteConfig, upsertSiteConfig } from '@/lib/supabase/queries'
import { saveErrorMessage } from '@/lib/utils'
import { needsFullUrl } from '@/lib/contract/limits'
import { SaveButton } from '@/components/admin/SaveButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { SectionIssues } from '@/components/admin/SectionIssues'
import { AtSign, Globe } from 'lucide-react'

// El contrato pide la URL completa del perfil. Sin `type="url"` a propósito: el navegador bloquearía el envío y guardar nunca se bloquea.
function UrlField({ id, label, icon, value, onChange, placeholder }: {
  id: string
  label: string
  icon: React.ReactNode
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const bad = needsFullUrl(value)
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2">{icon} {label}</Label>
      <Input
        id={id}
        inputMode="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={bad || undefined}
        aria-describedby={bad ? `${id}-hint` : undefined}
      />
      {bad && (
        <p id={`${id}-hint`} className="text-xs text-destructive">
          Pegá la dirección completa del perfil, empezando con https:// (por ejemplo {placeholder}). Se guarda igual, pero hace falta para publicar.
        </p>
      )}
    </div>
  )
}

export default function RedesPage() {
  const { siteId } = useUser()
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!siteId) return
    getSiteConfig(siteId).then((config) => {
      if (!config) return
      setInstagram(config.instagram ?? '')
      setFacebook(config.facebook ?? '')
    })
  }, [siteId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!siteId) return
    // Al pegar una URL es común que arrastre espacios; el contrato no admite ninguno.
    const values = { instagram: instagram.trim(), facebook: facebook.trim() }

    startTransition(async () => {
      const { error } = await upsertSiteConfig(siteId, values)
      if (error) {
        toast.error(saveErrorMessage(error))
        return
      }
      setInstagram(values.instagram)
      setFacebook(values.facebook)
      setSaved(true)
      toast.success('Redes sociales actualizadas')
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Redes sociales</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Estos datos aparecen en el pie de tu sitio web.
        </p>
      </div>

      <SectionIssues section="redes" refreshKey={saved} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tus perfiles</CardTitle>
          <CardDescription>Pegá la dirección completa de cada perfil (empieza con https://). Si no tenés uno, dejalo vacío.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <UrlField
              id="instagram"
              label="Instagram (dirección del perfil)"
              icon={<AtSign size={15} />}
              value={instagram}
              onChange={setInstagram}
              placeholder="https://instagram.com/minegocio"
            />
            <UrlField
              id="facebook"
              label="Facebook (dirección de la página)"
              icon={<Globe size={15} />}
              value={facebook}
              onChange={setFacebook}
              placeholder="https://facebook.com/minegocio"
            />

            <SaveButton isPending={isPending} saved={saved} />
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
