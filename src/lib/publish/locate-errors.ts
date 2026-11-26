// Liga cada error del contrato con la sección y el campo del panel donde se corrige (spec 002, RF-2 y RF-12).
// Módulo puro (sin imports relativos ni `enum`). Las reglas entre campos se ligan a TODOS los campos implicados.
export type Section = 'negocio' | 'servicios' | 'catalogo' | 'testimonios' | 'imagenes' | 'redes'
export type ContractError = { path: string; code: string; message: string; expected?: string[] }
export type Source = { table: 'services' | 'products' | 'testimonials'; id: string }
export type Location = { section: Section; field: string; item?: string; source?: Source }
export type LocatedError = { path: string; code: string; message: string; locations: Location[] }

export const SECTION_LABELS: Record<Section, string> = {
  negocio: 'Mi negocio', servicios: 'Servicios', catalogo: 'Catálogo', testimonios: 'Testimonios', imagenes: 'Imágenes', redes: 'Redes sociales',
}

// Ruta sin índices (`products[2].price` → `products[].price`) → sección y campo del panel.
const N = 'negocio'
const FIELDS: Record<string, [Section, string]> = {
  language: [N, 'Idioma de la web'], name: [N, 'Nombre del negocio'], tagline: [N, 'Eslogan'], description: [N, 'Descripción'],
  hero: [N, 'Inicio de la web'], 'hero.headline': [N, 'Título principal'], 'hero.subheadline': [N, 'Subtítulo'],
  'hero.ctaPrimary': [N, 'Botón principal'], 'hero.ctaPrimary.label': [N, 'Botón principal'], 'hero.ctaPrimary.href': [N, 'Botón principal'],
  'hero.ctaSecondary': [N, 'Botón secundario'], 'hero.ctaSecondary.label': [N, 'Botón secundario'], 'hero.ctaSecondary.href': [N, 'Botón secundario'],
  about: [N, 'Quiénes somos'], 'about.title': [N, 'Título de «Quiénes somos»'], 'about.body': [N, 'Texto de «Quiénes somos»'],
  'about.stats': [N, 'Cifras de «Quiénes somos»'], 'about.stats[]': [N, 'Cifras de «Quiénes somos»'],
  'about.stats[].value': [N, 'Cifras de «Quiénes somos»'], 'about.stats[].label': [N, 'Cifras de «Quiénes somos»'],
  'about.highlights': [N, 'Destacados de «Quiénes somos»'], 'about.highlights[]': [N, 'Destacados de «Quiénes somos»'],
  contact: [N, 'Contacto'], 'contact.whatsapp': [N, 'WhatsApp'], 'contact.email': [N, 'Email de contacto'], 'contact.phone': [N, 'Teléfono'], 'contact.address': [N, 'Dirección'],
  social: ['redes', 'Redes sociales'], 'social.instagram': ['redes', 'Instagram'], 'social.facebook': ['redes', 'Facebook'],
  services: ['servicios', 'Lista de servicios'], 'services[]': ['servicios', 'Servicio'], 'services[].icon': ['servicios', 'Ícono'],
  'services[].title': ['servicios', 'Nombre del servicio'], 'services[].description': ['servicios', 'Descripción'],
  testimonials: ['testimonios', 'Lista de testimonios'], 'testimonials[]': ['testimonios', 'Testimonio'], 'testimonials[].name': ['testimonios', 'Nombre del cliente'],
  'testimonials[].role': ['testimonios', 'Rol'], 'testimonials[].text': ['testimonios', 'Comentario'], 'testimonials[].rating': ['testimonios', 'Estrellas'],
  products: ['catalogo', 'Lista de productos'], 'products[]': ['catalogo', 'Producto'], 'products[].id': ['catalogo', 'Identificador'],
  'products[].name': ['catalogo', 'Nombre'], 'products[].description': ['catalogo', 'Descripción'], 'products[].image': ['catalogo', 'Foto'],
  'products[].price': ['catalogo', 'Precio'], 'products[].category': ['catalogo', 'Categoría'],
  productGridConfig: ['catalogo', 'Ajustes del catálogo'], 'productGridConfig.showPrice': ['catalogo', 'Ajustes del catálogo'],
  'productGridConfig.currency': ['catalogo', 'Ajustes del catálogo'], 'productGridConfig.ctaLabel': ['catalogo', 'Ajustes del catálogo'],
  'productGridConfig.groupByCategory': ['catalogo', 'Ajustes del catálogo'],
}
const SECTION_TITLES: [Section, string] = [N, 'Títulos de las secciones']
const LISTS: Record<string, string> = { services: 'title', testimonials: 'name', products: 'name' }

