import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { vMissingReason, vSkillStatus, vTopicSlug } from './validators'

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
    /** Last time the skill scan listed this author's repos (see `convex/skillScan.ts`). */
    lastScannedAt: v.optional(v.number()),
  }).index('by_key', ['key']),

  /** GitHub repo stats, refreshed by `scripts/update-repo-stars.ts`. */
  repos: defineTable({
    /** `<user>/<repo>` lowercased. */
    key: v.string(),
    stars: v.number(),
    fetchedAt: v.number(),
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
    /** Name, description, owner, repo and topics joined, for `search_text`. Set by the seed. */
    searchText: v.optional(v.string()),

    /** Set by the skill scan while the source file can't be found; cleared when it comes back. */
    missingSince: v.optional(v.number()),
    /** Consecutive scans that couldn't find the source file. */
    missingScans: v.optional(v.number()),
    /** Why the last scan considered it missing. */
    missingReason: v.optional(vMissingReason),
  })
    .index('by_status', ['status'])
    .index('by_status_and_name', ['status', 'name'])
    .index('by_status_and_sourceKey', ['status', 'sourceKey'])
    .index('by_pathSlug', ['pathSlug'])
    .index('by_rawUrl', ['rawUrl'])
    .searchIndex('search_text', { searchField: 'searchText', filterFields: ['status'] })
    .index('by_missingSince', ['missingSince']),

  /**
   * What the skill scan last saw in each GitHub repo of a known author. Kept apart from `repos`
   * because the directory query reads every `repos` row and these hold path lists.
   */
  repoScans: defineTable({
    /** `<owner>/<repo>` lowercased. */
    key: v.string(),
    owner: v.string(),
    repo: v.string(),
    /** Author key (lowercased owner). */
    sourceKey: v.string(),
    defaultBranch: v.string(),
    /** GitHub `pushed_at`; an untracked repo is only re-read when this changes. */
    pushedAt: v.optional(v.string()),
    /** Every SKILL.md path on the default branch at the last scan. */
    skillPaths: v.array(v.string()),
    scannedAt: v.number(),
  })
    .index('by_key', ['key'])
    .index('by_sourceKey', ['sourceKey']),

  /** One row per scan; counters are filled in as each author finishes. */
  scanRuns: defineTable({
    trigger: v.union(v.literal('cron'), v.literal('manual')),
    status: v.union(v.literal('running'), v.literal('done')),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    authorsTotal: v.number(),
    authorsDone: v.number(),
    reposScanned: v.number(),
    /** Untracked repos skipped because nothing was pushed since the last scan. */
    reposUnchanged: v.number(),
    /** SKILL.md files recorded on a repo's first scan without being reported as new. */
    baselined: v.number(),
    added: v.number(),
    newlyMissing: v.number(),
    restored: v.number(),
    /** Capped; see `MAX_RUN_ERRORS`. */
    errors: v.array(v.object({ target: v.string(), message: v.string() })),
  }).index('by_startedAt', ['startedAt']),

  /** What a scan found: a SKILL.md not in the directory, or a directory skill that went missing or came back. */
  scanFindings: defineTable({
    runId: v.id('scanRuns'),
    kind: v.union(v.literal('added'), v.literal('missing'), v.literal('restored')),
    sourceKey: v.string(),
    /** `<owner>/<repo>` as written. */
    repo: v.string(),
    path: v.string(),
    githubUrl: v.string(),
    rawUrl: v.string(),
    /** From SKILL.md frontmatter (added), or the directory skill (missing/restored). */
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    skillId: v.optional(v.id('skills')),
    missingReason: v.optional(vMissingReason),
  })
    .index('by_runId_and_kind', ['runId', 'kind'])
    .index('by_kind', ['kind']),
})
