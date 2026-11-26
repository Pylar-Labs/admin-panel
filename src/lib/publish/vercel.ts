// Adaptador de Vercel (spec 002): confirma el despliegue de una publicación y fuerza uno con el enlace del sitio.
// Puro: recibe el token y `fetch` (el cableado con las variables de entorno vive en `server-deps.ts`, `server-only`).
// Los errores nunca incluyen el token ni el enlace de despliegue.
type Opts = { token: string; teamId?: string; fetch?: typeof fetch }

export function createVercel({ token, teamId, fetch: f = fetch }: Opts) {
  // Despliegue de producción más nuevo creado desde el inicio de la publicación (y, si hubo commit, con ese commit).
  async function latestDeployment(projectId: string | null, { sinceMs, sha }: { sinceMs: number; sha: string | null }): Promise<{ state: string } | null> {
    if (!projectId) throw new Error('El sitio no tiene proyecto de Vercel cargado')
    const query = new URLSearchParams({ projectId, target: 'production', since: String(sinceMs), limit: '20' })
    if (teamId) query.set('teamId', teamId)
    const res = await f(`https://api.vercel.com/v6/deployments?${query}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Vercel respondió ${res.status} al consultar los despliegues`)
    const { deployments = [] } = (await res.json()) as { deployments?: { state?: string; readyState?: string; created: number; meta?: { githubCommitSha?: string } }[] }
    const newest = deployments.filter((d) => !sha || d.meta?.githubCommitSha === sha).sort((a, b) => b.created - a.created)[0]
    return newest ? { state: newest.state ?? newest.readyState ?? 'UNKNOWN' } : null
  }
  return { latestDeployment }
}

// El enlace de despliegue de cada sitio es un secreto: si responde mal, el mensaje no lo repite.
export async function triggerDeploy(hook: string, f: typeof fetch = fetch): Promise<void> {
  const res = await f(hook, { method: 'POST' })
  if (!res.ok) throw new Error(`El enlace de despliegue respondió ${res.status}`)
}
