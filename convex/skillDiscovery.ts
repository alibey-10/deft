/**
 * skills.sh discovery: crawls https://skills.sh/trending with Firecrawl, reads every GitHub repo it
 * links to, and adds the SKILL.md files that look like UI skills straight to the directory as
 * `approved`, if the repo has 50+ stars or the skill 100+ installs (see `isPopular`). Everything it classifies is kept in `discoveryCandidates`, so each file is judged once.
 *
 * The UI decision is made by a DeepSeek model through OpenRouter (see `CLASSIFIER_MODEL`). Skills
 * whose name and description match a known one are recorded as copies and never added.
 *
 * Flow: `start` (cron every 2 days, or manual) creates a `discoveryRuns` row and schedules
 * `skillDiscoveryNode.discover`, which crawls and reads GitHub, then reports through `recordRun`.
 *
 * Needs FIRECRAWL_API_KEY, GITHUB_TOKEN and OPENROUTER_API_KEY in the deployment env.
 * Manual run: npx convex run skillDiscovery:start '{"trigger":"manual"}'
 */
import { v, type Infer } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, internalQuery, query, type MutationCtx } from './_generated/server'
import { parseRawUrl, repoKey } from './githubUrls'
import { skillSearchText } from './seed'
import { TRENDING_URL, fileKey, skillFingerprint } from './skillDiscoveryRules'
import { vTopicSlug } from './validators'

/** A run still `running` after this long is treated as dead and doesn't block a new one. */
const STALE_RUN_MS = 60 * 60 * 1000
const MAX_RUN_ERRORS = 100
const REPORT_RUNS = 20
const REPORT_CANDIDATES = 500

export const start = internalMutation({
  args: { trigger: v.union(v.literal('cron'), v.literal('manual')) },
  handler: async (ctx, { trigger }) => {
    const latest = await ctx.db
      .query('discoveryRuns')
      .withIndex('by_startedAt')
      .order('desc')
      .first()
    if (latest?.status === 'running' && Date.now() - latest.startedAt < STALE_RUN_MS) {
      console.log(`Discovery ${latest._id} is still running; not starting another.`)
      return null
    }
    const runId = await ctx.db.insert('discoveryRuns', {
      trigger,
      status: 'running',
      startedAt: Date.now(),
      pages: [TRENDING_URL],
      listed: 0,
      reposRead: 0,
      alreadyKnown: 0,
      belowThreshold: 0,
      evaluated: 0,
      added: 0,
      notUi: 0,
      duplicates: 0,
      authorsAdded: 0,
      errors: [],
    })
    await ctx.scheduler.runAfter(0, internal.skillDiscoveryNode.discover, { runId })
    return runId
  },
})

/**
 * For the given repos: every SKILL.md already in the directory (any status, so rejected skills
 * stay out) or already classified, and which of their owners are known authors.
 */
export const getKnown = internalQuery({
  args: { repoKeys: v.array(v.string()) },
  handler: async (ctx, { repoKeys }) => {
    const known: string[] = []
    const authorKeys: string[] = []
    const wanted = new Set(repoKeys)
    const owners = new Set(repoKeys.map((key) => key.split('/')[0]))
    for (const owner of owners) {
      const author = await ctx.db
        .query('authors')
        .withIndex('by_key', (q) => q.eq('key', owner))
        .unique()
      if (author) authorKeys.push(owner)
      for (const status of ['approved', 'missing', 'pending', 'rejected'] as const) {
        const rows = await ctx.db
          .query('skills')
          .withIndex('by_status_and_sourceKey', (q) =>
            q.eq('status', status).eq('sourceKey', owner),
          )
          .collect()
        for (const skill of rows) {
          const parts = parseRawUrl(skill.rawUrl)
          if (!parts) continue
          const key = repoKey(parts.owner, parts.repo)
          if (wanted.has(key)) known.push(fileKey(key, parts.path))
        }
      }
    }
    for (const key of repoKeys) {
      const rows = await ctx.db
        .query('discoveryCandidates')
        .withIndex('by_repoKey', (q) => q.eq('repoKey', key))
        .collect()
      for (const row of rows) known.push(fileKey(key, row.path))
    }
    // Name + description of everything known, to spot copies published under other repos.
    const fingerprints: Array<{ fingerprint: string; of: string }> = []
    for (const skill of await ctx.db.query('skills').collect()) {
      const fingerprint = skillFingerprint(skill.name, skill.description)
      if (fingerprint) fingerprints.push({ fingerprint, of: skill.pathSlug ?? skill.githubUrl })
    }
    for (const row of await ctx.db.query('discoveryCandidates').collect()) {
      const fingerprint = skillFingerprint(row.name, row.description)
      if (fingerprint && row.verdict !== 'duplicate')
        fingerprints.push({ fingerprint, of: `${row.repo}/${row.path}` })
    }
    return { known, authorKeys, fingerprints }
  },
})

