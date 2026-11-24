import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Cliente con la clave de servidor: se salta las reglas de acceso. Solo se usa tras comprobar que quien llama es admin.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
