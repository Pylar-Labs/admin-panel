import { EyeOff } from 'lucide-react'

// Aviso para datos que se guardan pero que la web todavía no muestra (RF-8).
export function NotPublishedNotice() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <EyeOff className="size-3.5 shrink-0" aria-hidden />
      No se muestra en tu web. Se guarda, pero por ahora no se publica.
    </p>
  )
}
