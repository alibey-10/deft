/**
 * Skill scan: looks through known authors' GitHub repos for SKILL.md files that aren't in the
 * directory yet, and for directory skills whose source file is gone.
 *
 * Flow: `start` (cron every 3 days, or manual) creates a `scanRuns` row and schedules one
 * `skillScanNode.scanAuthor` action per author. Each action reads GitHub and reports back through
 * `recordAuthorResult`, which writes findings and closes the run once every author has reported.
 *
 * Manual run: npx convex run skillScan:start '{"trigger":"manual"}'
 */
import { v, type ObjectType } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { internalMutation, internalQuery, query, type MutationCtx } from './_generated/server'
import { parseRawUrl } from './githubUrls'
import { vMissingReason } from './validators'

/** Spread author actions out so GitHub sees a steady trickle rather than a burst. */
const STAGGER_MS = 1500
/** A run still `running` after this long is treated as dead and doesn't block a new one. */
const STALE_RUN_MS = 6 * 60 * 60 * 1000
const MAX_RUN_ERRORS = 100
const REPORT_RUNS = 20
const REPORT_FINDINGS = 500

const isGithubAuthor = (author: Doc<'authors'>) =>
  author.profileUrl.toLowerCase().startsWith('https://github.com/')

export const start = internalMutation({
  args: { trigger: v.union(v.literal('cron'), v.literal('manual')) },
  handler: async (ctx, { trigger }) => {
    const latest = await ctx.db.query('scanRuns').withIndex('by_startedAt').order('desc').first()
    if (latest?.status === 'running' && Date.now() - latest.startedAt < STALE_RUN_MS) {
      console.log(`Scan ${latest._id} is still running; not starting another.`)
      return null
    }

    const authors = (await ctx.db.query('authors').collect()).filter(isGithubAuthor)
    const runId = await ctx.db.insert('scanRuns', {
      trigger,
      status: authors.length ? 'running' : 'done',
      startedAt: Date.now(),
      finishedAt: authors.length ? undefined : Date.now(),
      authorsTotal: authors.length,
      authorsDone: 0,
      reposScanned: 0,
      reposUnchanged: 0,
      baselined: 0,
      added: 0,
      newlyMissing: 0,
      restored: 0,
      errors: [],
    })
    authors.forEach((author, i) =>
      ctx.scheduler.runAfter(i * STAGGER_MS, internal.skillScanNode.scanAuthor, {
        runId,
        authorId: author._id,
      }),
    )
    return runId
  },
})

/** Everything `scanAuthor` needs from the database for one author. */
export const getAuthorState = internalQuery({
  args: { authorId: v.id('authors') },
  handler: async (ctx, { authorId }) => {
    const author = await ctx.db.get(authorId)
    if (!author) return null
    const skills = []
    for (const status of ['approved', 'missing', 'pending', 'rejected'] as const) {
      const rows = await ctx.db
        .query('skills')
        .withIndex('by_status_and_sourceKey', (q) =>
          q.eq('status', status).eq('sourceKey', author.key),
        )
        .collect()
      skills.push(...rows.map((s) => ({ _id: s._id, rawUrl: s.rawUrl, status: s.status })))
    }
    const repoScans = await ctx.db
      .query('repoScans')
      .withIndex('by_sourceKey', (q) => q.eq('sourceKey', author.key))
      .collect()
    return {
      key: author.key,
      login: author.login,
      lastScannedAt: author.lastScannedAt,
      skills,
      repoScans: repoScans.map((r) => ({
        key: r.key,
        pushedAt: r.pushedAt,
        skillPaths: r.skillPaths,
      })),
    }
  },
})

const vRepoScan = v.object({
  key: v.string(),
  owner: v.string(),
  repo: v.string(),
  defaultBranch: v.string(),
  pushedAt: v.optional(v.string()),
  skillPaths: v.array(v.string()),
})

const vAdded = v.object({
  repo: v.string(),
  path: v.string(),
  githubUrl: v.string(),
  rawUrl: v.string(),
  name: v.optional(v.string()),
  description: v.optional(v.string()),
})

const vAuthorResult = {
  runId: v.id('scanRuns'),
  authorId: v.id('authors'),
  /** False when the author's scan stopped early; `lastScannedAt` then stays put. */
  completed: v.boolean(),
  repoScans: v.array(vRepoScan),
  added: v.array(vAdded),
  /** Listed or hidden-missing skills whose source was checked; `missing` is null when found. */
  checks: v.array(
    v.object({ skillId: v.id('skills'), missing: v.union(vMissingReason, v.null()) }),
  ),
  reposScanned: v.number(),
  reposUnchanged: v.number(),
  baselined: v.number(),
  errors: v.array(v.object({ target: v.string(), message: v.string() })),
}

