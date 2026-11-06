import { ConvexHttpClient } from 'convex/browser'

import { api } from '../../convex/_generated/api'

const cache = new Map<string, { text: string; expires: number }>()
const TTL_MS = 10 * 60 * 1000

let convex: ConvexHttpClient | undefined
/** Convex client for server code (server functions, API routes, assistant tools). */
export const getConvex = () =>
  (convex ??= new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL as string))

/**
 * Load an approved skill's SKILL.md (or one of its listed reference files).
 * Only URLs of approved skills in Convex are fetched, never arbitrary input.
 * Returns null when the skill or file isn't listed.
 */
export async function loadSkillMarkdown(pathSlug: string, file?: string) {
  const skill = await getConvex().query(api.directory.getSkillSource, { pathSlug })
  if (!skill) return null
  if (file && !skill.files.includes(file)) return null

  const url = file ? new URL(file, skill.rawUrl).toString() : skill.rawUrl
  const cached = cache.get(url)
  if (cached && cached.expires > Date.now()) return { url, text: cached.text, files: skill.files }

  const response = await fetch(url, { headers: { Accept: 'text/plain' } })
  if (!response.ok) throw new Error(`Could not load skill content (${response.status})`)
  const text = await response.text()
  cache.set(url, { text, expires: Date.now() + TTL_MS })
  return { url, text, files: skill.files }
}
