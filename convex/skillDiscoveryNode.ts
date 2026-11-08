'use node'
/**
 * The crawling side of skills.sh discovery (see `convex/skillDiscovery.ts` for the flow). Node
 * runtime for the memory headroom: recursive trees of large monorepos are several MB of JSON.
 *
 * Needs in the deployment env:
 *   npx convex env set FIRECRAWL_API_KEY <key>
 *   npx convex env set GITHUB_TOKEN <token>   (shared with the skill scan)
 *   npx convex env set OPENROUTER_API_KEY <key>
 */
import { v } from 'convex/values'
import type { FunctionArgs } from 'convex/server'
import { internal } from './_generated/api'
import { internalAction, type ActionCtx } from './_generated/server'
import {
  RateLimited,
  describe,
  eachLimited,
  encodePath,
  getRepo,
  getTree,
  getUser,
  isSkillFile,
  readFrontmatter,
  type GithubRepo,
  type ScanError,
} from './github'
import { classify } from './classifier'
import { githubUrlFor, rawUrlFor, repoKey } from './githubUrls'
import {
  CLASSIFY_BATCH,
  TRENDING_URL,
  canonicalSkillPaths,
  fileKey,
  isPopular,
  parseTrendingSkills,
  skillExcerpt,
  skillFiles,
  skillFingerprint,
  slugFromPath,
  type Verdict,
} from './skillDiscoveryRules'

const FIRECRAWL_SCRAPE = 'https://api.firecrawl.dev/v2/scrape'
const CONCURRENCY = 6
const CLASSIFY_CONCURRENCY = 4
/** SKILL.md files read per run. Files over the budget are picked up by the next run. */
const MAX_SKILL_READS = 300
/** SKILL.md files read per repo per run, so one big monorepo can't use the whole budget. */
const MAX_READS_PER_REPO = 40

type RecordArgs = FunctionArgs<typeof internal.skillDiscovery.recordRun>
type Result = RecordArgs['results'][number]
/** A skill's place on the trending page. */
type Listing = { rank: number; installs: number }

/** The page's raw HTML. `maxAge: 0` skips Firecrawl's cache, which defaults to two days. */
async function scrapeHtml(url: string, apiKey: string) {
  const response = await fetch(FIRECRAWL_SCRAPE, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['rawHtml'], maxAge: 0 }),
  })
  if (!response.ok) throw new Error(`Firecrawl: ${await describe(response)}`)
  const body = (await response.json()) as {
    success?: boolean
    data?: { rawHtml?: string; metadata?: { statusCode?: number } }
    error?: string
  }
  if (!body.success || !body.data?.rawHtml)
    throw new Error(`Firecrawl: ${body.error ?? 'no HTML in the response'}`)
  // Firecrawl reports success even when the page itself errored.
  const status = body.data.metadata?.statusCode
  if (status && (status < 200 || status >= 300)) throw new Error(`${url} returned ${status}`)
  return body.data.rawHtml
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

export const discover = internalAction({
  args: { runId: v.id('discoveryRuns') },
  handler: async (ctx, { runId }) => {
    const record: Omit<RecordArgs, 'runId'> = {
      failed: false,
      listed: 0,
      reposRead: 0,
      alreadyKnown: 0,
      belowThreshold: 0,
      results: [],
      authors: [],
      repos: [],
      errors: [],
    }
    try {
      await discoverInto(ctx, record)
    } catch (error) {
      record.failed = true
      record.errors.unshift({ target: TRENDING_URL, message: message(error) })
    }
    try {
      await ctx.runMutation(internal.skillDiscovery.recordRun, { runId, ...record })
    } catch (error) {
      await ctx.runMutation(internal.skillDiscovery.markFailed, { runId, message: message(error) })
      throw error
    }
  },
})