const vResult = v.object({
  owner: v.string(),
  repo: v.string(),
  path: v.string(),
  slug: v.string(),
  rawUrl: v.string(),
  githubUrl: v.string(),
  name: v.optional(v.string()),
  description: v.optional(v.string()),
  verdict: v.union(v.literal('ui'), v.literal('not-ui'), v.literal('duplicate')),
  /** Chosen by the classifier for UI skills; empty otherwise. */
  topics: v.array(vTopicSlug),
  /** The classifier's one-line reason. */
  reason: v.optional(v.string()),
  /** `<owner>/<repo>/<path>` or directory name of the skill this one copies. */
  duplicateOf: v.optional(v.string()),
  files: v.optional(v.array(v.string())),
  trendingRank: v.optional(v.number()),
  installs: v.optional(v.number()),
  stars: v.number(),
})

const vAuthor = v.object({
  login: v.string(),
  profileUrl: v.string(),
  avatarUrl: v.string(),
  name: v.optional(v.string()),
  bio: v.optional(v.string()),
  website: v.optional(v.string()),
  location: v.optional(v.string()),
  followers: v.optional(v.number()),
})

/**
 * `<user>/<slug>`, then `<user>/<repo>/<slug>`, then numbered, as the registry does on collision.
 * Null when every option is taken.
 */
async function freePathSlug(ctx: MutationCtx, user: string, repo: string, slug: string) {
  const options = [`${user}/${slug}`, `${user}/${repo}/${slug}`]
  for (let n = 2; options.length < 12; n++) options.push(`${user}/${repo}/${slug}-${n}`)
  for (const pathSlug of options) {
    const taken = await ctx.db
      .query('skills')
      .withIndex('by_pathSlug', (q) => q.eq('pathSlug', pathSlug))
      .first()
    if (!taken) return pathSlug
  }
  return null
}

/** The author row for `login`, created from its GitHub profile (or a bare one) if new. */
async function ensureAuthor(
  ctx: MutationCtx,
  login: string,
  profiles: Map<string, Infer<typeof vAuthor>>,
  now: number,
): Promise<{ id: Id<'authors'>; created: boolean }> {
  const key = login.toLowerCase()
  const existing = await ctx.db
    .query('authors')
    .withIndex('by_key', (q) => q.eq('key', key))
    .unique()
  if (existing) return { id: existing._id, created: false }
  const profile = profiles.get(key)
  const id = await ctx.db.insert('authors', {
    key,
    login: profile?.login ?? login,
    profileUrl: profile?.profileUrl ?? `https://github.com/${login}`,
    avatarUrl: `https://github.com/${profile?.login ?? login}.png?size=80`,
    ...(profile && {
      name: profile.name,
      bio: profile.bio,
      website: profile.website,
      location: profile.location,
      followers: profile.followers,
      profileFetchedAt: now,
    }),
  })
  return { id, created: true }
}

