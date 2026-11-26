// Traduce el error de Supabase al cambiar la contraseña a algo que el cliente entienda (módulo puro).
// Nunca devuelve el texto técnico del error: solo mensajes propios, en español.
type AuthLikeError = { name?: string; code?: string; status?: number } | null | undefined

export function passwordErrorMessage(error: AuthLikeError): string {
  if (error?.code === 'same_password') return 'La contraseña nueva tiene que ser distinta de la actual.'
  if (error?.code === 'weak_password') return 'La contraseña es demasiado débil. Usá al menos 6 caracteres y probá combinar letras y números.'
  if (error?.name === 'AuthSessionMissingError' || error?.code === 'session_not_found' || error?.code === 'session_expired') {
    return 'Tu sesión venció. Volvé a iniciar sesión.'
  }
  if (error?.status === 429 || error?.code === 'over_request_rate_limit') {
    return 'Hiciste demasiados intentos. Esperá unos minutos y volvé a probar.'
  }
  return 'No se pudo actualizar la contraseña. Intentá de nuevo.'
}
