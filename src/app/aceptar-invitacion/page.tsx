'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SaveButton } from '@/components/admin/SaveButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

type Status = 'checking' | 'ready' | 'invalid'

// La invitación llega con la sesión en la dirección (#access_token=…): Supabase no usa el flujo por código para invitar.
// Se lee a mano en vez de depender de la detección automática del cliente.
async function resolveSession(): Promise<Status> {
  const supabase = createClient()
  const params = new URLSearchParams(window.location.hash.slice(1))
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    // La sesión ya no necesita estar en la dirección (queda en el historial y en capturas).
    window.history.replaceState(null, '', window.location.pathname)
    return error ? 'invalid' : 'ready'
  }
  if (params.get('error')) return 'invalid'
  const { data } = await supabase.auth.getUser()
  return data.user ? 'ready' : 'invalid'
}

export default function AceptarInvitacionPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    resolveSession().then(setStatus)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    startTransition(async () => {
      const { error: updateError } = await createClient().auth.updateUser({ password })
      if (updateError) {
        setError('No se pudo guardar la contraseña. Intentá de nuevo.')
        return
      }
      router.push('/admin')
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Bienvenido a tu panel</CardTitle>
          <CardDescription>Creá tu contraseña para entrar y editar los datos de tu web.</CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'checking' && <p className="text-sm text-muted-foreground">Verificando tu invitación…</p>}
          {status === 'invalid' && (
            <p role="alert" className="text-sm text-destructive">
              El enlace de invitación venció o ya se usó. Pedile a la agencia que te invite de nuevo.
            </p>
          )}
          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" disabled={isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repetí la contraseña" autoComplete="new-password" disabled={isPending} />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <SaveButton isPending={isPending} label="Crear contraseña y entrar" />
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