export const recordRun = internalMutation({
  args: {
    runId: v.id('discoveryRuns'),
    failed: v.boolean(),
    listed: v.number(),
    reposRead: v.number(),
    alreadyKnown: v.number(),
    belowThreshold: v.number(),
    results: v.array(vResult),
    authors: v.array(vAuthor),
    repos: v.array(v.object({ key: v.string(), stars: v.number() })),
    errors: v.array(v.object({ target: v.string(), message: v.string() })),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run) return
    const now = Date.now()

    for (const repo of args.repos) {
      const existing = await ctx.db
        .query('repos')
        .withIndex('by_key', (q) => q.eq('key', repo.key))
        .unique()
      const row = { ...repo, fetchedAt: now }
      if (existing) await ctx.db.patch(existing._id, row)
      else await ctx.db.insert('repos', row)
    }

    const profiles = new Map(args.authors.map((a) => [a.login.toLowerCase(), a]))
    let added = 0
    let notUi = 0
    let duplicates = 0
    let authorsAdded = 0
    let alreadyKnown = args.alreadyKnown
    const errors = [...args.errors]
    for (const result of args.results) {
      // Guards against a skill added since the action read the known list.
      const [known, judged] = await Promise.all([
        ctx.db
          .query('skills')
          .withIndex('by_rawUrl', (q) => q.eq('rawUrl', result.rawUrl))
          .first(),
        ctx.db
          .query('discoveryCandidates')
          .withIndex('by_rawUrl', (q) => q.eq('rawUrl', result.rawUrl))
          .first(),
      ])
      if (known || judged) {
        alreadyKnown++
        continue
      }

      const candidate = {
        runId: run._id,
        rawUrl: result.rawUrl,
        githubUrl: result.githubUrl,
        repoKey: repoKey(result.owner, result.repo),
        repo: `${result.owner}/${result.repo}`,
        path: result.path,
        name: result.name,
        description: result.description,
        topics: result.topics,
        trendingRank: result.trendingRank,
        installs: result.installs,
        stars: result.stars,
        reason: result.reason,
        duplicateOf: result.duplicateOf,
      }
      if (result.verdict === 'duplicate') {
        await ctx.db.insert('discoveryCandidates', { ...candidate, verdict: 'duplicate' })
        duplicates++
        continue
      }
      if (result.verdict === 'not-ui' || result.topics.length === 0) {
        await ctx.db.insert('discoveryCandidates', { ...candidate, verdict: 'not-ui' })
        notUi++
        continue
      }

      const user = result.owner.toLowerCase()
      const pathSlug = await freePathSlug(ctx, user, result.repo.toLowerCase(), result.slug)
      if (!pathSlug) {
        // Left unrecorded, so a later run tries again; one bad skill mustn't sink the run.
        errors.push({ target: candidate.repo, message: `No free page path for ${result.path}` })
        continue
      }
      const author = await ensureAuthor(ctx, result.owner, profiles, now)
      if (author.created) authorsAdded++
      const skill = {
        slug: result.slug,
        user: result.owner,
        repo: result.repo,
        rawUrl: result.rawUrl,
        githubUrl: result.githubUrl,
        name: result.name ?? result.slug,
        description: result.description ?? '',
        topics: result.topics,
        ...(result.files?.length && { files: result.files }),
      }
      const skillId = await ctx.db.insert('skills', {
        ...skill,
        sourceKey: user,
        authorId: author.id,
        pathSlug,
        status: 'approved',
        submitterNote: 'Added automatically from skills.sh trending',
        reviewedAt: now,
        updatedAt: now,
        searchText: skillSearchText(skill),
      })
      await ctx.db.insert('discoveryCandidates', { ...candidate, verdict: 'added', skillId })
      added++
    }

    await ctx.db.patch(run._id, {
      status: args.failed ? 'failed' : 'done',
      finishedAt: now,
      listed: args.listed,
      belowThreshold: args.belowThreshold,
      reposRead: args.reposRead,
      alreadyKnown,
      evaluated: added + notUi,
      added,
      notUi,
      duplicates,
      authorsAdded,
      errors: errors.slice(0, MAX_RUN_ERRORS),
    })
  },
})

