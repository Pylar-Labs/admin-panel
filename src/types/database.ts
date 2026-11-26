export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type HoursSchedule = {
  lunes?: string
  martes?: string
  miercoles?: string
  jueves?: string
  viernes?: string
  sabado?: string
  domingo?: string
}

export type AboutStat = { value: string; label: string }
export type SectionKey = 'services' | 'products' | 'testimonials' | 'contact'
export type SectionTitles = Partial<Record<SectionKey, { title?: string; subtitle?: string }>>

export interface SiteConfig {
  id: string
  site_id: string
  business_name: string | null
  tagline: string | null
  description: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  hours: HoursSchedule | null
  instagram: string | null
  facebook: string | null
  logo_url: string | null
  hero_image_url: string | null
  hero_title: string | null
  hero_subtitle: string | null
  map_embed_url: string | null
  active: boolean | null
  created_at: string | null
  // Contrato 2.3 (spec 001)
  language: string
  about_title: string | null
  about_body: string | null
  about_stats: AboutStat[]
  about_highlights: string[]
  hero_cta_primary_label: string | null
  hero_cta_primary_href: string | null
  hero_cta_secondary_label: string | null
  hero_cta_secondary_href: string | null
  currency: string
  show_prices: boolean
  group_by_category: boolean
  product_cta_label: string | null
  section_titles: SectionTitles
}

export interface GalleryImage {
  id: string
  site_id: string
  image_url: string | null
  caption: string | null
  order: number | null
  active: boolean | null
}

export interface Service {
  id: string
  site_id: string
  title: string | null
  description: string | null
  icon: string | null
  order: number | null
  active: boolean | null
}

export interface Product {
  id: string
  site_id: string
  name: string | null
  description: string | null
  price: number | null
  price_visible: boolean | null
  category: string | null
  image_url: string | null
  whatsapp_message: string | null
  order: number | null
  active: boolean | null
  slug: string | null // identificador estable; lo genera el panel al crear (RF-5)
}

export interface Testimonial {
  id: string
  site_id: string
  author_name: string | null
  text: string | null
  rating: number | null
  order: number | null
  active: boolean | null
  role: string | null
}
