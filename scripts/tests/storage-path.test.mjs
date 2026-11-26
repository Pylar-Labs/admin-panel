// Pulidos de la 003: la ruta de un archivo del bucket sale de su URL pública, para borrarlo cuando se quita la imagen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { storagePathFromUrl, safeFileName } from '../../src/lib/storage.ts'

const BASE = 'https://eplnsjdvjawwijokoerk.supabase.co/storage/v1/object/public/images'

test('saca la ruta de una URL pública y descarta el ?t= de la caché', () => {
  assert.equal(storagePathFromUrl(`${BASE}/sitio-a/gallery/1700000000000-foto.png?t=1700000000999`, 'images'), 'sitio-a/gallery/1700000000000-foto.png')
  assert.equal(storagePathFromUrl(`${BASE}/sitio-a/logo`, 'images'), 'sitio-a/logo')
})

test('decodifica espacios y acentos del nombre', () => {
  assert.equal(storagePathFromUrl(`${BASE}/sitio-a/gallery/1-mi%20foto%20ni%C3%B1o.png`, 'images'), 'sitio-a/gallery/1-mi foto niño.png')
})

test('URL externa, de otro bucket, vacía o inválida: no hay nada que borrar', () => {
  assert.equal(storagePathFromUrl('https://example.com/imagen.png', 'images'), null)
  assert.equal(storagePathFromUrl('https://x.supabase.co/storage/v1/object/public/otro-bucket/sitio-a/logo', 'images'), null)
  assert.equal(storagePathFromUrl('', 'images'), null)
  assert.equal(storagePathFromUrl(null, 'images'), null)
  assert.equal(storagePathFromUrl(undefined, 'images'), null)
  assert.equal(storagePathFromUrl('no es una url', 'images'), null)
  assert.equal(storagePathFromUrl(`${BASE}/`, 'images'), null)
})

test('con carpeta: solo devuelve rutas dentro de esa carpeta (nunca la de otro sitio)', () => {
  assert.equal(storagePathFromUrl(`${BASE}/sitio-a/logo`, 'images', 'sitio-a'), 'sitio-a/logo')
  assert.equal(storagePathFromUrl(`${BASE}/sitio-b/logo`, 'images', 'sitio-a'), null)
  assert.equal(storagePathFromUrl(`${BASE}/sitio-ab/logo`, 'images', 'sitio-a'), null, 'prefijo parcial no cuenta')
  assert.equal(storagePathFromUrl(`${BASE}/sitio-a/../sitio-b/logo`, 'images', 'sitio-a'), null, 'sin subir de carpeta')
  assert.equal(storagePathFromUrl(`${BASE}/sitio-a/%2e%2e/sitio-b/logo`, 'images', 'sitio-a'), null, 'ni codificado')
})

test('una codificación rota no lanza: devuelve null', () => {
  assert.equal(storagePathFromUrl(`${BASE}/sitio-a/%E0%A4%A`, 'images'), null)
})

// El almacenamiento rechaza claves con `ñ` y otros caracteres (InvalidKey): el nombre se sanea al subir a la galería.
test('safeFileName: quita acentos y la ñ, y cambia espacios y símbolos por guion', () => {
  assert.equal(safeFileName('foto niño.png'), 'foto-nino.png')
  assert.equal(safeFileName('Mi Foto 1.JPG'), 'Mi-Foto-1.JPG')
  assert.equal(safeFileName('canción áéíóú.webp'), 'cancion-aeiou.webp')
  assert.equal(safeFileName('a#b?c%d.png'), 'a-b-c-d.png')
  assert.equal(safeFileName('  muchos   espacios  .gif'), 'muchos-espacios.gif')
})

test('safeFileName: conserva la extensión y los puntos internos', () => {
  assert.equal(safeFileName('a.b.c.png'), 'a.b.c.png')
  assert.equal(safeFileName('foto'), 'foto')
})

test('safeFileName: nombre vacío o sin nada aprovechable → «imagen» con su extensión', () => {
  assert.equal(safeFileName('.png'), 'imagen.png')
  assert.equal(safeFileName('😀.png'), 'imagen.png')
  assert.equal(safeFileName('???.jpg'), 'imagen.jpg')
  assert.equal(safeFileName(''), 'imagen')
})

test('safeFileName: nunca deja rutas ni puntos al inicio, y acota el largo', () => {
  assert.equal(safeFileName('../../x.png'), 'x.png')
  assert.equal(safeFileName('..\\secreto.png'), 'secreto.png')
  const largo = safeFileName(`${'a'.repeat(300)}.png`)
  assert.ok(largo.length <= 84 && largo.endsWith('.png'), `largo ${largo.length}`)
})

test('safeFileName: el resultado solo tiene caracteres que el almacenamiento acepta', () => {
  for (const n of ['foto niño.png', '😀 ñandú #1?.jpeg', 'a/b\\c.png', 'ÁÉÍÓÚ Ü.png']) {
    assert.match(safeFileName(n), /^[A-Za-z0-9._-]+$/, n)
  }
})