/** Closes a run whose results couldn't be saved, so it doesn't sit at `running`. */
export const markFailed = internalMutation({
  args: { runId: v.id('discoveryRuns'), message: v.string() },
  handler: async (ctx, { runId, message }) => {
    const run = await ctx.db.get(runId)
    if (!run || run.status !== 'running') return
    await ctx.db.patch(runId, {
      status: 'failed',
      finishedAt: Date.now(),
      errors: [{ target: 'Saving results', message }, ...run.errors].slice(0, MAX_RUN_ERRORS),
    })
  },
})

/**
 * Undoes a run: deletes the skills it added, its candidate rows (so those files are judged again)
 * and authors it left with no skills, then the run itself. Skills someone edited since are kept.
 * Run: npx convex run skillDiscovery:undoRun '{"runId":"..."}'
 */
export const undoRun = internalMutation({
  args: { runId: v.id('discoveryRuns') },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (!run) throw new Error('No such run')
    if (run.status === 'running') throw new Error('Run is still going')
    let skillsDeleted = 0
    let skillsKept = 0
    const owners = new Set<string>()
    for (const verdict of ['added', 'not-ui', 'duplicate'] as const) {
      const rows = await ctx.db
        .query('discoveryCandidates')
        .withIndex('by_runId_and_verdict', (q) => q.eq('runId', runId).eq('verdict', verdict))
        .collect()
      for (const row of rows) {
        const skill = row.skillId ? await ctx.db.get(row.skillId) : null
        if (skill && skill.updatedAt === skill.reviewedAt) {
          await ctx.db.delete(skill._id)
          owners.add(skill.sourceKey)
          skillsDeleted++
        } else if (skill) skillsKept++
        await ctx.db.delete(row._id)
      }
    }
    let authorsDeleted = 0
    for (const key of owners) {
      // Any status counts: a rejected or pending skill still needs its author.
      const other = await ctx.db
        .query('skills')
        .filter((q) => q.eq(q.field('sourceKey'), key))
        .first()
      if (other) continue
      const author = await ctx.db
        .query('authors')
        .withIndex('by_key', (q) => q.eq('key', key))
        .unique()
      if (author) {
        await ctx.db.delete(author._id)
        authorsDeleted++
      }
    }
    await ctx.db.delete(runId)
    return { skillsDeleted, skillsKept, authorsDeleted }
  },
})

/** Data for /admin/skills-discovery-report. Everything here is public GitHub and skills.sh data. */
export const report = query({
  args: { runId: v.optional(v.id('discoveryRuns')) },
  handler: async (ctx, { runId }) => {
    const runs = await ctx.db
      .query('discoveryRuns')
      .withIndex('by_startedAt')
      .order('desc')
      .take(REPORT_RUNS)
    const run = runId ? await ctx.db.get(runId) : runs[0]
    if (!run) return { runs, run: null, added: [], notUi: [], duplicates: [] }

    const candidates = (verdict: Doc<'discoveryCandidates'>['verdict']) =>
      ctx.db
        .query('discoveryCandidates')
        .withIndex('by_runId_and_verdict', (q) => q.eq('runId', run._id).eq('verdict', verdict))
        .take(REPORT_CANDIDATES)

    const added = await Promise.all(
      (await candidates('added')).map(async (c) => {
        const skill = c.skillId ? await ctx.db.get(c.skillId) : null
        return {
          ...c,
          pathSlug: skill?.pathSlug,
          status: skill?.status,
          // Gone when someone deleted the skill after it was added.
          exists: !!skill,
        }
      }),
    )
    return {
      runs,
      run,
      added,
      notUi: await candidates('not-ui'),
      duplicates: await candidates('duplicate'),
    }
  },
})
