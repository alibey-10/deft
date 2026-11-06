import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

/**
 * Tools the assistant can call. Definitions are shared so the client can type tool output;
 * the server implementations live in `tools.server.ts`.
 */

const skillSummary = z.object({
  name: z.string(),
  description: z.string(),
  author: z.string(),
  repo: z.string(),
  topics: z.array(z.string()),
  stars: z.number().optional(),
  /** `<user>/<slug>`; pass to `get_skill`. */
  pathSlug: z.string(),
  /** Page on this site. */
  url: z.string(),
})
export type SkillSummary = z.infer<typeof skillSummary>

const searchSkillsOutput = z.object({ results: z.array(skillSummary) })
export type SearchSkillsOutput = z.infer<typeof searchSkillsOutput>

const getSkillOutput = z.object({
  found: z.boolean(),
  name: z.string().optional(),
  url: z.string().optional(),
  markdown: z.string().optional(),
  truncated: z.boolean().optional(),
})
export type GetSkillOutput = z.infer<typeof getSkillOutput>

export const searchSkillsDef = toolDefinition({
  name: 'search_skills',
  description:
    'Full-text search over the UI skills directory (names, descriptions, authors, repos and topics). Returns the best matches, most relevant first. Use short keyword queries, and search again with other keywords if results are thin.',
  inputSchema: z.object({
    query: z.string().min(1).max(200).meta({ description: 'Keywords, e.g. "react animation"' }),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .meta({ description: 'Max results, default 8' }),
  }),
  outputSchema: searchSkillsOutput,
})

export const getSkillDef = toolDefinition({
  name: 'get_skill',
  description:
    "Read a skill's SKILL.md to answer detailed questions about what it covers or how to use it. Takes a pathSlug from search_skills.",
  inputSchema: z.object({
    pathSlug: z
      .string()
      .min(1)
      .max(200)
      .meta({ description: 'e.g. "vercel-labs/web-design-guidelines"' }),
  }),
  outputSchema: getSkillOutput,
})
