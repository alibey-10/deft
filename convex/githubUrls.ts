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
