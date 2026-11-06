/**
 * Write the static registry (src/data/registry.ts + author-profiles.json) into Convex.
 * Idempotent: authors upsert on `key`, skills on `rawUrl`.
 *
 * Run: vp run seed-convex            (dev deployment from .env.local)
 *      vp run seed-convex -- --prod  (production)
 */
import { execFileSync } from 'node:child_process'

import authorProfiles from '../src/data/author-profiles.json' with { type: 'json' }
import { registry } from '../src/data/registry.ts'

// `vp run seed-convex -- --prod` forwards the `--` separator too; drop it.
const extraArgs = process.argv.slice(2).filter((arg) => arg !== '--')
const BATCH_SIZE = 100

type Counts = { inserted: number; updated: number; unchanged: number }

function run(fn: string, args: unknown): Counts {
  const out = execFileSync('npx', ['convex', 'run', fn, JSON.stringify(args), ...extraArgs], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  return JSON.parse(out) as Counts
}

function runBatched(fn: string, key: string, rows: unknown[]) {
  const total: Counts = { inserted: 0, updated: 0, unchanged: 0 }
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const counts = run(fn, { [key]: rows.slice(i, i + BATCH_SIZE) })
    total.inserted += counts.inserted
    total.updated += counts.updated
    total.unchanged += counts.unchanged
  }
  console.log(`${key}: ${rows.length} rows →`, total)
}

const profiles: Record<
  string,
  (typeof authorProfiles.profiles)[keyof typeof authorProfiles.profiles]
> = authorProfiles.profiles
const profileFetchedAt = Date.parse(authorProfiles.generatedAt)
const orUndefined = <T>(value: T | null | undefined) => value ?? undefined

// One author per sourceKey; first registry entry wins for casing, as in src/lib/directory.ts.
const authors = new Map<string, Record<string, unknown>>()
for (const skill of registry) {
  if (authors.has(skill.sourceKey)) continue
  // One registry entry has an empty githubUrl; treat that as GitHub.
  const host = skill.githubUrl ? new URL(skill.githubUrl).host : 'github.com'
  const profile = profiles[skill.sourceKey]
  authors.set(skill.sourceKey, {
    key: skill.sourceKey,
    login: skill.sourceLabel,
    profileUrl:
      host === 'github.com' ? `https://github.com/${skill.user}` : new URL(skill.githubUrl).origin,
    avatarUrl: `https://github.com/${skill.user}.png?size=80`,
    ...(profile && {
      name: orUndefined(profile.name),
      bio: orUndefined(profile.bio),
      website: orUndefined(profile.website),
      location: orUndefined(profile.location),
      followers: profile.followers,
      profileFetchedAt,
    }),
  })
}

const skills = registry.map((s) => ({
  slug: s.slug,
  user: s.user,
  repo: s.repo,
  rawUrl: s.rawUrl,
  githubUrl: s.githubUrl,
  name: s.name,
  description: s.description,
  topics: s.topics ?? [],
  ...(s.files && { files: s.files }),
  sourceKey: s.sourceKey,
  pathSlug: s.pathSlug,
}))

// JSON.stringify drops undefined fields, so optional profile fields stay unset.
runBatched('seed:upsertAuthors', 'authors', [...authors.values()])
runBatched('seed:upsertSkills', 'skills', skills)
