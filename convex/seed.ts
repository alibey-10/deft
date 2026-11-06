/**
 * Idempotent seed from the static registry. Driven by `scripts/seed-convex.ts`; internal only.
 * Authors are keyed on `key`, skills on `rawUrl`. Re-running only patches rows whose data changed.
 */
import { v } from 'convex/values'
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

      const row = { ...skill, authorId, status: 'approved' as const }
      const existing = await ctx.db
        .query('skills')
        .withIndex('by_rawUrl', (q) => q.eq('rawUrl', skill.rawUrl))
        .unique()

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
  args: { repos: v.array(v.object({ key: v.string(), stars: v.number(), fetchedAt: v.number() })) },
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
      } else if (existing.stars === repo.stars) {
        counts.unchanged++
      } else {
        await ctx.db.patch(existing._id, repo)
        counts.updated++
      }
    }
    return counts
  },
})
