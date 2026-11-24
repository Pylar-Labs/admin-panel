'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError('Email o contraseña incorrectos. Intentá de nuevo.')
        return
      }

      router.push('/admin')
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-primary px-12 text-primary-foreground">
        <div className="max-w-sm text-center space-y-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold mb-2">
            P
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Pylar Labs</h1>
          <p className="text-primary-foreground/70 text-base leading-relaxed">
            Panel de administración para gestionar el contenido de tu sitio web en minutos.
          </p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile branding */}
          <div className="lg:hidden text-center space-y-1">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold mb-3">
              P
            </div>
            <h1 className="text-2xl font-bold text-foreground">Pylar Labs</h1>
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Bienvenido</h2>
            <p className="text-sm text-muted-foreground">Ingresá con tu cuenta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={isPending}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isPending}
                className="h-11"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-11 font-semibold" disabled={isPending}>
              {isPending ? 'Ingresando...' : 'Ingresar al panel'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            ¿Necesitás ayuda? Contactá a{' '}
            <span className="text-foreground font-medium">Pylar Labs</span>
          </p>
        </div>
      </div>
    </div>
  )
}
