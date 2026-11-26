'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/admin/Sidebar'
import { Header } from '@/components/admin/Header'
import { Button, buttonVariants } from '@/components/ui/button'
import { useUser } from '@/hooks/useUser'
import { useActiveSite } from '@/hooks/useActiveSite'
import { getSiteConfig } from '@/lib/supabase/queries'
import type { SiteConfig } from '@/types/database'

// Páginas del admin que no editan datos de un sitio: se pueden abrir sin haber elegido cliente.
const NO_CLIENT_NEEDED = ['/admin/clientes', '/admin/cuenta']

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { siteId, isAdmin, loading } = useUser()
  const { active, clear } = useActiveSite()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null)

  useEffect(() => {
    if (!siteId) return
    let cancelled = false
    getSiteConfig(siteId).then((config) => {
      if (!cancelled) setSiteConfig(config)
    })
    return () => {
      cancelled = true
    }
  }, [siteId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  const blocked = isAdmin && !siteId && !NO_CLIENT_NEEDED.some((p) => pathname.startsWith(p))
  // La configuración cargada puede ser de otro sitio mientras llega la nueva: se usa solo si coincide.
  const loadedName = siteConfig?.site_id === siteId ? siteConfig.business_name : null
  const businessName = isAdmin ? loadedName ?? active?.businessName ?? null : loadedName

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isAdmin={isAdmin} hasClient={!!siteId} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          businessName={isAdmin ? 'Agencia' : businessName}
          onMenuClick={() => setSidebarOpen(true)}
        />
        {isAdmin && siteId && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            <span className="min-w-0 truncate">
              Estás editando a: <strong>{businessName ?? 'cliente'}</strong>
            </span>
            <span className="flex gap-2">
              <Link href="/admin/clientes" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                Cambiar
              </Link>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  clear()
                  router.push('/admin/clientes')
                }}
              >
                Salir
              </Button>
            </span>
          </div>
        )}
        {/* La clave reinicia la sección al cambiar de cliente: no queda nada del anterior en pantalla. */}
        <main key={siteId ?? 'sin-cliente'} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {blocked ? (
            <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center">
              <p className="font-medium text-foreground">Elegí un cliente para empezar</p>
              <p className="mt-1 text-sm text-muted-foreground">Antes de ver o editar datos tenés que elegir a qué cliente corresponden.</p>
              <Link href="/admin/clientes" className={buttonVariants({ className: 'mt-4' })}>
                Ir a clientes
              </Link>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}
