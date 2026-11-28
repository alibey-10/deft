/**
 * Skill submissions from the site header's "Submit" dialog, and their review at /admin/submissions.
 *
 * `submit` takes a GitHub link to a SKILL.md (or a folder of skills). It checks the skill isn't
 * already in the directory (any status, so rejected skills stay out), reads the file's frontmatter
 * for its name and description, and asks the discovery classifier (`convex/classifier.ts`) whether
 * it's a UI skill and which topics fit. Skills it judges not UI are turned away. Skills from repos with
 * `AUTO_APPROVE_STARS`+ stars go straight into the directory; the rest are stored as `pending`
 * for an admin to approve (assigning author and page path, as discovery does) or reject.
 *
 * `submit` is gated by a shared server `secret` (checked against `SUBMIT_TOKEN`, falling back to
 * `ADMIN_TOKEN`) and rate-limited per hashed `clientKey` and globally via `@convex-dev/rate-limiter`,
 * so browsers must call through the site's server function (`submitSkillServerFn`) and cannot bypass
 * rate limits by hitting Convex directly.
 *
 * Review functions take `secret`, compared with ADMIN_TOKEN in the deployment env; the site's
 * server functions pass the Worker's ADMIN_TOKEN after checking the admin cookie, so the token
 * never reaches the browser. Needs `npx convex env set ADMIN_TOKEN <same value as the Worker>`
 * and GITHUB_TOKEN (shared with the skill scan).
 */
import { ConvexError, v, type Infer } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from './_generated/server'
import {
  RateLimited,
  eachLimited,
  encodePath,
  getRepo,
  getTree,
  getUser,
  isSkillFile,
  readFrontmatter,
  type Tree,
} from './github'
import {
  githubUrlFor,
  isExpectedGithubUrl,
  isExpectedRawUrl,
  parseRawUrl,
  parseSkillUrl,
  rawUrlFor,
  repoKey,
} from './githubUrls'
import { rateLimiter } from './rateLimits'
import { skillSearchText } from './seed'
import { ensureAuthor, freePathSlug, vAuthor } from './skillDiscovery'
import { classify } from './classifier'
import {
  CLASSIFY_BATCH,
  canonicalSkillPaths,
  fileKey,
  skillFiles,
  skillExcerpt,
  skillFingerprint,
  slugFromPath,
} from './skillDiscoveryRules'
import { vSkillStatus, vTopicSlug } from './validators'

/** Submissions from repos with at least this many GitHub stars skip review. */
export const AUTO_APPROVE_STARS = 10
const MAX_REASON_CHARS = 500
const PENDING_LIMIT = 100
/** Skills submitted at most from one folder link. */
const MAX_FOLDER_SKILLS = 20
/** SKILL.md files read at once for a folder link. */
const READ_CONCURRENCY = 5

/** A skill already in the directory that a submission matches. */
const vExisting = v.object({
  status: vSkillStatus,
  name: v.string(),
  pathSlug: v.optional(v.string()),
  /** `file`: same SKILL.md (or same folder in the same repo). `copy`: same name and description. */
  match: v.union(v.literal('file'), v.literal('copy')),
})
type Existing = Infer<typeof vExisting>

/** A skill in the submitted folder that wasn't added, and why. */
const vSkipped = v.object({
  name: v.string(),
  /** `not-ui`: the classifier judged it outside the directory's scope. */
  reason: v.union(v.literal('exists'), v.literal('no-frontmatter'), v.literal('not-ui')),
  existing: v.optional(vExisting),
})
type Skipped = Infer<typeof vSkipped>

const vAdded = v.object({
  name: v.string(),
  topics: v.array(vTopicSlug),
  pathSlug: v.optional(v.string()),
})
type Added = Infer<typeof vAdded>

const vSubmitResult = v.union(
  /**
   * The skills added; a folder link can add several. Each has a `pathSlug` when it was approved
   * straight away (see `AUTO_APPROVE_STARS`), and is pending review otherwise.
   */
  v.object({ ok: v.literal(true), added: v.array(vAdded), skipped: v.array(vSkipped) }),
  /** A single-skill link to a skill that's already known. */
  v.object({ ok: v.literal(false), error: v.literal('exists'), existing: vExisting }),
  /** A folder link where every skill was skipped. */
  v.object({ ok: v.literal(false), error: v.literal('nothing-new'), skipped: v.array(vSkipped) }),
  v.object({
    ok: v.literal(false),
    error: v.union(
      v.literal('invalid-url'),
      v.literal('repo-not-found'),
      v.literal('file-not-found'),
      v.literal('no-frontmatter'),
      v.literal('not-ui'),
      v.literal('rate-limited'),
      v.literal('busy'),
      /** The classifier couldn't be reached; nothing was stored. */
      v.literal('unavailable'),
    ),
  }),
)
type SubmitResult = Infer<typeof vSubmitResult>

