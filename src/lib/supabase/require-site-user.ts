import 'server-only'
import { createClient } from '@/lib/supabase/server'

// Para acciones de servidor que llama el CLIENTE sobre SU sitio. El sitio sale SOLO de app_metadata de la sesión
// (nunca de un parámetro ni de user_metadata, que el usuario puede editar). Se llama al empezar CADA acción.
export async function requireSiteUser(): Promise<{ ok: true; siteId: string; userId: string } | { ok: false; message: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Tu sesión venció. Volvé a iniciar sesión.' }
  const siteId = user.app_metadata?.site_id
  if (typeof siteId !== 'string' || !siteId) {
    return { ok: false, message: 'Tu usuario no tiene un sitio asignado. Pedile a la agencia que lo configure.' }
  }
  return { ok: true, siteId, userId: user.id }
}
