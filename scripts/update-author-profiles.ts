/**
 * Fetch GitHub profile info (name, bio, website, location) for every registry author
 * and write it to src/data/author-profiles.json.
 *
 * Auth: uses $GITHUB_TOKEN, falling back to `gh auth token`.
 * Run: vp run update-author-profiles
 */
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { registry } from '../src/data/registry.ts'

type GithubAccount = {
  login: string
  type: 'User' | 'Organization'
  name: string | null
  bio: string | null
  blog: string | null
  location: string | null
  company: string | null
}

export type AuthorProfile = {
  login: string
  name: string | null
  bio: string | null
  website: string | null
  location: string | null
}

const token =
  process.env.GITHUB_TOKEN ??
  (() => {
    try {
      return execSync('gh auth token', { encoding: 'utf8' }).trim()
    } catch {
      return undefined
    }
  })()

async function gh<T>(path: string): Promise<T | null> {
  const response = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'skilly-author-profiles',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`)
  return (await response.json()) as T
}

const clean = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() || null

const normalizeWebsite = (value: string | null) => {
  const url = clean(value)
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

async function fetchProfile(login: string): Promise<AuthorProfile | null> {
  const account = await gh<GithubAccount>(`users/${login}`)
  if (!account) return null
  // Organizations keep their blurb in `description` on the orgs endpoint.
  const org =
    account.type === 'Organization'
      ? await gh<{ description: string | null }>(`orgs/${login}`)
      : null
  return {
    login: account.login,
    name: clean(account.name),
    bio: clean(org?.description ?? account.bio),
    website: normalizeWebsite(account.blog),
    location: clean(account.location),
  }
}

const logins = [...new Map(registry.map((s) => [s.sourceKey, s.user])).entries()].sort(([a], [b]) =>
  a.localeCompare(b),
)

const profiles: Record<string, AuthorProfile> = {}
const missing: string[] = []
const CONCURRENCY = 8
for (let i = 0; i < logins.length; i += CONCURRENCY) {
  await Promise.all(
    logins.slice(i, i + CONCURRENCY).map(async ([key, login]) => {
      const profile = await fetchProfile(login)
      if (profile) profiles[key] = profile
      else missing.push(login)
    }),
  )
}

const out = fileURLToPath(new URL('../src/data/author-profiles.json', import.meta.url))
writeFileSync(
  out,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), profiles }, null, 2)}\n`,
)
console.log(
  `Wrote ${Object.keys(profiles).length} profiles` +
    (missing.length ? `; not found on GitHub: ${missing.join(', ')}` : ''),
)
