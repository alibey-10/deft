/**
 * Fetch the GitHub star count and "About" description for every registry repo and write it to Convex (`repos` table).
 *
 * Auth: uses $GITHUB_TOKEN, falling back to `gh auth token`.
 * Run: vp run update-repo-stars            (dev deployment from .env.local)
 *      vp run update-repo-stars -- --prod  (production)
 */
import { execFileSync, execSync } from 'node:child_process'

import { registry } from '../src/data/registry.ts'

// `vp run update-repo-stars -- --prod` forwards the `--` separator too; drop it.
const extraArgs = process.argv.slice(2).filter((arg) => arg !== '--')
const CONCURRENCY = 8
const BATCH_SIZE = 100

const token =
  process.env.GITHUB_TOKEN ??
  (() => {
    try {
      return execSync('gh auth token', { encoding: 'utf8' }).trim()
    } catch {
      return undefined
    }
  })()

async function fetchRepo(
  user: string,
  repo: string,
): Promise<{ stars: number; description?: string } | null> {
  const response = await fetch(`https://api.github.com/repos/${user}/${repo}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'skilly-repo-stars',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`${user}/${repo}: ${response.status} ${await response.text()}`)
  const body = (await response.json()) as { stargazers_count: number; description: string | null }
  return { stars: body.stargazers_count, description: body.description?.trim() || undefined }
}

// One entry per GitHub repo, keyed like `convex/directory.ts` looks them up.
const repos = new Map<string, { user: string; repo: string }>()
for (const skill of registry) {
  if (skill.githubUrl && new URL(skill.githubUrl).host !== 'github.com') continue
  repos.set(`${skill.user}/${skill.repo}`.toLowerCase(), { user: skill.user, repo: skill.repo })
}

const rows: Array<{ key: string; stars: number; description?: string; fetchedAt: number }> = []
const missing: string[] = []
const entries = [...repos.entries()]
for (let i = 0; i < entries.length; i += CONCURRENCY) {
  await Promise.all(
    entries.slice(i, i + CONCURRENCY).map(async ([key, { user, repo }]) => {
      const info = await fetchRepo(user, repo)
      if (info === null) missing.push(key)
      else rows.push({ key, ...info, fetchedAt: Date.now() })
    }),
  )
}

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const args = JSON.stringify({ repos: rows.slice(i, i + BATCH_SIZE) })
  const out = execFileSync('npx', ['convex', 'run', 'seed:upsertRepos', args, ...extraArgs], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  console.log(out.trim())
}
console.log(
  `Wrote stars and descriptions for ${rows.length} repos` +
    (missing.length ? `; not found on GitHub: ${missing.join(', ')}` : ''),
)
