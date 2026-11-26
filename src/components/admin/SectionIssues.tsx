'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { getSectionIssues } from '@/app/admin/publicar/actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { LocatedError, Section } from '@/lib/publish/locate-errors'

// Problemas de lo ya guardado de esta sección respecto del contrato de la web (RF-12). No bloquea nada: guardar siempre
// funciona; la lista completa de lo que impide publicar está en «Publicar». Si no se puede consultar (p. ej. un admin sin
// sitio propio), no muestra nada. `refreshKey` vuelve a consultar cuando cambia (p. ej. tras guardar).
export function SectionIssues({ section, refreshKey }: { section: Section; refreshKey?: unknown }) {
  const [issues, setIssues] = useState<LocatedError[]>([])
  const apply = useCallback((r: Awaited<ReturnType<typeof getSectionIssues>>) => setIssues(r.ok ? r.issues : []), [])

  useEffect(() => {
    // Sin .catch quedaría un error de consola al cerrar sesión (Next reejecuta los efectos de la pantalla anterior).
    getSectionIssues(section).then(apply).catch(() => {})
  }, [section, refreshKey, apply])

  if (issues.length === 0) return null
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Con lo que tenés guardado, esta sección todavía no se puede publicar</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          {issues.map((e, i) => (
            <li key={i}>
              {e.message}
              <span className="block text-xs opacity-80">
                {e.locations.filter((l) => l.section === section).map((l) => `${l.field}${l.item ? ` (${l.item})` : ''}`).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
