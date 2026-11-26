// Arranca el panel contra la base de PRUEBAS (npm run dev:test). Next cargaría `.env.local` (producción) para cualquier variable
// que falte en `.env.test.local`: por eso se exigen las tres y se aplica la misma guarda que las pruebas, antes de arrancar.
import { spawn } from 'node:child_process'
import { assertTestDatabase } from './tests/_guard.mjs'

for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[key]) {
    console.error(`Falta ${key} en .env.test.local: no se arranca (se mezclaría con las claves de producción de .env.local).`)
    process.exit(1)
  }
}
try {
  console.log(`Panel contra la base de pruebas: ${assertTestDatabase(process.env.NEXT_PUBLIC_SUPABASE_URL)}`)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev'], { stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 0))
