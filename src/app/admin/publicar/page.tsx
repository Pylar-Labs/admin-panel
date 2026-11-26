'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2, Rocket } from 'lucide-react'
import { publish, retry, getStatus } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { SECTION_LABELS } from '@/lib/publish/locate-errors'
import type { LocatedError, Section } from '@/lib/publish/locate-errors'
import type { PublishResult, PublishStatus } from '@/lib/publish/publish'

const PATHS: Record<Section, string> = {
  negocio: '/admin/negocio', servicios: '/admin/servicios', catalogo: '/admin/catalogo',
  testimonios: '/admin/testimonios', imagenes: '/admin/imagenes', redes: '/admin/redes',
}
const POLL_MS = 5000

function StatusLine({ status }: { status: PublishStatus | null }) {
  if (!status) return <p className="text-sm text-zinc-500">Consultando el estado…</p>
  const when = status.publishedAt ? new Date(status.publishedAt).toLocaleString('es-AR') : null
  switch (status.status) {
    case 'publishing':
      return <p className="flex items-center gap-2 text-sm text-zinc-700"><Loader2 size={15} className="animate-spin" />Hay una publicación en curso (puede ser de otra persona de tu sitio).</p>
    case 'saved':
      return <p className="flex items-center gap-2 text-sm text-zinc-700"><Loader2 size={15} className="animate-spin" />Datos guardados. Esperando a que tu web termine de construirse…</p>
    case 'published':
      return <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={15} />Tu web está publicada{when ? ` (versión del ${when})` : ''}.</p>
    case 'deploy_failed':
      return <p className="flex items-center gap-2 text-sm text-destructive"><AlertCircle size={15} />{status.message}</p>
    default:
      return <p className="text-sm text-zinc-500">Todavía no hay una publicación en curso.</p>
  }
}

function ErrorList({ errors }: { errors: LocatedError[] }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>No se publicó nada: hay {errors.length} {errors.length === 1 ? 'problema' : 'problemas'} para corregir</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-3">
          {errors.map((e, i) => (
            <li key={i} className="text-sm">
              <p>{e.message}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
                {e.locations.map((l, j) => (
                  <Link key={j} href={PATHS[l.section]} className="underline underline-offset-2">
                    {SECTION_LABELS[l.section]} › {l.field}{l.item ? ` (${l.item})` : ''}
                  </Link>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

function ResultNotice({ result }: { result: PublishResult }) {
  if (result.status === 'saved') return <p className="text-sm text-zinc-700">Datos guardados y enviados a tu web. Esperando a que termine de construirse…</p>
  if (result.status === 'errors') return <ErrorList errors={result.errors} />
  return (
    <Alert variant={result.status === 'deploy_failed' ? 'default' : 'destructive'}>
      <AlertCircle />
      <AlertDescription>{result.message}</AlertDescription>
    </Alert>
  )
}

export default function PublicarPage() {
  const [status, setStatus] = useState<PublishStatus | null>(null)
  const [result, setResult] = useState<PublishResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Pedir el estado y aplicarlo van separados: el estado se guarda dentro de un .then, no dentro del efecto.
  const apply = useCallback((r: Awaited<ReturnType<typeof getStatus>>) => {
    if (r.ok) { setStatus(r.status); setError(null) } else setError(r.message)
  }, [])

  // Las consultas de fondo ignoran sus fallos: al cerrar sesión Next vuelve a ejecutar los efectos de la pantalla
  // anterior contra /login y esa respuesta no es una acción (sin esto queda un error de consola sin capturar).
  const refresh = useCallback(() => { getStatus().then(apply).catch(() => {}) }, [apply])

  useEffect(() => { refresh() }, [refresh])

  const inProgress = status?.status === 'publishing' || status?.status === 'saved'
  useEffect(() => {
    if (!inProgress) return
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [inProgress, refresh])

  function run(action: typeof publish) {
    setResult(null)
    startTransition(async () => {
      try {
        const r = await action()
        if (r.ok) setResult(r.result); else setError(r.message)
        apply(await getStatus())
      } catch {
        setError('No se pudo completar la operación. Intentá de nuevo.')
      }
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Publicar</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Guardar los cambios en cada sección no actualiza tu web: para que se vean, publicalos desde acá.
          Se publica siempre lo último que guardaste, no lo que esté a medio escribir en pantalla.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Estado de tu web</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <StatusLine status={status} />
          {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run(publish)} disabled={isPending || inProgress || !status} className="gap-2">
              {isPending ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
              {isPending ? 'Publicando…' : 'Publicar mis cambios'}
            </Button>
            {status?.status === 'deploy_failed' && (
              <Button variant="outline" onClick={() => run(retry)} disabled={isPending}>Reintentar sin volver a validar</Button>
            )}
          </div>
          {result && <ResultNotice result={result} />}
        </CardContent>
      </Card>
    </div>
  )
}