type Obj = Record<string, unknown>
const asObj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const listOf = (data: Obj, key: string): Obj[] => (Array.isArray(data[key]) ? (data[key] as unknown[]).map(asObj) : [])
const normCategory = (c: unknown) => (typeof c === 'string' ? c.trim().toLowerCase() : '')

export function locateErrors(errors: ContractError[], data: unknown, sources: Record<string, Source>): LocatedError[] {
  const root = asObj(data)
  const products = listOf(root, 'products')

  // Ubicación de un campo de un elemento de lista (con su nombre y la fila de origen).
  const itemField = (list: string, i: number, suffix: string): Location => {
    const [section, field] = FIELDS[`${list}[]${suffix}`]
    const name = asObj(listOf(root, list)[i])[LISTS[list]]
    const source = sources[`${list}[${i}]`]
    return { section, field, item: typeof name === 'string' && name ? name : `Elemento ${i + 1}`, ...(source ? { source } : {}) }
  }
  const plain = (path: string): Location => {
    const norm = path.replace(/\[\d+\]/g, '[]')
    const item = path.match(/^(services|testimonials|products)\[(\d+)\](.*)$/)
    if (item) return itemField(item[1], Number(item[2]), item[3].replace(/\[\d+\]/g, '[]'))
    if (path.startsWith('sections')) return { section: SECTION_TITLES[0], field: SECTION_TITLES[1] }
    const hit = FIELDS[norm] ?? FIELDS[norm.replace(/\[\]$/, '')]
    return hit ? { section: hit[0], field: hit[1] } : { section: N, field: path }
  }
  const productLocations = (indexes: number[], suffix: string) => indexes.map((i) => itemField('products', i, suffix))

  return errors.map((e) => {
    const index = Number(e.path.match(/^products\[(\d+)\]/)?.[1])
    let locations: Location[]
    switch (e.code) {
      case 'missing_contact_method':
        locations = [plain('contact.email'), plain('contact.phone')]
        break
      case 'duplicate_id': {
        const id = products[index]?.id
        locations = productLocations(products.flatMap((p, i) => (p.id === id ? [i] : [])), '.id')
        break
      }
      case 'inconsistent_category': {
        const key = normCategory(products[index]?.category)
        locations = productLocations(products.flatMap((p, i) => (normCategory(p.category) === key ? [i] : [])), '.category')
        break
      }
      case 'too_many_categories':
        locations = productLocations(products.flatMap((p, i) => (normCategory(p.category) ? [i] : [])), '.category')
        break
      case 'unknown_anchor': {
        const href = asObj(asObj(root.hero)[e.path.split('.')[1]]).href
        const target = href === '#productos' ? plain('products') : href === '#testimonios' ? plain('testimonials') : null
        locations = [plain(e.path), ...(target ? [{ section: target.section, field: target.section === 'catalogo' ? 'Productos' : 'Testimonios' }] : [])]
        break
      }
      default:
        locations = [plain(e.path)]
    }
    if (!locations.length) locations = [plain(e.path)]
    return { path: e.path, code: e.code, message: e.message, locations }
  })
}

// Los problemas que se corrigen en una sección (un error con varias ubicaciones aparece en todas).
export const errorsForSection = (located: LocatedError[], section: Section) =>
  located.filter((e) => e.locations.some((l) => l.section === section))
