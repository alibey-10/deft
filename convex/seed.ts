/**
 * Idempotent seed from the static registry. Driven by `scripts/seed-convex.ts`; internal only.
 * Authors are keyed on `key`, skills on `rawUrl`. Re-running only patches rows whose data changed.
 */
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { vTopicSlug } from './validators'

const vSeedAuthor = v.object({
  key: v.string(),
  login: v.string(),
  profileUrl: v.string(),
  avatarUrl: v.string(),
  name: v.optional(v.string()),
  bio: v.optional(v.string()),
  website: v.optional(v.string()),
  location: v.optional(v.string()),
  followers: v.optional(v.number()),
  profileFetchedAt: v.optional(v.number()),
})

const vSeedSkill = v.object({
  slug: v.string(),
  user: v.string(),
  repo: v.string(),
  rawUrl: v.string(),
  githubUrl: v.string(),
  name: v.string(),
  description: v.string(),
  topics: v.array(vTopicSlug),
  files: v.optional(v.array(v.string())),
  sourceKey: v.string(),
  pathSlug: v.string(),
})

/** Text the `search_text` index matches against: everything the home page search covers. */
export const skillSearchText = (skill: {
  name: string
  description: string
  user: string
  repo: string
  topics: string[]
}) => [skill.name, skill.description, skill.user, skill.repo, ...skill.topics].join(' ')

type Counts = { inserted: number; updated: number; unchanged: number }

/** True when every field in `next` already equals the stored value (deep, via JSON). */
const sameFields = (current: Record<string, unknown>, next: Record<string, unknown>) =>
  Object.keys(next).every((k) => JSON.stringify(current[k]) === JSON.stringify(next[k]))

export const upsertAuthors = internalMutation({
  args: { authors: v.array(vSeedAuthor) },
  handler: async (ctx, { authors }): Promise<Counts> => {
    const counts: Counts = { inserted: 0, updated: 0, unchanged: 0 }
    for (const author of authors) {
      const existing = await ctx.db
        .query('authors')
        .withIndex('by_key', (q) => q.eq('key', author.key))
        .unique()
      if (!existing) {
        await ctx.db.insert('authors', author)
        counts.inserted++
      } else if (sameFields(existing, author)) {
        counts.unchanged++
      } else {
        await ctx.db.patch(existing._id, author)
        counts.updated++
      }
    }
    return counts
  },
})

export const upsertSkills = internalMutation({
  args: { skills: v.array(vSeedSkill) },
  handler: async (ctx, { skills }): Promise<Counts> => {
    const counts: Counts = { inserted: 0, updated: 0, unchanged: 0 }
    const authorIds = new Map<string, Id<'authors'>>()

    for (const skill of skills) {
      if (skill.topics.length === 0) throw new Error(`Skill ${skill.rawUrl} has no topics`)

      let authorId = authorIds.get(skill.sourceKey)
      if (!authorId) {
        const author = await ctx.db
          .query('authors')
          .withIndex('by_key', (q) => q.eq('key', skill.sourceKey))
          .unique()
        if (!author) throw new Error(`No author "${skill.sourceKey}"; seed authors first`)
        authorId = author._id
        authorIds.set(skill.sourceKey, authorId)
      }

      const existing = await ctx.db
        .query('skills')
        .withIndex('by_rawUrl', (q) => q.eq('rawUrl', skill.rawUrl))
        .unique()
      const row = {
        ...skill,
        authorId,
        // Re-seeding must not re-list a skill the scan hid; the scan restores it when the file is back.
        status: existing?.status === 'missing' ? ('missing' as const) : ('approved' as const),
        searchText: skillSearchText(skill),
      }

      if (!existing) {
        await ctx.db.insert('skills', { ...row, updatedAt: Date.now() })
        counts.inserted++
      } else if (sameFields(existing, row)) {
        counts.unchanged++
      } else {
        await ctx.db.patch(existing._id, { ...row, updatedAt: Date.now() })
        counts.updated++
      }
    }
    return counts
  },
})

export const upsertRepos = internalMutation({
  args: {
    repos: v.array(
      v.object({
        key: v.string(),
        stars: v.number(),
        description: v.optional(v.string()),
        fetchedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, { repos }): Promise<Counts> => {
    const counts: Counts = { inserted: 0, updated: 0, unchanged: 0 }
    for (const repo of repos) {
      const existing = await ctx.db
        .query('repos')
        .withIndex('by_key', (q) => q.eq('key', repo.key))
        .unique()
      if (!existing) {
        await ctx.db.insert('repos', repo)
        counts.inserted++
      } else if (existing.stars === repo.stars && existing.description === repo.description) {
        counts.unchanged++
      } else {
        // `description: undefined` clears a description removed on GitHub.
        await ctx.db.patch(existing._id, { description: undefined, ...repo })
        counts.updated++
      }
    }
    return counts
  },
})

/**
 * One-off backfill of `searchText` for rows seeded before it existed. Safe to re-run.
 * Run: npx convex run seed:backfillSkills
 */
export const backfillSkills = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const { page, isDone, continueCursor } = await ctx.db
      .query('skills')
      .paginate({ cursor: cursor ?? null, numItems: 100 })
    for (const skill of page) {
      const searchText = skillSearchText(skill)
      if (skill.searchText !== searchText) await ctx.db.patch(skill._id, { searchText })
    }
    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.seed.backfillSkills, { cursor: continueCursor })
    }
  },
})
