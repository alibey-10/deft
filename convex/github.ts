/**
 * GitHub helpers shared by the skill scan and skills.sh discovery actions. No Convex functions
 * here, so both the Node and default runtimes can import it.
 */
import type { RawUrlParts } from './githubUrls'

export const API = 'https://api.github.com'

export type GithubRepo = {
  name: string
  owner: { login: string }
  default_branch: string
  pushed_at: string | null
  created_at: string
  fork: boolean
  archived: boolean
  size: number
  stargazers_count: number
}

export type GithubUser = {
  login: string
  html_url: string
  avatar_url: string
  name: string | null
  bio: string | null
  blog: string | null
  location: string | null
  followers: number
}

export type Tree =
  | { kind: 'ok'; blobs: Set<string>; truncated: boolean }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }

export type ScanError = { target: string; message: string }

export class RateLimited extends Error {}

export function githubFetch(url: string, token: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'skilly-skill-scan',
      Authorization: `Bearer ${token}`,
    },
  }).then((response) => {
    const limited =
      response.status === 429 ||
      (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')
    if (limited) {
      const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000
      throw new RateLimited(
        `GitHub rate limit hit${reset ? `; resets ${new Date(reset).toISOString()}` : ''}`,
      )
    }
    return response
  })
}

export const describe = async (response: Response) =>
  `${response.status} ${(await response.text()).slice(0, 200)}`

export async function getRepo(owner: string, repo: string, token: string) {
  const response = await githubFetch(`${API}/repos/${owner}/${repo}`, token)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await describe(response))
  return (await response.json()) as GithubRepo
}

export async function getUser(login: string, token: string) {
  const response = await githubFetch(`${API}/users/${login}`, token)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await describe(response))
  return (await response.json()) as GithubUser
}

export async function getTree(
  owner: string,
  repo: string,
  branch: string,
  token: string,
): Promise<Tree> {
  const response = await githubFetch(
    `${API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token,
  )
  if (response.status === 404) return { kind: 'not-found' }
  // 409: the repository is empty.
  if (response.status === 409) return { kind: 'ok', blobs: new Set(), truncated: false }
  if (!response.ok) return { kind: 'error', message: await describe(response) }
  const tree = (await response.json()) as {
    truncated: boolean
    tree: Array<{ path: string; type: string }>
  }
  return {
    kind: 'ok',
    truncated: tree.truncated,
    blobs: new Set(tree.tree.filter((e) => e.type === 'blob').map((e) => e.path)),
  }
}

/** Encoded form for URLs; stored paths stay decoded. */
export const encodePath = (parts: RawUrlParts) => ({
  ...parts,
  path: parts.path.split('/').map(encodeURIComponent).join('/'),
})

export const isSkillFile = (path: string) =>
  (path === 'SKILL.md' || path.endsWith('/SKILL.md')) && !path.includes('node_modules/')

/** `name` and `description` from SKILL.md frontmatter, including folded (`>`) values. */
export function readFrontmatter(markdown: string) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1]
  if (!block) return {}
  const fields: Record<string, string> = {}
  let current: string | null = null
  for (const line of block.split(/\r?\n/)) {
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (pair) {
      current = pair[1]
      fields[current] = pair[2].replace(/^[>|][-+]?$/, '').replace(/^(['"])(.*)\1$/, '$2')
    } else if (current && /^\s+\S/.test(line)) {
      fields[current] = `${fields[current]} ${line.trim()}`.trim()
    } else {
      current = null
    }
  }
  return {
    name: fields.name || undefined,
    description: fields.description?.slice(0, 500) || undefined,
  }
}

/**
 * Run `fn` over `items`, at most `limit` at a time. On the first failure, stops taking new items,
 * lets in-flight ones finish, then rethrows, so results gathered so far are complete.
 */
export async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items]
  let failure: { error: unknown } | undefined
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined && !failure; item = queue.shift()) {
        try {
          await fn(item)
        } catch (error) {
          failure ??= { error }
        }
      }
    }),
  )
  if (failure) throw failure.error
}
