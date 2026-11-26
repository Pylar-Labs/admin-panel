// Límites del contrato (RF-6). Módulo puro: sin imports relativos ni `enum` (se prueba con `node --test`).
// Solo calcula avisos; nunca impide escribir ni guardar (RF-7).
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export type TextLimit = { max: number; singleLine: boolean }

// Cuenta igual que el contrato: un emoji o una letra con tilde combinada vale 1.
export function countGraphemes(value: string): number {
  return [...segmenter.segment(value)].length
}

export function checkText(value: string, limit: TextLimit) {
  const count = countGraphemes(value)
  return {
    count,
    max: limit.max,
    over: count > limit.max,
    hasLineBreak: limit.singleLine && /[\r\n]/.test(value),
  }
}

export const isOverMaxItems = (count: number, max: number) => count > max

export function isValidWhatsapp(value: string, digits: { min: number; max: number }) {
  return /^\d+$/.test(value) && value.length >= digits.min && value.length <= digits.max
}

// ¿Hay un valor que no empieza como URL completa (http:// o https://)? Vacío no cuenta. Solo es un aviso inmediato: el resto
// de la regla (espacios, credenciales, 2000 caracteres) la juzga el validador real al guardar.
export const needsFullUrl = (value: string) => value.trim() !== '' && !/^https?:\/\//i.test(value.trim())
