import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { checkText, type TextLimit } from '@/lib/contract/limits'

type Props = {
  value: string
  onChange: (value: string) => void
  limit: TextLimit
  multiline?: boolean
  id?: string
  placeholder?: string
  rows?: number
  required?: boolean
}

// Campo con contador del límite del contrato (RF-6). Avisa pero nunca impide escribir ni guardar (RF-7):
// por eso no usa `maxLength` nativo.
export function LimitedField({ value, onChange, limit, multiline, id, placeholder, rows = 3, required }: Props) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const note = `${fieldId}-limit`
  const { count, max, over, hasLineBreak } = checkText(value, limit)
  const invalid = over || hasLineBreak
  const common = {
    id: fieldId,
    value,
    placeholder,
    required,
    'aria-invalid': invalid || undefined,
    'aria-describedby': note,
  }
  return (
    <div className="space-y-1">
      {multiline ? (
        <Textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input {...common} onChange={(e) => onChange(e.target.value)} />
      )}
      <p id={note} className={cn('text-xs', invalid ? 'text-destructive' : 'text-zinc-500')}>
        {count} / {max} caracteres{limit.singleLine && ' · una sola línea'}
        {over && ' — te pasaste del límite: se guarda igual, pero hay que acortarlo para publicar.'}
        {hasLineBreak && ' — este campo es de una sola línea: quitá los saltos de línea para publicar.'}
      </p>
    </div>
  )
}
