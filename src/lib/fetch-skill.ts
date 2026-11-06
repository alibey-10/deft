import { createServerFn } from '@tanstack/react-start'

import { loadSkillMarkdown } from '#/lib/skill-source.server.ts'

type Input = { pathSlug: string; file?: string }

/** Fetch a skill's SKILL.md (or one of its listed reference files) on the server. */
export const fetchSkillMarkdown = createServerFn({ method: 'GET' })
  .validator((input: Input) => input)
  .handler(async ({ data }) => {
    const result = await loadSkillMarkdown(data.pathSlug, data.file)
    if (!result) throw new Error(data.file ? 'File not found' : 'Skill not found')
    return { url: result.url, text: result.text }
  })
