'use node'
/**
 * The GitHub side of the skill scan (see `convex/skillScan.ts` for the flow). Node runtime for the
 * memory headroom: recursive trees of large monorepos are several MB of JSON.
 *
 * Needs a GitHub token in the deployment env: npx convex env set GITHUB_TOKEN <token>
 */
import { v } from 'convex/values'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalAction } from './_generated/server'
import { githubUrlFor, parseRawUrl, rawUrlFor, repoKey, type RawUrlParts } from './githubUrls'
import type { MissingReason } from './validators'

const API = 'https://api.github.com'
const TREE_CONCURRENCY = 6
/** Repo trees read per author per scan; caps very active orgs. Repos over the cap are reported. */
const MAX_TREES_PER_AUTHOR = 150
/** On an author's first scan, repos created this recently count as new rather than baseline. */
const NEW_REPO_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000
/** SKILL.md files fetched per author to read their frontmatter for the report. */
const MAX_DETAIL_FETCHES = 40
/** Commit-history lookups per author for SKILL.md files in repos never read before. */
const MAX_HISTORY_CHECKS = 30

type GithubRepo = {
  name: string
  owner: { login: string }
  default_branch: string
  pushed_at: string | null
  created_at: string
  fork: boolean
  archived: boolean
  size: number
}

type Tree =
  | { kind: 'ok'; blobs: Set<string>; truncated: boolean }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }

type ScanError = { target: string; message: string }

class RateLimited extends Error {}

function githubFetch(url: string, token: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'skilly-skill-scan',
      Authorization: `Bearer ${token}`,
    },
  }).then((response) => {
    const limited =
      response.status === 429 ||
      (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')
    if (limited) {
      const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000
      throw new RateLimited(
        `GitHub rate limit hit${reset ? `; resets ${new Date(reset).toISOString()}` : ''}`,
      )
    }
    return response
  })
}

const describe = async (response: Response) =>
  `${response.status} ${(await response.text()).slice(0, 200)}`

/** Owned repos, most recently pushed first. With `since`, stops paging once repos get older. */
async function listRepos(login: string, token: string, since: number | undefined) {
  const repos: GithubRepo[] = []
  for (let page = 1; ; page++) {
    const response = await githubFetch(
      `${API}/users/${login}/repos?type=owner&sort=pushed&per_page=100&page=${page}`,
      token,
    )
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Listing repos: ${await describe(response)}`)
    const batch = (await response.json()) as GithubRepo[]
    repos.push(...batch)
    const oldest = batch.at(-1)?.pushed_at
    if (batch.length < 100) break
    if (since !== undefined && oldest && Date.parse(oldest) < since) break
  }
  return repos
}

async function getRepo(owner: string, repo: string, token: string) {
  const response = await githubFetch(`${API}/repos/${owner}/${repo}`, token)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await describe(response))
  return (await response.json()) as GithubRepo
}

/** Whether any commit on `branch` touched `path` before `until`, i.e. the file is not new. */
async function existedBefore(job: Job, path: string, until: number, token: string) {
  const params = new URLSearchParams({
    sha: job.defaultBranch,
    path,
    until: new Date(until).toISOString(),
    per_page: '1',
  })
  const response = await githubFetch(
    `${API}/repos/${job.owner}/${job.repo}/commits?${params}`,
    token,
  )
  if (!response.ok) throw new Error(`Commit history for ${path}: ${await describe(response)}`)
  return ((await response.json()) as unknown[]).length > 0
}

async function getTree(owner: string, repo: string, branch: string, token: string): Promise<Tree> {
  const response = await githubFetch(
    `${API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token,
  )
  if (response.status === 404) return { kind: 'not-found' }
  // 409: the repository is empty.
  if (response.status === 409) return { kind: 'ok', blobs: new Set(), truncated: false }
  if (!response.ok) return { kind: 'error', message: await describe(response) }
  const tree = (await response.json()) as {
    truncated: boolean
    tree: Array<{ path: string; type: string }>
  }
  return {
    kind: 'ok',
    truncated: tree.truncated,
    blobs: new Set(tree.tree.filter((e) => e.type === 'blob').map((e) => e.path)),
  }
}

/** Encoded form for URLs; stored paths stay decoded. */
const encodePath = (parts: RawUrlParts) => ({
  ...parts,
  path: parts.path.split('/').map(encodeURIComponent).join('/'),
})

const isSkillFile = (path: string) =>
  (path === 'SKILL.md' || path.endsWith('/SKILL.md')) && !path.includes('node_modules/')

/** `name` and `description` from SKILL.md frontmatter, including folded (`>`) values. */
function readFrontmatter(markdown: string) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1]
  if (!block) return {}
  const fields: Record<string, string> = {}
  let current: string | null = null
  for (const line of block.split(/\r?\n/)) {
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (pair) {
      current = pair[1]
      fields[current] = pair[2].replace(/^[>|][-+]?$/, '').replace(/^(['"])(.*)\1$/, '$2')
    } else if (current && /^\s+\S/.test(line)) {
      fields[current] = `${fields[current]} ${line.trim()}`.trim()
    } else {
      current = null
    }
  }
  return {
    name: fields.name || undefined,
    description: fields.description?.slice(0, 500) || undefined,
  }
}

/**
 * Run `fn` over `items`, at most `limit` at a time. On the first failure, stops taking new items,
 * lets in-flight ones finish, then rethrows, so results gathered so far are complete.
 */
async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items]
  let failure: { error: unknown } | undefined
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined && !failure; item = queue.shift()) {
        try {
          await fn(item)
        } catch (error) {
          failure ??= { error }
        }
      }
    }),
  )
  if (failure) throw failure.error
}

