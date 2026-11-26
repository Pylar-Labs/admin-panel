'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isAdminUser } from '@/lib/auth/roles'
import { useActiveSite } from '@/hooks/useActiveSite'
import type { User } from '@supabase/supabase-js'

interface UseUserReturn {
  user: User | null
  // Cliente: su propio sitio (app_metadata). Admin: el cliente que eligió editar, o null si no eligió ninguno.
  siteId: string | null
  isAdmin: boolean
  loading: boolean
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { active } = useActiveSite()

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const isAdmin = isAdminUser(user)
  const siteId = isAdmin ? active?.siteId ?? null : user?.app_metadata?.site_id ?? null

  return { user, siteId, isAdmin, loading }
}
