/** URL helpers shared by the skill scan's action and mutations. No Convex functions here. */

export type RawUrlParts = { owner: string; repo: string; branch: string; path: string }

/** `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>`; null for any other host. */
export function parseRawUrl(rawUrl: string): RawUrlParts | null {
  const match = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(
    rawUrl,
  )
  if (!match) return null
  const [, owner, repo, branch, path] = match
  return { owner, repo, branch, path: decodeURIComponent(path) }
}

export const repoKey = (owner: string, repo: string) => `${owner}/${repo}`.toLowerCase()

export const rawUrlFor = ({ owner, repo, branch, path }: RawUrlParts) =>
  `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`

export const githubUrlFor = ({ owner, repo, branch, path }: RawUrlParts) =>
  `https://github.com/${owner}/${repo}/blob/${branch}/${path}`

const SEGMENT = /^[A-Za-z0-9._-]+$/

/**
 * A SKILL.md location from a link someone pasted: a `github.com/<o>/<r>/blob/<branch>/…/SKILL.md`
 * file link, a `github.com/<o>/<r>/tree/<branch>/<folder>` folder link, or a raw link. The branch
 * is taken as one path segment. Null for anything else, or a file that isn't a SKILL.md.
 */
export function parseSkillUrl(input: string): RawUrlParts | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  let owner: string, repo: string, branch: string, rest: string[]
  if (url.hostname === 'raw.githubusercontent.com') {
    ;[owner, repo, branch, ...rest] = parts
  } else if (url.hostname === 'github.com' || url.hostname === 'www.github.com') {
    let kind: string
    ;[owner, repo, kind, branch, ...rest] = parts
    if (kind !== 'blob' && kind !== 'tree') return null
    // A folder link points at the SKILL.md inside it.
    if (kind === 'tree' && rest.at(-1) !== 'SKILL.md') rest = [...rest, 'SKILL.md']
  } else {
    return null
  }
  if (!owner || !repo || !branch || ![owner, repo].every((p) => SEGMENT.test(p))) return null
  if (rest.at(-1) !== 'SKILL.md' || rest.some((p) => p === '..' || p === '.')) return null
  return { owner, repo: repo.replace(/\.git$/, ''), branch, path: rest.join('/') }
}
