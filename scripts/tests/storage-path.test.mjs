// Pulidos de la 003: la ruta de un archivo del bucket sale de su URL pública, para borrarlo cuando se quita la imagen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { storagePathFromUrl } from '../../src/lib/storage.ts'

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
