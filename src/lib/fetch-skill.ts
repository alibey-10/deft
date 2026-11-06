import { createServerFn } from '@tanstack/react-start'

import { getSkill } from '#/lib/directory.ts'

type Input = { pathSlug: string; file?: string }

const cache = new Map<string, { text: string; expires: number }>()
const TTL_MS = 10 * 60 * 1000

/**
 * Fetch a skill's SKILL.md (or one of its listed reference files) on the server.
 * Only URLs derived from the registry are fetched, never arbitrary input.
 */
export const fetchSkillMarkdown = createServerFn({ method: 'GET' })
  .validator((input: Input) => input)
  .handler(async ({ data }) => {
    const skill = getSkill(data.pathSlug)
    if (!skill) throw new Error('Skill not found')
    if (data.file && !skill.files?.includes(data.file)) throw new Error('File not found')

    const url = data.file ? new URL(data.file, skill.rawUrl).toString() : skill.rawUrl
    const cached = cache.get(url)
    if (cached && cached.expires > Date.now()) return { url, text: cached.text }

    const response = await fetch(url, { headers: { Accept: 'text/plain' } })
    if (!response.ok) throw new Error(`Could not load skill content (${response.status})`)
    const text = await response.text()
    cache.set(url, { text, expires: Date.now() + TTL_MS })
    return { url, text }
  })