const vCandidate = v.object({
  owner: v.string(),
  repo: v.string(),
  path: v.string(),
  rawUrl: v.string(),
  githubUrl: v.string(),
  name: v.string(),
  description: v.string(),
  files: v.array(v.string()),
  /** Chosen by the classifier. */
  topics: v.array(vTopicSlug),
})
type Candidate = Infer<typeof vCandidate>

/** Auto-approve only when the repo is popular and its GitHub tree lookup succeeded. */
export const shouldAutoApprove = (stars: number, treeKind: Tree['kind']) =>
  stars >= AUTO_APPROVE_STARS && treeKind === 'ok'

/** Defense-in-depth verification that candidate URLs belong to `candidate.owner/candidate.repo`. */
export function assertValidCandidateUrls(
  candidate: Pick<Candidate, 'owner' | 'repo' | 'rawUrl' | 'githubUrl'>,
) {
  if (
    !isExpectedRawUrl(candidate.rawUrl, candidate.owner, candidate.repo) ||
    !isExpectedGithubUrl(candidate.githubUrl, candidate.owner, candidate.repo)
  ) {
    throw new ConvexError('Invalid skill URL')
  }
}

/** The error for a single-skill link whose skill was skipped. */
const skippedError = (skip: Skipped): SubmitResult =>
  skip.reason === 'exists' && skip.existing
    ? { ok: false, error: 'exists', existing: skip.existing }
    : { ok: false, error: skip.reason === 'not-ui' ? 'not-ui' : 'no-frontmatter' }

const toExisting = (skill: Doc<'skills'>, match: Existing['match']): Existing => ({
  status: skill.status,
  name: skill.name,
  match,
  ...(skill.pathSlug && { pathSlug: skill.pathSlug }),
})

/**
 * The directory skill with the same SKILL.md as `owner/repo/path`, ignoring branch and casing. A
 * skill with the same folder name in the same repo counts too: repos often ship one skill to
 * several agent folders (`.claude/skills/x`, `skills/x`…).
 */
async function findSameFile(ctx: QueryCtx, owner: string, repo: string, path: string) {
  const key = repoKey(owner, repo)
  const wantedFile = fileKey(key, path)
  const wantedSlug = slugFromPath(path, repo)
  for (const status of ['approved', 'missing', 'pending', 'rejected'] as const) {
    const rows = await ctx.db
      .query('skills')
      .withIndex('by_status_and_sourceKey', (q) =>
        q.eq('status', status).eq('sourceKey', owner.toLowerCase()),
      )
      .collect()
    for (const skill of rows) {
      const parts = parseRawUrl(skill.rawUrl)
      if (!parts || repoKey(parts.owner, parts.repo) !== key) continue
      if (
        fileKey(key, parts.path) === wantedFile ||
        slugFromPath(parts.path, parts.repo) === wantedSlug
      )
        return skill
    }
  }
  return null
}

/** A directory skill with the same name and description, published anywhere. */
async function findCopy(ctx: QueryCtx, name: string, description: string) {
  const wanted = skillFingerprint(name, description)
  if (!wanted) return null
  for await (const skill of ctx.db.query('skills')) {
    if (skillFingerprint(skill.name, skill.description) === wanted) return skill
  }
  return null
}

export const findExisting = internalQuery({
  args: { owner: v.string(), repo: v.string(), path: v.string() },
  returns: v.union(vExisting, v.null()),
  handler: async (ctx, { owner, repo, path }) => {
    const skill = await findSameFile(ctx, owner, repo, path)
    return skill ? toExisting(skill, 'file') : null
  },
})

/**
 * Checks a pasted link, reads its SKILL.md, lets the classifier pick its topics and stores it. A
 * link to a folder without its own SKILL.md submits every skill inside it (up to
 * `MAX_FOLDER_SKILLS`), skipping ones already known, missing frontmatter, or not about UI.
 */
