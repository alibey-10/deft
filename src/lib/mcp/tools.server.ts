import { z } from 'zod'

import { api } from '../../../convex/_generated/api'
import { topicBySlug, topics } from '#/data/topics.ts'
import { buildInstallCommand } from '#/lib/install-command.ts'
import { getConvex, loadSkillMarkdown } from '#/lib/skill-source.server.ts'

/**
 * Read-only tools for Deft's public MCP server (`/mcp`). Everything here is already public on the
 * site, so there is no auth: every tool only reads approved skills.
 */

/** Keeps a long SKILL.md from flooding the agent's context. */
const MAX_MARKDOWN_CHARS = 40_000

type Skill = {
  name: string
  description: string
  user: string
  repo: string
  topics: string[]
  stars?: number
  pathSlug: string
  githubUrl: string
}

const summarize = (s: Skill, origin: string) => ({
  name: s.name,
  description: s.description,
  author: s.user,
  repo: `${s.user}/${s.repo}`,
  topics: s.topics,
  stars: s.stars ?? null,
  pathSlug: s.pathSlug,
  url: `${origin}/skills/${s.pathSlug}`,
  githubUrl: s.githubUrl,
  install: buildInstallCommand(s),
})

const pathSlug = z.string().min(1).max(200).meta({
  description:
    'The skill\'s pathSlug from search_skills, e.g. "vercel-labs/web-design-guidelines".',
})

type ToolContext = { origin: string }

type McpTool<S extends z.ZodObject> = {
  title: string
  description: string
  input: S
  handler: (args: z.infer<S>, ctx: ToolContext) => Promise<unknown>
}

const tool = <S extends z.ZodObject>(t: McpTool<S>) => t

export const mcpTools = {
  search_skills: tool({
    title: 'Search skills',
    description:
      'Full-text search over Deft, a directory of agent skills (SKILL.md files) for UI work: design, accessibility, motion, components, frameworks. Matches names, descriptions, authors, repos and topics; returns the most relevant first. Use short keyword queries and search again with synonyms if results are thin. Never recommend a skill that a search did not return.',
    input: z.object({
      query: z.string().min(1).max(200).meta({ description: 'Keywords, e.g. "react animation".' }),
      limit: z
        .number()
        .int()
        .min(1)
        .max(25)
        .optional()
        .meta({ description: 'Max results, default 10.' }),
    }),
    handler: async ({ query, limit }, { origin }) => {
      const { page } = await getConvex().query(api.directory.list, {
        q: query,
        paginationOpts: { numItems: limit ?? 10, cursor: null },
      })
      return { results: page.map((s) => summarize(s, origin)) }
    },
  }),

  get_skill: tool({
    title: 'Read a skill',
    description:
      "Read a skill's SKILL.md (or one of its extra reference files) to answer detailed questions about what it covers or to follow its instructions. Also returns the install command and the list of reference files you can read with `file`.",
    input: z.object({
      pathSlug,
      file: z.string().min(1).max(300).optional().meta({
        description:
          'A reference file from the `files` list, relative to SKILL.md. Omit for SKILL.md itself.',
      }),
    }),
    handler: async ({ pathSlug, file }, { origin }) => {
      const skill = await loadSkillMarkdown(pathSlug, file)
      if (!skill) {
        throw new ToolError(
          file
            ? `"${file}" is not one of this skill's files. Call get_skill without \`file\` to see the list.`
            : `No skill "${pathSlug}". Use search_skills to find its pathSlug.`,
        )
      }
      const truncated = skill.text.length > MAX_MARKDOWN_CHARS
      return {
        pathSlug,
        file: file ?? 'SKILL.md',
        url: `${origin}/skills/${pathSlug}`,
        sourceUrl: skill.url,
        files: skill.files,
        markdown: truncated ? skill.text.slice(0, MAX_MARKDOWN_CHARS) : skill.text,
        truncated,
      }
    },
  }),

  list_topics: tool({
    title: 'List topics',
    description:
      'List the topics skills are grouped under, with a one-line description each. Use a slug with browse_topic.',
    input: z.object({}),
    handler: async () => ({
      topics: topics.map((t) => ({ slug: t.slug, label: t.label, description: t.description })),
    }),
  }),

  browse_topic: tool({
    title: 'Browse a topic',
    description:
      'List the skills in one topic, most-starred first. Get topic slugs from list_topics. Prefer search_skills when the user describes a task rather than a category.',
    input: z.object({
      topic: z.string().min(1).max(60).meta({ description: 'Topic slug, e.g. "motion".' }),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .meta({ description: 'Max results, default 20.' }),
    }),
    handler: async ({ topic, limit }, { origin }) => {
      if (!topicBySlug.has(topic as never)) {
        throw new ToolError(`Unknown topic "${topic}". Call list_topics for valid slugs.`)
      }
      const { skills } = await getConvex().query(api.directory.get, {})
      const matches = skills
        .filter((s) => (s.topics as string[]).includes(topic))
        .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
      return {
        topic,
        total: matches.length,
        results: matches.slice(0, limit ?? 20).map((s) => summarize(s, origin)),
      }
    },
  }),
}

export type McpToolName = keyof typeof mcpTools

/** A failure the agent should see and can recover from (bad slug, unknown topic). */
export class ToolError extends Error {}
