/** URL helpers shared by the skill scan's action and mutations. No Convex functions here. */

export type RawUrlParts = { owner: string; repo: string; branch: string; path: string }

const SEGMENT = /^[A-Za-z0-9._-]+$/

const isValidSegment = (value: string | undefined): value is string =>
  Boolean(value && value !== '.' && value !== '..' && SEGMENT.test(value))

const isValidPathSegment = (segment: string) =>
  segment.length > 0 &&
  segment !== '.' &&
  segment !== '..' &&
  !segment.includes('/') &&
  !segment.includes('\\')

/**
 * Extracts the raw pathname from an HTTP(S) URL before WHATWG `new URL` normalizes dot segments
 * (`..`, `%2e%2e`) or backslashes.
 */
function rawPathnameOf(trimmed: string, expectedHostname: string): string | null {
  if (/[\r\n\t]/.test(trimmed)) return null
  const schemeMatch = /^https?:\/\//i.exec(trimmed)
  if (!schemeMatch) return null
  const afterScheme = trimmed.slice(schemeMatch[0].length)
  const beforeQuery = afterScheme.split(/[?#]/, 1)[0]
  if (beforeQuery.includes('\\')) return null
  const slashIndex = beforeQuery.indexOf('/')
  if (slashIndex <= 0) return null
  if (beforeQuery.slice(0, slashIndex).toLowerCase() !== expectedHostname) return null
  return beforeQuery.slice(slashIndex)
}

/** `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>`; null for any other host. */
export function parseRawUrl(rawUrl: string): RawUrlParts | null {
  const match = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(
    rawUrl,
  )
  if (!match) return null
  const [, owner, repo, branch, path] = match
  try {
    return {
      owner: decodeURIComponent(owner),
      repo: decodeURIComponent(repo),
      branch: decodeURIComponent(branch),
      path: decodeURIComponent(path),
    }
  } catch {
    return null
  }
}

export const repoKey = (owner: string, repo: string) => `${owner}/${repo}`.toLowerCase()

export const rawUrlFor = ({ owner, repo, branch, path }: RawUrlParts) =>
  `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${path}`

export const githubUrlFor = ({ owner, repo, branch, path }: RawUrlParts) =>
  `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeURIComponent(branch)}/${path}`

function isExpectedUrl(
  candidateUrl: string,
  host: string,
  owner: string,
  repo: string,
  requireBlob: boolean,
): boolean {
  if (!isValidSegment(owner) || !isValidSegment(repo)) return false
  if (
    candidateUrl !== candidateUrl.trim() ||
    /[\r\n\t]/.test(candidateUrl) ||
    candidateUrl.includes('?') ||
    candidateUrl.includes('#')
  ) {
    return false
  }
  let url: URL
  try {
    url = new URL(candidateUrl)
  } catch {
    return false
  }
  if (
    url.protocol !== 'https:' ||
    url.host !== host ||
    url.username ||
    url.password ||
    url.port ||
    url.search !== '' ||
    url.hash !== '' ||
    url.href.includes('?') ||
    url.href.includes('#')
  ) {
    return false
  }
  const rawPath = rawPathnameOf(candidateUrl, host)
  if (!rawPath) return false
  try {
    const rawSegments = rawPath.slice(1).split('/').map(decodeURIComponent)
    if (!rawSegments.every(isValidPathSegment)) return false
  } catch {
    return false
  }

  const expectedPrefix = `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/`.toLowerCase()
  if (!url.pathname.toLowerCase().startsWith(expectedPrefix)) return false
  let remainder = url.pathname.slice(expectedPrefix.length)
  if (requireBlob) {
    if (!remainder.startsWith('blob/')) return false
    remainder = remainder.slice('blob/'.length)
  }
  const segments = remainder.split('/')
  if (segments.length < 2 || segments.at(-1) !== 'SKILL.md') return false
  try {
    const [branch, ...rest] = segments.map(decodeURIComponent)
    return isValidSegment(branch) && rest.every(isValidPathSegment)
  } catch {
    return false
  }
}

/** Verifies that `rawUrl` resolves under `raw.githubusercontent.com/<owner>/<repo>/<branch>/…/SKILL.md`. */
export function isExpectedRawUrl(rawUrl: string, owner: string, repo: string): boolean {
  return isExpectedUrl(rawUrl, 'raw.githubusercontent.com', owner, repo, false)
}

/** Verifies that `githubUrl` resolves under `github.com/<owner>/<repo>/blob/<branch>/…/SKILL.md`. */
export function isExpectedGithubUrl(githubUrl: string, owner: string, repo: string): boolean {
  return isExpectedUrl(githubUrl, 'github.com', owner, repo, true)
}

/**
 * A SKILL.md location from a link someone pasted: a `github.com/<o>/<r>/blob/<branch>/…/SKILL.md`
 * file link, a `github.com/<o>/<r>/tree/<branch>/<folder>` folder link, or a raw link. The branch
 * is taken as one path segment. Null for anything else, or a file that isn't a SKILL.md.
 */
export function parseSkillUrl(input: string): RawUrlParts | null {
  const trimmed = input.trim()
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username ||
    url.password ||
    url.port
  ) {
    return null
  }
  if (
    url.hostname !== 'raw.githubusercontent.com' &&
    url.hostname !== 'github.com' &&
    url.hostname !== 'www.github.com'
  ) {
    return null
  }
  const rawPath = rawPathnameOf(trimmed, url.hostname)
  if (!rawPath) return null
  const stripped = rawPath.slice(1).replace(/\/$/, '')
  if (!stripped) return null

  let parts: string[]
  try {
    parts = stripped.split('/').map(decodeURIComponent)
  } catch {
    return null
  }

  let owner: string | undefined
  let repo: string | undefined
  let branch: string | undefined
  let rest: string[]
  if (url.hostname === 'raw.githubusercontent.com') {
    ;[owner, repo, branch, ...rest] = parts
  } else {
    let kind: string | undefined
    ;[owner, repo, kind, branch, ...rest] = parts
    if (kind !== 'blob' && kind !== 'tree') return null
    // A folder link points at the SKILL.md inside it.
    if (kind === 'tree' && rest.at(-1) !== 'SKILL.md') rest = [...rest, 'SKILL.md']
  }

  if (!isValidSegment(owner) || !isValidSegment(repo) || !isValidSegment(branch)) return null
  const cleanRepo = repo.replace(/\.git$/, '')
  if (!isValidSegment(cleanRepo)) return null
  if (rest.at(-1) !== 'SKILL.md' || !rest.every(isValidPathSegment)) return null
  return { owner, repo: cleanRepo, branch, path: rest.join('/') }
}
