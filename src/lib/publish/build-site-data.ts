// Convierte lo guardado en el panel al archivo de datos del contrato (spec 002, RF-3 y RF-4).
// Módulo puro (sin imports relativos ni `enum`: se prueba con `node --test`). NO corrige nada: un dato inválido llega
// tal cual al validador. Solo excluye inactivos, ordena, renombra y omite lo que el contrato no admite.
import type { SiteConfig, Service, Product, Testimonial } from '@/types/database'

export type SiteRows = {
  config: SiteConfig
  services: Service[]
  products: Product[]
  testimonials: Testimonial[]
}
export type Source = { table: 'services' | 'products' | 'testimonials'; id: string }
type Obj = Record<string, unknown>

// null y '' son «ausente» (el panel guarda '' en campos que el cliente nunca tocó); un texto de solo espacios sí cuenta.
const present = (v: unknown) => v !== null && v !== undefined && v !== ''
function compact(obj: Obj): Obj | undefined {
  const out = Object.fromEntries(Object.entries(obj).filter(([, v]) => present(v)))
  return Object.keys(out).length ? out : undefined
}
const nonEmptyList = <T>(list: T[] | null | undefined) => (list && list.length ? list : undefined)

// Activos, por `order` (sin orden al final) y, si empatan, por id: el resultado no depende del orden en que llegan.
function ordered<T extends { id: string; order: number | null; active: boolean | null }>(rows: T[]): T[] {
  return rows
    .filter((r) => r.active === true)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function buildSiteData({ config, services, products, testimonials }: SiteRows): { data: Obj; sources: Record<string, Source> } {
  const sources: Record<string, Source> = {}
  const list = <T extends { id: string; order: number | null; active: boolean | null }>(
    table: Source['table'], path: string, rows: T[], map: (r: T) => Obj | undefined
  ) => {
    const kept = ordered(rows)
    kept.forEach((r, i) => { sources[`${path}[${i}]`] = { table, id: r.id } })
    return nonEmptyList(kept.map((r) => map(r) ?? {}))
  }

  const sections = Object.fromEntries(
    Object.entries(config.section_titles ?? {}).flatMap(([key, v]) => {
      const entry = compact({ title: v?.title, subtitle: v?.subtitle })
      return entry ? [[key, entry]] : []
    })
  )

  const data = compact({
    language: config.language,
    name: config.business_name,
    tagline: config.tagline,
    description: config.description,
    hero: compact({
      headline: config.hero_title,
      subheadline: config.hero_subtitle,
      ctaPrimary: compact({ label: config.hero_cta_primary_label, href: config.hero_cta_primary_href }),
      ctaSecondary: compact({ label: config.hero_cta_secondary_label, href: config.hero_cta_secondary_href }),
    }),
    about: compact({
      title: config.about_title,
      body: config.about_body,
      stats: nonEmptyList(config.about_stats),
      highlights: nonEmptyList(config.about_highlights),
    }),
    contact: compact({ whatsapp: config.whatsapp, email: config.email, phone: config.phone, address: config.address }),
    social: compact({ instagram: config.instagram, facebook: config.facebook }),
    services: list('services', 'services', services, (s) => compact({ icon: s.icon, title: s.title, description: s.description })),
    testimonials: list('testimonials', 'testimonials', testimonials, (t) => compact({ name: t.author_name, role: t.role, text: t.text, rating: t.rating })),
    products: list('products', 'products', products, (p) =>
      compact({ id: p.slug, name: p.name, description: p.description, image: p.image_url, price: p.price, category: p.category })
    ),
    productGridConfig: compact({
      showPrice: config.show_prices,
      currency: config.currency,
      groupByCategory: config.group_by_category,
      ctaLabel: config.product_cta_label,
    }),
    sections: Object.keys(sections).length ? sections : undefined,
  })
  return { data: data ?? {}, sources }
}
