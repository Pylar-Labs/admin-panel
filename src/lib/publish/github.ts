// Adaptador de GitHub (spec 002): lee la versión del contrato de la web y escribe su archivo de datos.
// Puro: recibe el token y `fetch` (el cableado con las variables de entorno vive en `server-deps.ts`, `server-only`).
// Los errores nunca incluyen el token.
const API = 'https://api.github.com'
const DATA_PATH = 'src/content/site.data.json'
const SCHEMA_PATH = 'src/content/site.schema.ts'

type Opts = { token: string; fetch?: typeof fetch }

export function createGithub({ token, fetch: f = fetch }: Opts) {
  const headers = (accept: string) => ({ Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' })
  const fileUrl = (repo: string, path: string) => `${API}/repos/${repo}/contents/${path}`

  // Versión del contrato que trae la web de ese cliente (null si no se puede leer).
  async function readSchemaVersion(repo: string, branch: string): Promise<string | null> {
    const res = await f(`${fileUrl(repo, SCHEMA_PATH)}?ref=${encodeURIComponent(branch)}`, { headers: headers('application/vnd.github.raw+json') })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`GitHub respondió ${res.status} al leer la versión del contrato`)
    return (await res.text()).match(/SCHEMA_VERSION = "([^"]+)"/)?.[1] ?? null
  }

  async function current(repo: string, branch: string): Promise<{ sha: string; content: string } | null> {
    const res = await f(`${fileUrl(repo, DATA_PATH)}?ref=${encodeURIComponent(branch)}`, { headers: headers('application/vnd.github+json') })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`GitHub respondió ${res.status} al leer el archivo de datos`)
    const json = (await res.json()) as { sha: string; content?: string }
    return { sha: json.sha, content: Buffer.from(json.content ?? '', 'base64').toString('utf8') }
  }

  // Escribe el archivo de datos; si el contenido ya es idéntico no hace commit. Ante un conflicto (409/422: el archivo
  // cambió entre la lectura y la escritura) relee y reintenta una vez.
  async function writeData(repo: string, branch: string, content: string, message: string): Promise<{ changed: boolean; sha?: string }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const existing = await current(repo, branch)
      if (existing && existing.content === content) return { changed: false }
      const res = await f(fileUrl(repo, DATA_PATH), {
        method: 'PUT',
        headers: headers('application/vnd.github+json'),
        body: JSON.stringify({ message, content: Buffer.from(content, 'utf8').toString('base64'), branch, ...(existing ? { sha: existing.sha } : {}) }),
      })
      if (res.ok) return { changed: true, sha: ((await res.json()) as { commit?: { sha?: string } }).commit?.sha }
      if (res.status !== 409 && res.status !== 422) throw new Error(`GitHub respondió ${res.status} al escribir el archivo de datos`)
    }
    throw new Error('GitHub: conflicto al escribir el archivo de datos')
  }

  return { readSchemaVersion, writeData }
}