async function discoverInto(ctx: ActionCtx, record: Omit<RecordArgs, 'runId'>) {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY
  if (!firecrawlKey) throw new Error('FIRECRAWL_API_KEY is not set on this deployment')
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN is not set on this deployment')
  const openrouterKey = process.env.OPENROUTER_API_KEY
  if (!openrouterKey) throw new Error('OPENROUTER_API_KEY is not set on this deployment')
  const errors: ScanError[] = record.errors

  const listed = parseTrendingSkills(await scrapeHtml(TRENDING_URL, firecrawlKey))
  record.listed = listed.length
  // An empty list means the page changed shape, not that nothing is trending.
  if (!listed.length)
    throw new Error('No skills found in the page data; its layout may have changed')

  // One entry per repo, remembering each listed skill's rank and installs by slug.
  const groups = new Map<string, { owner: string; repo: string; ranks: Map<string, Listing> }>()
  for (const item of listed) {
    const key = repoKey(item.owner, item.repo)
    const group = groups.get(key) ?? { owner: item.owner, repo: item.repo, ranks: new Map() }
    const slug = item.skill.toLowerCase()
    if (!group.ranks.has(slug)) group.ranks.set(slug, { rank: item.rank, installs: item.installs })
    groups.set(key, group)
  }

  // Repo details first: they give the real owner/name casing (and follow renames) for matching.
  // Keyed by the real name, so two links that resolve to one renamed repo read it once.
  const byKey = new Map<string, { info: GithubRepo; ranks: Map<string, Listing> }>()
  await eachLimited([...groups.values()], CONCURRENCY, async (group) => {
    const label = `${group.owner}/${group.repo}`
    try {
      const info = await getRepo(group.owner, group.repo, token)
      if (!info) {
        errors.push({ target: label, message: 'Repo not found on GitHub (404)' })
        return
      }
      const key = repoKey(info.owner.login, info.name)
      const entry = byKey.get(key)
      if (!entry) byKey.set(key, { info, ranks: group.ranks })
      else
        for (const [skill, rank] of group.ranks)
          if (!entry.ranks.has(skill)) entry.ranks.set(skill, rank)
    } catch (error) {
      if (error instanceof RateLimited) throw error
      errors.push({ target: label, message: message(error) })
    }
  })
  const topRank = (ranks: Map<string, Listing>) =>
    Math.min(...[...ranks.values()].map((l) => l.rank))
  const repos = [...byKey.values()].sort((a, b) => topRank(a.ranks) - topRank(b.ranks))
  record.repos = [...byKey].map(([key, { info }]) => ({
    key,
    stars: info.stargazers_count,
    description: info.description?.trim() || undefined,
  }))

  const {
    known: knownList,
    authorKeys,
    fingerprints,
  } = await ctx.runQuery(internal.skillDiscovery.getKnown, {
    repoKeys: record.repos.map((r) => r.key),
  })
  const known = new Set(knownList)
  /** Files read this run, waiting for the copy check and the model. */
  const read: Array<{ result: Omit<Result, 'verdict'>; body: string }> = []

  let budget = MAX_SKILL_READS
  let overBudget = 0
  await eachLimited(repos, CONCURRENCY, async ({ info, ranks }) => {
    const owner = info.owner.login
    const repo = info.name
    const label = `${owner}/${repo}`
    const tree = await getTree(owner, repo, info.default_branch, token)
    if (tree.kind !== 'ok') {
      errors.push({
        target: label,
        message: tree.kind === 'error' ? tree.message : 'Default branch not found',
      })
      return
    }
    record.reposRead++
    if (tree.truncated) errors.push({ target: label, message: 'Tree truncated; read is partial' })

    // Listed skills first, by rank; the rest of the repo after, so grouped siblings are found too.
    // Folder names already in the directory or judged, wherever their copy lives.
    const prefix = `${repoKey(owner, repo)}/`
    const knownSlugs = new Set(
      knownList
        .filter((k) => k.startsWith(prefix))
        .map((k) => slugFromPath(k.slice(prefix.length), repo)),
    )
    const paths = canonicalSkillPaths([...tree.blobs].filter(isSkillFile), repo)
      .map((path) => ({ path, listing: ranks.get(slugFromPath(path, repo)) }))
      .sort(
        (a, b) =>
          (a.listing?.rank ?? Infinity) - (b.listing?.rank ?? Infinity) ||
          a.path.localeCompare(b.path),
      )

    let repoBudget = MAX_READS_PER_REPO
    for (const { path, listing } of paths) {
      if (
        known.has(fileKey(repoKey(owner, repo), path)) ||
        knownSlugs.has(slugFromPath(path, repo))
      ) {
        record.alreadyKnown++
        continue
      }
      // Not recorded, so a later run reconsiders it once the repo has more stars.
      if (!isPopular(info.stargazers_count, listing?.installs)) {
        record.belowThreshold++
        continue
      }
      if (repoBudget <= 0 || budget <= 0) {
        overBudget++
        continue
      }
      repoBudget--
      budget--
      const parts = encodePath({ owner, repo, branch: info.default_branch, path })
      const rawUrl = rawUrlFor(parts)
      const response = await fetch(rawUrl).catch((error: unknown) => error)
      if (!(response instanceof Response) || !response.ok) {
        const reason = response instanceof Response ? response.status : message(response)
        errors.push({ target: `${label}/${path}`, message: `Couldn't read SKILL.md: ${reason}` })
        continue
      }
      const markdown = await response.text()
      const files = skillFiles(path, tree.blobs)
      read.push({
        body: skillExcerpt(markdown),
        result: {
          owner,
          repo,
          path,
          slug: slugFromPath(path, repo),
          rawUrl,
          githubUrl: githubUrlFor(parts),
          ...readFrontmatter(markdown),
          topics: [],
          ...(files.length && { files }),
          stars: info.stargazers_count,
          ...(listing && { trendingRank: listing.rank, installs: listing.installs }),
        },
      })
    }
  })

  // Copies: the same name and description as a known skill, or as a better-ranked file this run.
  read.sort(
    (a, b) =>
      (a.result.trendingRank ?? Infinity) - (b.result.trendingRank ?? Infinity) ||
      b.result.stars - a.result.stars,
  )
  const seen = new Map(fingerprints.map((f) => [f.fingerprint, f.of]))
  const toJudge: typeof read = []
  for (const item of read) {
    const fingerprint = skillFingerprint(item.result.name, item.result.description)
    const original = fingerprint ? seen.get(fingerprint) : undefined
    if (original) {
      record.results.push({ ...item.result, verdict: 'duplicate', duplicateOf: original })
      continue
    }
    if (fingerprint)
      seen.set(fingerprint, `${item.result.owner}/${item.result.repo}/${item.result.path}`)
    toJudge.push(item)
  }

  // The model decides what's a UI skill. A batch that fails twice is left for the next run.
  const batches: Array<typeof toJudge> = []
  for (let i = 0; i < toJudge.length; i += CLASSIFY_BATCH)
    batches.push(toJudge.slice(i, i + CLASSIFY_BATCH))
  let unjudged = 0
  await eachLimited(batches, CLASSIFY_CONCURRENCY, async (batch) => {
    const items = batch.map((item, i) => ({ ...item.result, id: String(i + 1), body: item.body }))
    let verdicts: Map<string, Verdict> | undefined
    for (let attempt = 0; attempt < 2 && !verdicts; attempt++)
      verdicts = await classify(items, openrouterKey).catch((error: unknown) => {
        if (attempt === 1) errors.push({ target: 'Classifier', message: message(error) })
        return undefined
      })
    batch.forEach((item, i) => {
      const verdict = verdicts?.get(String(i + 1))
      if (!verdict) {
        unjudged++
        return
      }
      record.results.push({
        ...item.result,
        verdict: verdict.ui ? 'ui' : 'not-ui',
        topics: verdict.topics,
        reason: verdict.reason,
      })
    })
  })
  if (unjudged)
    errors.push({
      target: 'Classifier',
      message: `${unjudged} skills couldn't be judged and are left for the next run`,
    })
  if (overBudget)
    errors.push({
      target: TRENDING_URL,
      message: `${overBudget} SKILL.md files left for the next run (read limit reached)`,
    })

  // Profiles for authors this run will create.
  const knownAuthors = new Set(authorKeys)
  const newOwners = [
    ...new Set(record.results.filter((r) => r.verdict === 'ui').map((r) => r.owner.toLowerCase())),
  ].filter((key) => !knownAuthors.has(key))
  await eachLimited(newOwners, CONCURRENCY, async (login) => {
    try {
      const user = await getUser(login, token)
      if (!user) return
      record.authors.push({
        login: user.login,
        profileUrl: user.html_url,
        avatarUrl: user.avatar_url,
        name: user.name ?? undefined,
        bio: user.bio ?? undefined,
        website: user.blog || undefined,
        location: user.location ?? undefined,
        followers: user.followers,
      })
    } catch (error) {
      if (error instanceof RateLimited) throw error
      errors.push({ target: login, message: `Profile: ${message(error)}` })
    }
  })
}