export const submit = action({
  args: { url: v.string(), secret: v.string(), clientKey: v.string() },
  returns: vSubmitResult,
  handler: async (ctx, args): Promise<SubmitResult> => {
    assertSubmitSecret(args.secret)
    const clientKey = normalizeClientKey(args.clientKey)

    const pasted = args.url.length <= 2000 ? parseSkillUrl(args.url) : null
    if (!pasted) return { ok: false, error: 'invalid-url' }

    const allowed = await checkSubmitRateLimits(
      (name, key) =>
        name === 'submitPerIp'
          ? rateLimiter.limit(ctx, 'submitPerIp', { key })
          : rateLimiter.limit(ctx, 'submitGlobal'),
      clientKey,
    )
    if (!allowed) return { ok: false, error: 'rate-limited' }

    const token = process.env.GITHUB_TOKEN
    if (!token) throw new Error('GITHUB_TOKEN is not set on this deployment')
    const openrouterKey = process.env.OPENROUTER_API_KEY
    if (!openrouterKey) throw new Error('OPENROUTER_API_KEY is not set on this deployment')

    try {
      // The repo's real owner and name casing, following renames.
      const info = await getRepo(pasted.owner, pasted.repo, token)
      if (!info) return { ok: false, error: 'repo-not-found' }
      const parts = { ...pasted, owner: info.owner.login, repo: info.name }
      const tree = await getTree(parts.owner, parts.repo, parts.branch, token)

      // One skill, or every skill under the linked folder. Without a full tree, trust the link.
      const single = tree.kind !== 'ok' || tree.truncated || tree.blobs.has(parts.path)
      const dir = parts.path.slice(0, -'SKILL.md'.length)
      const paths = single
        ? [parts.path]
        : canonicalSkillPaths(
            [...tree.blobs].filter((p) => p.startsWith(dir) && isSkillFile(p)),
            parts.repo,
          ).slice(0, MAX_FOLDER_SKILLS)
      if (!paths.length) return { ok: false, error: 'file-not-found' }

      const targets = paths.map((path) => {
        const encoded = encodePath({ ...parts, path })
        return {
          path,
          rawUrl: rawUrlFor(encoded),
          githubUrl: githubUrlFor(encoded),
        }
      })
      if (
        targets.some(
          ({ rawUrl, githubUrl }) =>
            !isExpectedRawUrl(rawUrl, parts.owner, parts.repo) ||
            !isExpectedGithubUrl(githubUrl, parts.owner, parts.repo),
        )
      ) {
        return { ok: false, error: 'invalid-url' }
      }

      const skipped: Skipped[] = []
      const read: Array<{ candidate: Omit<Candidate, 'topics'>; body: string }> = []
      let notFound = false
      await eachLimited(targets, READ_CONCURRENCY, async ({ path, rawUrl, githubUrl }) => {
        const slug = slugFromPath(path, parts.repo)
        const existing = await ctx.runQuery(internal.submissions.findExisting, {
          owner: parts.owner,
          repo: parts.repo,
          path,
        })
        if (existing) {
          skipped.push({ name: existing.name, reason: 'exists', existing })
          return
        }
        const response = await fetch(rawUrl)
        if (response.status === 404) {
          notFound = true
          return
        }
        if (!response.ok) throw new Error(`Couldn't read ${path}: ${response.status}`)
        const markdown = await response.text()
        const { name, description } = readFrontmatter(markdown)
        if (!name || !description) {
          skipped.push({ name: name ?? slug, reason: 'no-frontmatter' })
          return
        }
        read.push({
          body: skillExcerpt(markdown),
          candidate: {
            owner: parts.owner,
            repo: parts.repo,
            path,
            rawUrl,
            githubUrl,
            name,
            description,
            files: tree.kind === 'ok' ? skillFiles(path, tree.blobs) : [],
          },
        })
      })
      if (single && notFound) return { ok: false, error: 'file-not-found' }

      // The classifier decides whether each skill belongs and picks its topics.
      const candidates: Candidate[] = []
      for (let i = 0; i < read.length; i += CLASSIFY_BATCH) {
        const batch = read.slice(i, i + CLASSIFY_BATCH)
        const items = batch.map(({ candidate, body }, j) => ({
          id: String(j + 1),
          name: candidate.name,
          description: candidate.description,
          path: candidate.path,
          body,
        }))
        const verdicts = await classify(items, openrouterKey).catch(() =>
          // One retry, as discovery does.
          classify(items, openrouterKey).catch(() => null),
        )
        if (!verdicts) return { ok: false, error: 'unavailable' }
        batch.forEach(({ candidate }, j) => {
          const verdict = verdicts.get(String(j + 1))
          if (verdict?.ui) candidates.push({ ...candidate, topics: verdict.topics })
          else skipped.push({ name: candidate.name, reason: 'not-ui' })
        })
      }

      // Keep the folder's order so the result reads like the repo.
      candidates.sort((a, b) => a.path.localeCompare(b.path))
      // Popular repos skip review; their author gets a GitHub profile like discovered ones do.
      const autoApprove = shouldAutoApprove(info.stargazers_count, tree.kind)
      const author =
        autoApprove && candidates.length
          ? await getUser(parts.owner, token).catch((error: unknown) => {
              if (error instanceof RateLimited) throw error
              return null
            })
          : null
      const inserted = candidates.length
        ? await ctx.runMutation(internal.submissions.insert, {
            skills: candidates,
            ...(autoApprove && {
              approve: {
                repo: {
                  key: repoKey(parts.owner, parts.repo),
                  stars: info.stargazers_count,
                  ...(info.description?.trim() && { description: info.description.trim() }),
                },
                ...(author && {
                  author: {
                    login: author.login,
                    profileUrl: author.html_url,
                    avatarUrl: author.avatar_url,
                    ...(author.name && { name: author.name }),
                    ...(author.bio && { bio: author.bio }),
                    ...(author.blog && { website: author.blog }),
                    ...(author.location && { location: author.location }),
                    followers: author.followers,
                  },
                }),
              },
            }),
          })
        : { added: [], skipped: [] }
      skipped.push(...inserted.skipped)

      if (!inserted.added.length) {
        if (single && skipped[0]) return skippedError(skipped[0])
        return { ok: false, error: 'nothing-new', skipped }
      }
      return { ok: true, added: inserted.added, skipped }
    } catch (error) {
      if (error instanceof RateLimited) return { ok: false, error: 'busy' }
      throw error
    }
  },
})

