'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MobileMenuButton } from './Sidebar'
import { Button } from '@/components/ui/button'
import { useTheme } from 'next-themes'
import { LogOut, Sun, Moon } from 'lucide-react'

interface HeaderProps {
  businessName: string | null
  onMenuClick: () => void
}

export function Header({ businessName, onMenuClick }: HeaderProps) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 gap-3">
      <div className="flex items-center gap-3">
        <MobileMenuButton onClick={onMenuClick} />
        <span className="font-semibold text-foreground truncate max-w-[160px] sm:max-w-xs">
          {businessName ?? 'Mi negocio'}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cambiar tema"
        >
          {/* El icono se alterna por CSS: así el HTML del servidor y el del cliente coinciden. */}
          <Moon size={16} className="dark:hidden" />
          <Sun size={16} className="hidden dark:block" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cerrar sesión"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline ml-1.5 text-xs">Salir</span>
        </Button>
      </div>
    </header>
  )
}