/** Upserts repo state and writes findings for one author. Returns the counts it added. */
async function applyResult(
  ctx: MutationCtx,
  args: ObjectType<typeof vAuthorResult>,
  author: Doc<'authors'>,
  now: number,
) {
  for (const scan of args.repoScans) {
    const row = { ...scan, sourceKey: author.key, scannedAt: now }
    const existing = await ctx.db
      .query('repoScans')
      .withIndex('by_key', (q) => q.eq('key', scan.key))
      .unique()
    if (existing) await ctx.db.patch(existing._id, row)
    else await ctx.db.insert('repoScans', row)
  }

  let added = 0
  for (const finding of args.added) {
    const known = await ctx.db
      .query('skills')
      .withIndex('by_rawUrl', (q) => q.eq('rawUrl', finding.rawUrl))
      .first()
    if (known) continue
    await ctx.db.insert('scanFindings', {
      ...finding,
      runId: args.runId,
      kind: 'added',
      sourceKey: author.key,
    })
    added++
  }

  let newlyMissing = 0
  let restored = 0
  for (const check of args.checks) {
    const skill = await ctx.db.get(check.skillId)
    if (!skill) continue
    const finding = {
      runId: args.runId,
      sourceKey: author.key,
      repo: `${skill.user}/${skill.repo}`,
      path: parseRawUrl(skill.rawUrl)?.path ?? skill.rawUrl,
      githubUrl: skill.githubUrl,
      rawUrl: skill.rawUrl,
      name: skill.name,
      description: skill.description,
      skillId: skill._id,
    }
    if (check.missing) {
      if (skill.missingSince === undefined) {
        await ctx.db.patch(skill._id, {
          status: 'missing',
          missingSince: now,
          missingScans: 1,
          missingReason: check.missing,
        })
        await ctx.db.insert('scanFindings', {
          ...finding,
          kind: 'missing',
          missingReason: check.missing,
        })
        newlyMissing++
      } else {
        await ctx.db.patch(skill._id, {
          status: 'missing',
          missingScans: (skill.missingScans ?? 0) + 1,
          missingReason: check.missing,
        })
      }
    } else if (skill.status === 'missing' || skill.missingSince !== undefined) {
      await ctx.db.patch(skill._id, {
        status: 'approved',
        missingSince: undefined,
        missingScans: undefined,
        missingReason: undefined,
      })
      await ctx.db.insert('scanFindings', { ...finding, kind: 'restored' })
      restored++
    }
  }
  return { added, newlyMissing, restored }
}

export const recordAuthorResult = internalMutation({
  args: vAuthorResult,
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run) return
    const author = await ctx.db.get(args.authorId)
    const now = Date.now()
    let added = 0
    let newlyMissing = 0
    let restored = 0
    // A deleted author still counts towards the run, or it would never finish.
    if (author) ({ added, newlyMissing, restored } = await applyResult(ctx, args, author, now))
    // Use the run's start so pushes made while the scan ran are picked up next time.
    if (author && args.completed) await ctx.db.patch(author._id, { lastScannedAt: run.startedAt })

    const authorsDone = run.authorsDone + 1
    const done = authorsDone >= run.authorsTotal
    await ctx.db.patch(run._id, {
      authorsDone,
      reposScanned: run.reposScanned + args.reposScanned,
      reposUnchanged: run.reposUnchanged + args.reposUnchanged,
      baselined: run.baselined + args.baselined,
      added: run.added + added,
      newlyMissing: run.newlyMissing + newlyMissing,
      restored: run.restored + restored,
      errors: [...run.errors, ...args.errors].slice(0, MAX_RUN_ERRORS),
      ...(done && { status: 'done' as const, finishedAt: now }),
    })
  },
})

/** Data for /admin/skills-update-report. Everything here is public GitHub data. */
export const report = query({
  args: { runId: v.optional(v.id('scanRuns')) },
  handler: async (ctx, { runId }) => {
    const runs = await ctx.db
      .query('scanRuns')
      .withIndex('by_startedAt')
      .order('desc')
      .take(REPORT_RUNS)
    const run = runId ? await ctx.db.get(runId) : runs[0]
    if (!run) return { runs, run: null, added: [], restored: [], missing: [] }

    const findings = (kind: Doc<'scanFindings'>['kind']) =>
      ctx.db
        .query('scanFindings')
        .withIndex('by_runId_and_kind', (q) => q.eq('runId', run._id).eq('kind', kind))
        .take(REPORT_FINDINGS)

    const missing = (
      await ctx.db
        .query('skills')
        .withIndex('by_missingSince', (q) => q.gt('missingSince', 0))
        .take(REPORT_FINDINGS)
    ).map((s) => ({
      _id: s._id,
      name: s.name,
      repo: `${s.user}/${s.repo}`,
      sourceKey: s.sourceKey,
      pathSlug: s.pathSlug,
      githubUrl: s.githubUrl,
      rawUrl: s.rawUrl,
      status: s.status,
      missingSince: s.missingSince!,
      missingScans: s.missingScans ?? 1,
      missingReason: s.missingReason,
    }))

    return {
      runs,
      run,
      added: await findings('added'),
      restored: await findings('restored'),
      missing,
    }
  },
})
