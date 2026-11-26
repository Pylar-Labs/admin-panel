import { cn } from '@/lib/utils'

// Selector nativo con el estilo de los campos del panel (el kit no trae un Select).
export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30',
        className
      )}
      {...props}
    />
  )
}
