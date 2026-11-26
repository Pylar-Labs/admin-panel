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
  vercel_deploy_hook: string | null
  active: boolean | null
  created_at: string | null
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
}

export interface Testimonial {
  id: string
  site_id: string
  author_name: string | null
  text: string | null
  rating: number | null
  order: number | null
  active: boolean | null
}
