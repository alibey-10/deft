import { api } from '../../../convex/_generated/api'
import { getSkillDef, searchSkillsDef } from '#/lib/assistant/tools.ts'
import { getConvex, loadSkillMarkdown } from '#/lib/skill-source.server.ts'

/** Keeps a long SKILL.md from flooding the model's context. */
const MAX_MARKDOWN_CHARS = 12_000

export const searchSkills = searchSkillsDef.server(async ({ query, limit }) => {
  const { page } = await getConvex().query(api.directory.list, {
    q: query,
    paginationOpts: { numItems: limit ?? 8, cursor: null },
  })
  return {
    results: page.map((s) => ({
      name: s.name,
      description: s.description,
      author: s.user,
      repo: s.repo,
      topics: s.topics,
      stars: s.stars,
      pathSlug: s.pathSlug,
      url: `/skills/${s.pathSlug}`,
    })),
  }
})

export const getSkill = getSkillDef.server(async ({ pathSlug }) => {
  const skill = await loadSkillMarkdown(pathSlug)
  if (!skill) return { found: false }
  const name = /^name:\s*(.+)$/m.exec(skill.text)?.[1]?.trim() ?? pathSlug.split('/').pop()
  const truncated = skill.text.length > MAX_MARKDOWN_CHARS
  return {
    found: true,
    name,
    url: `/skills/${pathSlug}`,
    markdown: truncated ? skill.text.slice(0, MAX_MARKDOWN_CHARS) : skill.text,
    truncated,
  }
})

export const assistantTools = [searchSkills, getSkill]
