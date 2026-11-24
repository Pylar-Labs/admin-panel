'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { useUser } from '@/hooks/useUser'
import { getSiteConfig, upsertSiteConfig } from '@/lib/supabase/queries'
import { saveErrorMessage, triggerVercelDeploy } from '@/lib/utils'
import { SaveButton } from '@/components/admin/SaveButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AtSign, Globe } from 'lucide-react'

export default function RedesPage() {
  const { siteId } = useUser()
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [deployHook, setDeployHook] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!siteId) return
    getSiteConfig(siteId).then((config) => {
      if (!config) return
      setInstagram(config.instagram ?? '')
      setFacebook(config.facebook ?? '')
      setDeployHook(config.vercel_deploy_hook ?? null)
    })
  }, [siteId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!siteId) return

    startTransition(async () => {
      const { error } = await upsertSiteConfig(siteId, { instagram, facebook })
      if (error) {
        toast.error(saveErrorMessage(error))
        return
      }
      await triggerVercelDeploy(deployHook)
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tus perfiles</CardTitle>
          <CardDescription>Ingresá solo el nombre de usuario o URL según corresponda.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="instagram" className="flex items-center gap-2">
                <AtSign size={15} /> Usuario de Instagram
              </Label>
              <div className="flex items-center">
                <span className="flex h-8 items-center rounded-l-lg border border-r-0 border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500">
                  @
                </span>
                <Input
                  id="instagram"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="minegocio"
                  className="rounded-l-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebook" className="flex items-center gap-2">
                <Globe size={15} /> Página de Facebook
              </Label>
              <Input
                id="facebook"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="https://facebook.com/minegocio"
              />
            </div>

            <SaveButton isPending={isPending} saved={saved} />
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
