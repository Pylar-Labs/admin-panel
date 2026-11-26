// Guarda de las pruebas de base (test:db): corren SOLO contra la base de pruebas (.env.test.local), nunca contra producción.
// Doble candado: el host no puede ser el de producción Y el archivo de entorno debe declarar PYLAR_TEST_DB=1.
export const PROD_HOST = 'eplnsjdvjawwijokoerk.supabase.co'

export function assertTestDatabase(url, env = process.env) {
  let host
  try {
    host = new URL(String(url)).host.toLowerCase()
  } catch {
    throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL (o no es una URL válida) en .env.test.local: no se escribe nada.')
  }
  if (host.split(':')[0] === PROD_HOST) {
    throw new Error(`Las pruebas apuntan a la base de producción (${PROD_HOST}): no se escribe nada. Usá la base de pruebas con .env.test.local.`)
  }
  if (env.PYLAR_TEST_DB !== '1') {
    throw new Error('Falta PYLAR_TEST_DB=1 en .env.test.local: las pruebas de base solo corren contra la base de pruebas. No se escribe nada.')
  }
  return host
}