type Result = Omit<FunctionArgs<typeof internal.skillScan.recordAuthorResult>, 'runId' | 'authorId'>

export const scanAuthor = internalAction({
  args: { runId: v.id('scanRuns'), authorId: v.id('authors') },
  handler: async (ctx, { runId, authorId }) => {
    const result: Result = {
      completed: true,
      repoScans: [],
      added: [],
      checks: [],
      reposScanned: 0,
      reposUnchanged: 0,
      baselined: 0,
      errors: [],
    }
    let target: string = authorId
    try {
      const state = await ctx.runQuery(internal.skillScan.getAuthorState, { authorId })
      if (state) {
        target = state.login
        const token = process.env.GITHUB_TOKEN
        if (!token) throw new Error('GITHUB_TOKEN is not set on this deployment')
        await scan(state, token, result)
      }
    } catch (error) {
      result.completed = false
      result.errors.push({
        target,
        message: error instanceof Error ? error.message : String(error),
      })
    }
    await ctx.runMutation(internal.skillScan.recordAuthorResult, { runId, authorId, ...result })
  },
})

type AuthorState = NonNullable<FunctionReturnType<typeof internal.skillScan.getAuthorState>>

type TrackedRepo = {
  /** Every directory path in this repo, any status, so rejected skills aren't re-reported. */
  knownPaths: Set<string>
  /** Listed skills, plus ones hidden as missing so they can come back. */
  checked: Array<{ _id: Id<'skills'>; parts: RawUrlParts }>
}

type Job = {
  key: string
  owner: string
  repo: string
  defaultBranch: string
  pushedAt?: string
  createdAt?: string
  tracked?: TrackedRepo
}

