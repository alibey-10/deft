import { v } from 'convex/values'
import { query } from './_generated/server'

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

    const skills = rows.flatMap((s) =>
      // Approval always assigns a pathSlug; skip any row that somehow lacks one.
      s.pathSlug
        ? [
            {
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
            },
          ]
        : [],
    )

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
