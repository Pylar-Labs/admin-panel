// Identificador estable de producto (RF-5). Módulo puro. Se llama solo al CREAR el producto:
// al renombrar no se vuelve a calcular. Formato del contrato: minúsculas, números y guiones, de 1 a 60.
const MAX = 60

export function makeSlug(name: string, taken: string[]): string {
  const used = new Set(taken)
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // Sin nombre aprovechable no hay base: se usa `producto-N`.
  const stem = base || 'producto'
  for (let n = 1; ; n++) {
    const suffix = base && n === 1 ? '' : `-${n}`
    const candidate = stem.slice(0, MAX - suffix.length).replace(/-+$/, '') + suffix
    if (!used.has(candidate)) return candidate
  }
}
