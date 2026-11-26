// Admin = cuenta marcada por la agencia en app_metadata (solo editable con la clave de servidor).
// user_metadata lo puede editar el propio usuario: nunca se mira para el rol.
export function isAdminUser(user: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin'
}
