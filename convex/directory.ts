import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { query, type QueryCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'

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

/**
 * Approved skills a page at a time, for infinite scroll: newest first, or by relevance when `q` is
 * set. "Newest" is approval time; seeded skills have none and follow, newest row first.
 */
export const list = query({
  args: { paginationOpts: paginationOptsValidator, q: v.optional(v.string()) },
  handler: async (ctx, { paginationOpts, q }) => {
    const search = q?.trim()
    const opts = { ...paginationOpts, numItems: Math.min(paginationOpts.numItems, 100) }
    const result = search
      ? await ctx.db
          .query('skills')
          .withSearchIndex('search_text', (s) =>
            s.search('searchText', search).eq('status', 'approved'),
          )
          .paginate(opts)
      : await ctx.db
          .query('skills')
          .withIndex('by_status_and_reviewedAt', (s) => s.eq('status', 'approved'))
          .order('desc')
          .paginate(opts)
    return { ...result, page: await toListedSkills(ctx, result.page) }
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
