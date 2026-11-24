import { createClient } from './client'
import type {
  SiteConfig,
  GalleryImage,
  Service,
  Product,
  Testimonial,
} from '@/types/database'

// ── site_config ──────────────────────────────────────────────────────────────

export async function getSiteConfig(siteId: string): Promise<SiteConfig | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('site_config')
    .select('*')
    .eq('site_id', siteId)
    .maybeSingle() // un sitio sin configuración no es un error: devuelve null, sin respuesta 406
  return data
}

// Solo actualiza: crear la configuración de un sitio es cosa de la agencia (spec 004).
// Un upsert falla para el cliente aunque la fila exista, porque Postgres comprueba antes la regla de alta.
export async function upsertSiteConfig(
  siteId: string,
  values: Partial<Omit<SiteConfig, 'id' | 'site_id' | 'created_at'>>
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('site_config')
    .update(values)
    .eq('site_id', siteId)
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Tu sitio todavía no tiene configuración. Pedile a la agencia que la cree.' }
  return { error: null }
}

// ── gallery ───────────────────────────────────────────────────────────────────

export async function getGallery(siteId: string): Promise<GalleryImage[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('gallery')
    .select('*')
    .eq('site_id', siteId)
    .order('order', { ascending: true })
  return data ?? []
}

export async function addGalleryImage(
  siteId: string,
  imageUrl: string,
  caption?: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('gallery')
    .insert({ site_id: siteId, image_url: imageUrl, caption: caption ?? null })
  return { error: error?.message ?? null }
}

export async function updateGalleryImage(
  id: string,
  values: Partial<Pick<GalleryImage, 'caption' | 'order' | 'active'>>
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from('gallery').update(values).eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteGalleryImage(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from('gallery').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ── services ──────────────────────────────────────────────────────────────────

export async function getServices(siteId: string): Promise<Service[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('services')
    .select('*')
    .eq('site_id', siteId)
    .order('order', { ascending: true })
  return data ?? []
}

export async function upsertService(
  siteId: string,
  values: Partial<Omit<Service, 'site_id'>> & { id?: string }
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('services')
    .upsert({ site_id: siteId, ...values })
  return { error: error?.message ?? null }
}

export async function deleteService(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from('services').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ── products ──────────────────────────────────────────────────────────────────

export async function getProducts(siteId: string): Promise<Product[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('site_id', siteId)
    .order('order', { ascending: true })
  return data ?? []
}

export async function upsertProduct(
  siteId: string,
  values: Partial<Omit<Product, 'site_id'>> & { id?: string }
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('products')
    .upsert({ site_id: siteId, ...values })
  return { error: error?.message ?? null }
}

export async function deleteProduct(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ── testimonials ──────────────────────────────────────────────────────────────

export async function getTestimonials(siteId: string): Promise<Testimonial[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('testimonials')
    .select('*')
    .eq('site_id', siteId)
    .order('order', { ascending: true })
  return data ?? []
}

export async function upsertTestimonial(
  siteId: string,
  values: Partial<Omit<Testimonial, 'site_id'>> & { id?: string }
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('testimonials')
    .upsert({ site_id: siteId, ...values })
  return { error: error?.message ?? null }
}

export async function deleteTestimonial(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from('testimonials').delete().eq('id', id)
  return { error: error?.message ?? null }
}
