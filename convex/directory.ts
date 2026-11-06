import { v } from 'convex/values'
import { query, type QueryCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { skillsByName } from './aggregates'

const repoKey = (s: Doc<'skills'>) => `${s.user}/${s.repo}`.toLowerCase()

/** The public shape of an approved skill. Null for a row without a pathSlug. */
function toListedSkill(s: Doc<'skills'>, stars: number | undefined) {
  // Approval always assigns a pathSlug; skip any row that somehow lacks one.
  if (!s.pathSlug) return null
  return {
    slug: s.slug,
    pathSlug: s.pathSlug,
    sourceKey: s.sourceKey,
    user: s.user,
    repo: s.repo,
    rawUrl: s.rawUrl,
    githubUrl: s.githubUrl,
    name: s.name,
    description: s.description,
    topics: s.topics,
    files: s.files,
    /** When the skill joined the directory: approval time, else row creation. */
    addedAt: s.reviewedAt ?? s._creationTime,
    stars,
  }
}

/** Public skills for a handful of rows, looking up only the repos they need. */
async function toListedSkills(ctx: QueryCtx, rows: Doc<'skills'>[]) {
  const stars = new Map<string, number | undefined>()
  for (const key of new Set(rows.map(repoKey))) {
    const repo = await ctx.db
      .query('repos')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique()
    stars.set(key, repo?.stars)
  }
  return rows.flatMap((s) => {
    const skill = toListedSkill(s, stars.get(repoKey(s)))
    return skill ? [skill] : []
  })
}

/** Approved skills a full-text search can return; Convex caps search results at 1024. */
const SEARCH_LIMIT = 1024

/**
 * One numbered page of approved skills: by name, or by relevance when `q` is set.
 * Pages past the end clamp to the last page.
 */
export const listPage = query({
  args: { page: v.number(), pageSize: v.number(), q: v.optional(v.string()) },
  handler: async (ctx, { page, pageSize, q }) => {
    const size = Math.min(Math.max(1, Math.floor(pageSize)), 100)
    const search = q?.trim()

    if (search) {
      const matches = await ctx.db
        .query('skills')
        .withSearchIndex('search_text', (s) =>
          s.search('searchText', search).eq('status', 'approved'),
        )
        .take(SEARCH_LIMIT)
      const pageCount = Math.max(1, Math.ceil(matches.length / size))
      const current = Math.min(Math.max(1, Math.floor(page)), pageCount)
      const rows = matches.slice((current - 1) * size, current * size)
      return {
        skills: await toListedSkills(ctx, rows),
        total: matches.length,
        page: current,
        pageCount,
      }
    }

    const namespace = 'approved' as const
    const total = await skillsByName.count(ctx, { namespace })
    const pageCount = Math.max(1, Math.ceil(total / size))
    const current = Math.min(Math.max(1, Math.floor(page)), pageCount)
    if (total === 0) return { skills: [], total, page: current, pageCount }

    // Jump to the first item of the page, then read the page's ids from the aggregate.
    const first = await skillsByName.at(ctx, (current - 1) * size, { namespace })
    const { page: items } = await skillsByName.paginate(ctx, {
      namespace,
      bounds: { lower: { key: first.key, id: first.id, inclusive: true } },
      pageSize: size,
    })
    const rows = (await Promise.all(items.map((item) => ctx.db.get(item.id)))).filter(
      (row): row is Doc<'skills'> => row !== null,
    )
    return { skills: await toListedSkills(ctx, rows), total, page: current, pageCount }
  },
})

/**
 * Everything the directory UI needs: approved skills plus their authors. The dataset is small,
 * so grouping by topic and author happens on the client (see `src/lib/directory.ts`).
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('skills')
      .withIndex('by_status', (q) => q.eq('status', 'approved'))
      .collect()

    const stars = new Map(
      (await ctx.db.query('repos').collect()).map((r) => [r.key, r.stars] as const),
    )

    const skills = rows.flatMap((s) => {
      const skill = toListedSkill(s, stars.get(repoKey(s)))
      return skill ? [skill] : []
    })

    const authorKeys = new Set(skills.map((s) => s.sourceKey))
    const authors = (await ctx.db.query('authors').collect())
      .filter((a) => authorKeys.has(a.key))
      .map((a) => ({
        key: a.key,
        login: a.login,
        profileUrl: a.profileUrl,
        avatarUrl: a.avatarUrl,
        name: a.name,
        bio: a.bio,
        website: a.website,
        location: a.location,
        followers: a.followers,
        profileFetchedAt: a.profileFetchedAt,
      }))

    return { skills, authors }
  },
})

/** Where to fetch an approved skill's markdown from. Used by the `fetchSkillMarkdown` server fn. */
export const getSkillSource = query({
  args: { pathSlug: v.string() },
  handler: async (ctx, { pathSlug }) => {
    const skill = await ctx.db
      .query('skills')
      .withIndex('by_pathSlug', (q) => q.eq('pathSlug', pathSlug))
      .unique()
    if (!skill || skill.status !== 'approved') return null
    return { rawUrl: skill.rawUrl, files: skill.files ?? [] }
  },
})
