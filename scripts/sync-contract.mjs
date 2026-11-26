// Genera src/lib/contract/contract.generated.ts a partir del contrato del template (solo lectura).
// Uso: npm run contract:sync. Los límites salen de las descripciones del JSON Schema: si el template cambia
// la redacción, `npm run test` falla (contract-sync.test.mjs) en vez de perder un límite en silencio.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const TEMPLATE_DOCS = new URL('../../template-landing/docs/', import.meta.url)
const OUT = new URL('../src/lib/contract/contract.generated.ts', import.meta.url)

// Tope de caracteres que dice la descripción de un campo; `null` si no dice ninguno.
function parseLimit(description = '') {
  const m = description.match(/[Mm]áximo (\d+) caracteres/) ?? description.match(/hasta (\d+) caracteres/)
  return m ? { max: Number(m[1]), singleLine: /una sola línea/.test(description) } : null
}

export function buildContract() {
  const schema = JSON.parse(readFileSync(new URL('site.schema.json', TEMPLATE_DOCS), 'utf8'))
  const version = readFileSync(new URL('site-schema.md', TEMPLATE_DOCS), 'utf8').match(/Versión del contrato: (\S+)/)?.[1]
  if (!version) throw new Error('No encuentro la versión del contrato en site-schema.md')

  const limits = {}
  const maxItems = {}
  const walk = (node, path) => {
    if (node.type === 'string') {
      const limit = parseLimit(node.description)
      if (limit) limits[path] = limit
    } else if (node.type === 'array') {
      if (node.maxItems) maxItems[path] = node.maxItems
      if (node.items.type === 'string') {
        // Los destacados llevan el tope por elemento en la descripción de la lista: «de 40 caracteres como máximo cada uno».
        const m = node.description?.match(/de (\d+) caracteres como máximo/)
        if (m) limits[`${path}[]`] = { max: Number(m[1]), singleLine: false }
      } else walk(node.items, `${path}[]`)
    } else for (const [k, v] of Object.entries(node.properties ?? {})) walk(v, path ? `${path}.${k}` : k)
  }
  walk(schema, '')

  const icons = schema.properties.services.items.properties.icon.description.match(/Uno de: ([^.]+)\./)?.[1].split(', ')
  const digits = schema.properties.contact.properties.whatsapp.description.match(/\(de (\d+) a (\d+)\)/)
  if (!icons || !digits) throw new Error('No puedo extraer los íconos o el formato del WhatsApp del contrato')

  return {
    version,
    limits,
    maxItems,
    icons,
    languages: schema.properties.language.enum,
    currencies: schema.properties.productGridConfig.properties.currency.enum,
    whatsappDigits: { min: Number(digits[1]), max: Number(digits[2]) },
  }
}

export function renderContract(contract) {
  return `// GENERADO por scripts/sync-contract.mjs desde ../template-landing/docs/ — NO EDITAR (npm run contract:sync).\nexport const CONTRACT = ${JSON.stringify(contract, null, 2)} as const\n`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(fileURLToPath(OUT)), { recursive: true })
  writeFileSync(OUT, renderContract(buildContract()))
  console.log('Contrato', buildContract().version, '→ src/lib/contract/contract.generated.ts')
}