/**
 * Stores read skills, re-checking each for duplicates (including each other). With `approve` they
 * go straight into the directory, and the repo's stars are recorded; otherwise they're pending.
 */
export const insert = internalMutation({
  args: {
    skills: v.array(vCandidate),
    approve: v.optional(
      v.object({
        repo: v.object({ key: v.string(), stars: v.number(), description: v.optional(v.string()) }),
        author: v.optional(vAuthor),
      }),
    ),
  },
  returns: v.object({ added: v.array(vAdded), skipped: v.array(vSkipped) }),
  handler: async (ctx, { skills, approve }) => {
    const now = Date.now()
    const profiles = new Map(
      approve?.author ? [[approve.author.login.toLowerCase(), approve.author]] : [],
    )
    const added: Added[] = []
    const skipped: Skipped[] = []
    for (const candidate of skills) {
      assertValidCandidateUrls(candidate)
      // Checked again here: two people can submit the same skill at once.
      const sameFile = await findSameFile(ctx, candidate.owner, candidate.repo, candidate.path)
      const copy = sameFile ? null : await findCopy(ctx, candidate.name, candidate.description)
      const known = sameFile ?? copy
      if (known) {
        const existing = toExisting(known, sameFile ? 'file' : 'copy')
        skipped.push({ name: candidate.name, reason: 'exists', existing })
        continue
      }
      const skill = {
        slug: slugFromPath(candidate.path, candidate.repo),
        user: candidate.owner,
        repo: candidate.repo,
        rawUrl: candidate.rawUrl,
        githubUrl: candidate.githubUrl,
        name: candidate.name,
        description: candidate.description,
        topics: candidate.topics,
        ...(candidate.files.length && { files: candidate.files }),
      }
      const sourceKey = candidate.owner.toLowerCase()
      // Falls back to review in the rare case every page path is taken.
      const pathSlug = approve
        ? await freePathSlug(ctx, sourceKey, candidate.repo.toLowerCase(), skill.slug)
        : null
      if (pathSlug) {
        const author = await ensureAuthor(ctx, candidate.owner, profiles, now)
        await ctx.db.insert('skills', {
          ...skill,
          sourceKey,
          authorId: author.id,
          pathSlug,
          status: 'approved',
          submitterNote: `Approved automatically: repo has ${AUTO_APPROVE_STARS}+ stars`,
          reviewedAt: now,
          updatedAt: now,
          searchText: skillSearchText(skill),
        })
        added.push({ name: candidate.name, topics: candidate.topics, pathSlug })
      } else {
        await ctx.db.insert('skills', {
          ...skill,
          sourceKey,
          status: 'pending',
          updatedAt: now,
          searchText: skillSearchText(skill),
        })
        added.push({ name: candidate.name, topics: candidate.topics })
      }
    }

    // Stars for the directory's listing, as discovery records them.
    if (approve && added.some((a) => a.pathSlug)) {
      const row = { ...approve.repo, fetchedAt: now }
      const existing = await ctx.db
        .query('repos')
        .withIndex('by_key', (q) => q.eq('key', row.key))
        .unique()
      if (existing) await ctx.db.patch('repos', existing._id, { description: undefined, ...row })
      else await ctx.db.insert('repos', row)
    }
    return { added, skipped }
  },
})