async function scan(state: AuthorState, token: string, result: Result) {
  const now = Date.now()
  const since = state.lastScannedAt
  const newRepoSince = since ?? now - NEW_REPO_LOOKBACK_MS
  const previous = new Map(state.repoScans.map((r) => [r.key, r]))
  const errors: ScanError[] = result.errors

  const tracked = new Map<string, TrackedRepo & { owner: string; repo: string }>()
  for (const skill of state.skills) {
    const parts = parseRawUrl(skill.rawUrl)
    if (!parts) continue // Not hosted on GitHub; nothing to scan.
    const key = repoKey(parts.owner, parts.repo)
    let repo = tracked.get(key)
    if (!repo) {
      repo = { owner: parts.owner, repo: parts.repo, knownPaths: new Set(), checked: [] }
      tracked.set(key, repo)
    }
    repo.knownPaths.add(parts.path)
    if (skill.status === 'approved' || skill.status === 'missing')
      repo.checked.push({ _id: skill._id, parts })
  }

  // First scan: only repos created in the lookback window matter, and created implies pushed.
  const listed = await listRepos(state.login, token, since ?? newRepoSince)
  if (!listed) errors.push({ target: state.login, message: 'GitHub account not found (404)' })

  const jobs: Job[] = []
  const untracked: Job[] = []
  for (const r of listed ?? []) {
    const key = repoKey(r.owner.login, r.name)
    const job: Job = {
      key,
      owner: r.owner.login,
      repo: r.name,
      defaultBranch: r.default_branch,
      pushedAt: r.pushed_at ?? undefined,
      createdAt: r.created_at,
      tracked: tracked.get(key),
    }
    if (job.tracked) {
      jobs.push(job)
      continue
    }
    if (r.fork || r.archived || r.size === 0) continue
    const prev = previous.get(key)
    if (prev) {
      if (prev.pushedAt === job.pushedAt) {
        result.reposUnchanged++
        continue
      }
    } else if (since === undefined) {
      // First scan: read only brand-new repos. Older ones are read once they're next pushed.
      if (Date.parse(r.created_at) < newRepoSince) continue
    } else if (!r.pushed_at || Date.parse(r.pushed_at) < since) {
      continue // Untouched since the last scan; nothing new can be in it.
    }
    untracked.push(job)
  }
  const room = Math.max(0, MAX_TREES_PER_AUTHOR - jobs.length)
  if (untracked.length > room) {
    const skipped = untracked.slice(room).map((j) => j.repo)
    errors.push({
      target: state.login,
      message: `Skipped ${skipped.length} pushed repos over the per-scan cap: ${skipped.slice(0, 10).join(', ')}${skipped.length > 10 ? ', …' : ''}`,
    })
  }
  jobs.push(...untracked.slice(0, room))

  // Directory repos the listing didn't include (renamed, transferred, deleted, or listing failed).
  const listedKeys = new Set(jobs.map((j) => j.key))
  for (const [key, t] of tracked) {
    if (listedKeys.has(key) || !t.checked.length) continue
    const info = await getRepo(t.owner, t.repo, token).catch((error: Error) => {
      if (error instanceof RateLimited) throw error
      errors.push({ target: `${t.owner}/${t.repo}`, message: error.message })
      return undefined
    })
    if (info === undefined) continue
    if (info === null) {
      for (const s of t.checked) result.checks.push({ skillId: s._id, missing: 'repo-not-found' })
      continue
    }
    jobs.push({
      key,
      owner: t.owner,
      repo: t.repo,
      defaultBranch: info.default_branch,
      pushedAt: info.pushed_at ?? undefined,
      createdAt: info.created_at,
      tracked: t,
    })
  }

  let detailBudget = MAX_DETAIL_FETCHES
  let historyBudget = MAX_HISTORY_CHECKS
  await eachLimited(jobs, TREE_CONCURRENCY, async (job) => {
    const label = `${job.owner}/${job.repo}`
    const branches = new Set([
      job.defaultBranch,
      ...(job.tracked?.checked ?? []).map((s) => s.parts.branch),
    ])
    const trees = new Map<string, Tree>()
    for (const branch of branches)
      trees.set(branch, await getTree(job.owner, job.repo, branch, token))
    result.reposScanned++

    // Discovery, on the default branch.
    const tree = trees.get(job.defaultBranch)!
    if (tree.kind === 'ok') {
      const prev = previous.get(job.key)
      const known = job.tracked?.knownPaths ?? new Set<string>()
      const found = [...tree.blobs].filter(isSkillFile).sort()
      const unknown = found.filter((path) => !known.has(path))
      const isNewRepo = !!job.createdAt && Date.parse(job.createdAt) >= newRepoSince
      const seen = new Set(prev?.skillPaths)
      for (const path of unknown) {
        if (seen.has(path)) continue
        // Never read this repo before: a file is new only if it has no history before the last
        // scan. On the very first scan there is no "before", so everything is baseline.
        if (!prev && !isNewRepo) {
          if (since === undefined || historyBudget-- <= 0) {
            result.baselined++
            continue
          }
          if (await existedBefore(job, path, since, token)) {
            result.baselined++
            continue
          }
        }
        const parts = { owner: job.owner, repo: job.repo, branch: job.defaultBranch, path }
        const added = {
          repo: label,
          path,
          rawUrl: rawUrlFor(encodePath(parts)),
          githubUrl: githubUrlFor(encodePath(parts)),
        }
        if (detailBudget-- > 0) {
          const response = await fetch(added.rawUrl).catch(() => null)
          if (response?.ok) Object.assign(added, readFrontmatter(await response.text()))
        }
        result.added.push(added)
      }
      // A truncated tree can't prove a path is gone, so keep what was seen before.
      const skillPaths = tree.truncated
        ? [...new Set([...(prev?.skillPaths ?? []), ...found])]
        : found
      result.repoScans.push({
        key: job.key,
        owner: job.owner,
        repo: job.repo,
        defaultBranch: job.defaultBranch,
        pushedAt: job.pushedAt,
        skillPaths,
      })
      if (tree.truncated) errors.push({ target: label, message: 'Tree truncated; scan is partial' })
    } else {
      const message = tree.kind === 'error' ? tree.message : 'Default branch not found'
      errors.push({ target: label, message })
    }

    // Missing checks for directory skills, on each skill's own branch.
    for (const skill of job.tracked?.checked ?? []) {
      const branchTree = trees.get(skill.parts.branch)!
      if (branchTree.kind === 'error') continue // Unknown; don't flip state on a transient error.
      let missing: MissingReason | null = null
      if (branchTree.kind === 'not-found') missing = 'branch-not-found'
      else if (!branchTree.blobs.has(skill.parts.path)) {
        if (!branchTree.truncated) missing = 'file-not-found'
        else {
          const response = await fetch(rawUrlFor(encodePath(skill.parts)), {
            method: 'HEAD',
          }).catch(() => null)
          if (response?.status === 404) missing = 'file-not-found'
          else if (!response?.ok) continue
        }
      }
      result.checks.push({ skillId: skill._id, missing })
    }
  })
}
