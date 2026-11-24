'use client'

import { useState, useEffect, useRef } from 'react'
import { Sidebar } from '@/components/admin/Sidebar'
import { Header } from '@/components/admin/Header'
import { useUser } from '@/hooks/useUser'
import { getSiteConfig } from '@/lib/supabase/queries'
import type { SiteConfig } from '@/types/database'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { siteId, loading } = useUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!siteId || fetchedRef.current) return
    fetchedRef.current = true
    getSiteConfig(siteId).then(setSiteConfig)
  }, [siteId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          businessName={siteConfig?.business_name ?? null}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
