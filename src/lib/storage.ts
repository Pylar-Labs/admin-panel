// Ruta de un archivo del bucket a partir de su URL pública (módulo puro, sin imports relativos).
// Sirve para borrar el archivo cuando se quita la imagen (galería, logo, imagen principal).
// Con `folder` solo devuelve rutas DENTRO de esa carpeta (la del sitio): nunca se borra algo de otro sitio.
// Los nombres con `#` o `?` quedarían cortados en la URL pública: por eso los nombres se sanean al subir (safeFileName).
export function storagePathFromUrl(url: string | null | undefined, bucket: string, folder?: string): string | null {
  if (!url) return null
  let pathname: string
  try {
    pathname = new URL(url).pathname
  } catch {
    return null
  }
  const marker = `/storage/v1/object/public/${bucket}/`
  const at = pathname.indexOf(marker)
  if (at === -1) return null
  let path: string
  try {
    path = decodeURIComponent(pathname.slice(at + marker.length))
  } catch {
    return null
  }
  if (!path || path.split('/').some((part) => part === '' || part === '.' || part === '..')) return null
  if (folder !== undefined && !path.startsWith(`${folder}/`)) return null
  return path
}

// Nombre de archivo que el almacenamiento acepta: sin acentos ni `ñ` (rechaza la clave con InvalidKey), sin espacios ni símbolos
// (`#`, `?`, `%`, barras), sin puntos ni guiones al inicio ni al final y de largo acotado. Conserva la extensión.
export function safeFileName(name: string): string {
  const ext = name.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? ''
  const base = name
    .slice(0, name.length - ext.length)
    .normalize('NFD')
    .replace(/\p{M}+/gu, '') // marcas combinantes (tildes, diéresis, la virgulilla de la ñ) tras normalizar
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
    .replace(/[-.]+$/g, '')
  return `${base || 'imagen'}${ext}`
}
