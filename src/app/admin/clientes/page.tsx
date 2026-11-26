'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useUser } from '@/hooks/useUser'
import { useActiveSite } from '@/hooks/useActiveSite'
import { createClientAction, listClientsAction } from './actions'
import type { ClientRow } from '@/lib/clients/onboarding'
import { SaveButton } from '@/components/admin/SaveButton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const STATUS_LABEL: Record<ClientRow['status'], string> = {
  pendiente: 'Invitación pendiente',
  activo: 'Activo',
  sin_usuario: 'Sin usuario',
}

export default function ClientesPage() {
  const { isAdmin, loading } = useUser()
  const { setActive } = useActiveSite()
  const router = useRouter()
  const [clients, setClients] = useState<ClientRow[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  // Mensaje de «nombre repetido»: mientras exista, el siguiente envío lleva la confirmación.
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)
  const [leftover, setLeftover] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  function applyList(result: Awaited<ReturnType<typeof listClientsAction>>) {
    if (result.ok) {
      setClients(result.clients)
      setListError(null)
    } else {
      setListError(result.message)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    listClientsAction().then((result) => {
      if (!cancelled) applyList(result)
    })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setLeftover([])
    startTransition(async () => {
      const result = await createClientAction({ email, businessName, confirmDuplicateName: confirmMessage !== null })
      if (result.status === 'created') {
        toast.success(`Invitación enviada a ${result.email}`)
        setEmail('')
        setBusinessName('')
        setConfirmMessage(null)
        applyList(await listClientsAction())
        return
      }
      if (result.status === 'confirm_name') {
        setConfirmMessage(result.message)
        return
      }
      setConfirmMessage(null)
      setFormError(result.message)
      if (result.status === 'failed') setLeftover(result.left)
      if (result.status === 'failed' && result.left.length) applyList(await listClientsAction())
    })
  }

  function choose(client: ClientRow) {
    setActive({ siteId: client.siteId, businessName: client.businessName })
    router.push('/admin/negocio')
  }

  if (loading) return null
  if (!isAdmin) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-semibold text-foreground">Clientes</h1>
        <p className="mt-2 text-sm text-muted-foreground">No tenés permiso para ver esta sección.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Dá de alta a un cliente nuevo o elegí uno para ver y editar sus datos.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alta de cliente</CardTitle>
          <CardDescription>El cliente recibe un email para crear su contraseña. Vos no la ves ni la manejás.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client-email">Email del cliente</Label>
              <Input
                id="client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-name">Nombre del negocio</Label>
              <Input
                id="client-name"
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value)
                  setConfirmMessage(null)
                }}
                maxLength={100}
                autoComplete="off"
                disabled={isPending}
              />
            </div>
            {confirmMessage && (
              <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                {confirmMessage}
              </p>
            )}
            {formError && (
              <div role="alert" className="text-sm text-destructive">
                <p>{formError}</p>
                {leftover.length > 0 && (
                  <ul className="mt-1 list-disc pl-5">
                    {leftover.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <SaveButton isPending={isPending} label={confirmMessage ? 'Confirmar y crear' : 'Crear cliente'} />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mis clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {listError ? (
            <p role="alert" className="text-sm text-destructive">{listError}</p>
          ) : clients === null ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay clientes.</p>
          ) : (
            <ul className="divide-y divide-border">
              {clients.map((c) => (
                <li key={c.siteId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{c.businessName}</p>
                    <p className="truncate text-sm text-muted-foreground">{c.email ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={c.status === 'activo' ? 'default' : 'secondary'}>{STATUS_LABEL[c.status]}</Badge>
                    <Button size="sm" variant="outline" onClick={() => choose(c)}>
                      Editar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