/** Constant-time string comparison to avoid short-circuiting on the first mismatched character. */
export function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Verifies `secret` against `expected` in constant time, failing closed if `expected` is unset. */
export function assertSecret(secret: string, expected: string | undefined) {
  if (!expected || !constantTimeEqual(secret, expected)) throw new ConvexError('Not authorized')
}

/** Verifies the server submission `secret` against `SUBMIT_TOKEN` (falling back to `ADMIN_TOKEN`). */
export function assertSubmitSecret(
  secret: string,
  env: { SUBMIT_TOKEN?: string; ADMIN_TOKEN?: string } = process.env,
) {
  assertSecret(secret, env.SUBMIT_TOKEN || env.ADMIN_TOKEN)
}

/** Validates and trims a non-PII `clientKey` (hashed IP) passed from the server function. */
export function normalizeClientKey(raw: string) {
  const key = raw.trim()
  if (!key || key.length > 128) throw new ConvexError('Invalid client key')
  return key
}

/**
 * Enforces the per-IP limit before the global limit so one abusive IP cannot exhaust global quota
 * for other callers.
 */
export async function checkSubmitRateLimits(
  limitFn: (name: 'submitPerIp' | 'submitGlobal', key?: string) => Promise<{ ok: boolean }>,
  clientKey: string,
) {
  const perIp = await limitFn('submitPerIp', clientKey)
  if (!perIp.ok) return false
  const global = await limitFn('submitGlobal')
  return global.ok
}

/** Constant-time check of `secret` against ADMIN_TOKEN. */
function requireAdmin(secret: string) {
  assertSecret(secret, process.env.ADMIN_TOKEN)
}

/** Submissions waiting for review, oldest first. */
export const listPending = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireAdmin(secret)
    const rows = await ctx.db
      .query('skills')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .take(PENDING_LIMIT)
    return rows.map((s) => ({
      _id: s._id,
      _creationTime: s._creationTime,
      name: s.name,
      description: s.description,
      user: s.user,
      repo: s.repo,
      githubUrl: s.githubUrl,
      topics: s.topics,
      files: s.files ?? [],
    }))
  },
})

/** Approves a pending skill into the directory, or rejects it. */
export const review = mutation({
  args: {
    secret: v.string(),
    skillId: v.id('skills'),
    decision: v.union(v.literal('approve'), v.literal('reject')),
    /** Replaces the submitted topics on approval. */
    topics: v.optional(v.array(vTopicSlug)),
    reason: v.optional(v.string()),
  },
  returns: v.union(v.object({ pathSlug: v.string() }), v.null()),
  handler: async (ctx, args) => {
    requireAdmin(args.secret)
    const skill = await ctx.db.get('skills', args.skillId)
    if (!skill || skill.status !== 'pending')
      throw new ConvexError('That submission was already reviewed')
    const now = Date.now()

    if (args.decision === 'reject') {
      const reason = args.reason?.trim().slice(0, MAX_REASON_CHARS)
      await ctx.db.patch('skills', skill._id, {
        status: 'rejected',
        reviewedAt: now,
        updatedAt: now,
        ...(reason && { rejectionReason: reason }),
      })
      return null
    }

    const topics = args.topics ? [...new Set(args.topics)] : skill.topics
    if (topics.length < 1) throw new ConvexError('Pick at least one topic')
    const pathSlug = await freePathSlug(ctx, skill.sourceKey, skill.repo.toLowerCase(), skill.slug)
    if (!pathSlug) throw new ConvexError(`No free page path for ${skill.user}/${skill.slug}`)
    const author = await ensureAuthor(ctx, skill.user, new Map(), now)
    await ctx.db.patch('skills', skill._id, {
      topics,
      authorId: author.id,
      pathSlug,
      status: 'approved',
      reviewedAt: now,
      updatedAt: now,
      searchText: skillSearchText({ ...skill, topics }),
    })
    return { pathSlug }
  },
})
