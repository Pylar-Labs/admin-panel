'use client'

import { Button } from '@/components/ui/button'
import { Check, Loader2 } from 'lucide-react'

interface SaveButtonProps {
  isPending: boolean
  saved?: boolean
  label?: string
  className?: string
}

export function SaveButton({
  isPending,
  saved = false,
  label = 'Guardar cambios',
  className,
}: SaveButtonProps) {
  return (
    <Button type="submit" disabled={isPending} className={className}>
      {isPending ? (
        <>
          <Loader2 size={15} className="animate-spin" />
          <span className="ml-2">Guardando...</span>
        </>
      ) : saved ? (
        <>
          <Check size={15} />
          <span className="ml-2">Guardado</span>
        </>
      ) : (
        label
      )}
    </Button>
  )
}
