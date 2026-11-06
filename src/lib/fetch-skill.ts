import { createServerFn } from '@tanstack/react-start'

import { ConvexHttpClient } from 'convex/browser'

import { api } from '../../convex/_generated/api'

type Input = { pathSlug: string; file?: string }

const cache = new Map<string, { text: string; expires: number }>()
const TTL_MS = 10 * 60 * 1000

let convex: ConvexHttpClient | undefined
const getConvex = () => (convex ??= new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL as string))

/**
 * Fetch a skill's SKILL.md (or one of its listed reference files) on the server.
 * Only URLs of approved skills in Convex are fetched, never arbitrary input.
 */
export const fetchSkillMarkdown = createServerFn({ method: 'GET' })
  .validator((input: Input) => input)
  .handler(async ({ data }) => {
    const skill = await getConvex().query(api.directory.getSkillSource, { pathSlug: data.pathSlug })
    if (!skill) throw new Error('Skill not found')
    if (data.file && !skill.files.includes(data.file)) throw new Error('File not found')

    const url = data.file ? new URL(data.file, skill.rawUrl).toString() : skill.rawUrl
    const cached = cache.get(url)
    if (cached && cached.expires > Date.now()) return { url, text: cached.text }

    const response = await fetch(url, { headers: { Accept: 'text/plain' } })
    if (!response.ok) throw new Error(`Could not load skill content (${response.status})`)
    const text = await response.text()
    cache.set(url, { text, expires: Date.now() + TTL_MS })
    return { url, text }
  })
