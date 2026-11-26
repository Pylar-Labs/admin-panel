// Ruta de un archivo del bucket a partir de su URL pública (módulo puro, sin imports relativos).
// Sirve para borrar el archivo cuando se quita la imagen (galería, logo, imagen principal).
// Con `folder` solo devuelve rutas DENTRO de esa carpeta (la del sitio): nunca se borra algo de otro sitio.
// shortcut: un nombre de archivo con `#` o `?` queda cortado en la URL pública y no se puede recuperar; la ruta devuelta
// no existe y borrarla no hace nada (cada subida lleva su marca de tiempo). Si molesta, subir con el nombre saneado.
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
