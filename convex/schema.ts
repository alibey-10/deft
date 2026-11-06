import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { vSkillStatus, vTopicSlug } from './validators'

export default defineSchema({
  /** One row per skill source owner (usually a GitHub user or org). */
  authors: defineTable({
    /** Lowercased login, used in URLs. Same value as `skills.sourceKey`. */
    key: v.string(),
    /** Login as written. */
    login: v.string(),
    /** GitHub profile, or the site for non-GitHub sources. */
    profileUrl: v.string(),
    avatarUrl: v.string(),
    // GitHub profile snapshot; unset when never fetched or not on GitHub.
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    website: v.optional(v.string()),
    location: v.optional(v.string()),
    followers: v.optional(v.number()),
    profileFetchedAt: v.optional(v.number()),
  }).index('by_key', ['key']),

  skills: defineTable({
    slug: v.string(),
    /** Owner as written; resolves to an author on approval. */
    user: v.string(),
    repo: v.string(),
    /** Natural key for seeding and duplicate checks. */
    rawUrl: v.string(),
    githubUrl: v.string(),
    name: v.string(),
    description: v.string(),
    /** At least one; enforced in mutations. */
    topics: v.array(vTopicSlug),
    /** Extra markdown files in the skill folder, relative to SKILL.md. */
    files: v.optional(v.array(v.string())),

    /** `user` lowercased; same value as `authors.key`. */
    sourceKey: v.string(),
    /** Set on approval. */
    authorId: v.optional(v.id('authors')),
    /** `<user>/<slug>`, or `<user>/<repo>/<slug>` on collision. Assigned on approval. */
    pathSlug: v.optional(v.string()),

    status: vSkillStatus,
    submitterNote: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_status_and_sourceKey', ['status', 'sourceKey'])
    .index('by_pathSlug', ['pathSlug'])
    .index('by_rawUrl', ['rawUrl']),
})
