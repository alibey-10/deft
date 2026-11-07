/**
 * Pure rules for skills.sh discovery: reading the trending list off the crawled page, the
 * popularity bar, the UI classifier's prompt and answer, spotting copies, and naming skills. No Convex functions here; tested in
 * `src/lib/skill-discovery-rules.test.ts`.
 */
import type { TopicSlug } from './validators'

export const TRENDING_URL = 'https://skills.sh/trending'

/** `<owner>/<repo>/<path>` lowercased: how discovery matches files across branches and casing. */
export const fileKey = (repo: string, path: string) => `${repo}/${path}`.toLowerCase()

export type ListedSkill = {
  owner: string
  repo: string
  skill: string
  installs: number
  /** 1-based position on the page. */
  rank: number
}

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/**
 * The leaderboard rows embedded in the trending page's HTML, as `{"source":"<owner>/<repo>",
 * "skillId":…,"name":…,"installs":…}` objects in page order. The rendered list only shows the first
 * few dozen rows until you scroll; the embedded data has the whole list. Well-known (non-GitHub)
 * sources such as `uizze.sh` have no repo to read and are skipped.
 */
export function parseTrendingSkills(html: string): ListedSkill[] {
  // The rows sit inside a JSON string in the page's script data, so their quotes are escaped.
  const text = html.replace(/\\"/g, '"')
  const seen = new Set<string>()
  const out: ListedSkill[] = []
  let rank = 0
  for (const [object] of text.matchAll(/\{[^{}]*"skillId":[^{}]*\}/g)) {
    let row: { source?: unknown; skillId?: unknown; installs?: unknown }
    try {
      row = JSON.parse(object) as typeof row
    } catch {
      continue
    }
    const { source, skillId, installs } = row
    if (typeof source !== 'string' || typeof skillId !== 'string' || typeof installs !== 'number')
      continue
    const key = `${source}/${skillId}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    rank++
    const [owner, repo, ...rest] = source.split('/')
    if (rest.length || !repo || ![owner, repo, skillId].every((p) => SEGMENT.test(p))) continue
    out.push({ owner, repo, skill: skillId, installs, rank })
  }
  return out
}

/** Popularity bar for adding a skill: its repo has this many stars, or the skill this many installs. */
export const MIN_REPO_STARS = 50
export const MIN_INSTALLS = 100

/** `installs` is unknown for repo siblings that aren't on the page; then only stars count. */
export const isPopular = (stars: number, installs: number | undefined) =>
  stars >= MIN_REPO_STARS || (installs ?? 0) >= MIN_INSTALLS

/** Model that decides whether a skill is a UI skill, via OpenRouter. */
export const CLASSIFIER_MODEL = 'deepseek/deepseek-v4.1-flash'
/** Skills judged per model request. */
export const CLASSIFY_BATCH = 10
const MAX_TOPICS = 4
const EXCERPT_CHARS = 1500

/** What the model is told each topic means. Labels and longer copy live in `src/data/topics.ts`. */
const TOPIC_GUIDE: Record<TopicSlug, string> = {
  accessibility: 'inclusive UI, WCAG, ARIA, screen readers',
  motion: 'UI animation, transitions, easing, scroll effects',
  systems: 'design systems, tokens, component libraries',
  visual: 'visual design, layout, hierarchy, landing pages, UI polish',
  interaction: 'micro-interactions, gestures, UX behaviour',
  performance: 'frontend rendering and load performance',
  craft: 'UI execution quality, spacing, production polish',
  taste: 'design taste, aesthetic judgement, avoiding generic UI',
  typography: 'type in interfaces: fonts, scales, readability',
  color: 'colour in interfaces: palettes, contrast, theming',
  '3d': '3D on the web or in apps: WebGL, WebGPU, shaders',
  architecture: 'frontend app architecture, state, routing',
  frameworks: 'UI frameworks without their own topic, such as Svelte, Solid, Angular',
  'shadcn-ui-development': 'shadcn/ui components',
  testing: 'testing UIs and components',
  debugging: 'debugging UI and rendering issues',
  'code-quality': 'frontend code quality',
  tooling: 'frontend build tools and dev tooling',
  video: 'programmatic video built from UI code',
  react: 'React on the web: components, hooks, JSX, React libraries',
  nextjs: 'Next.js',
  nuxt: 'Nuxt',
  vue: 'Vue',
  'react-native': 'React Native UI',
  expo: 'Expo: Expo Router, Expo SDK modules, @expo/ui',
  threejs: 'Three.js / React Three Fiber',
  remotion: 'Remotion',
  swiftui: 'SwiftUI',
}

export type ClassifyInput = {
  id: string
  name?: string
  description?: string
  path: string
  /** SKILL.md without its frontmatter. */
  body: string
}

export type Verdict = { ui: boolean; topics: TopicSlug[]; reason: string }

/** SKILL.md text after the frontmatter, trimmed to what the classifier needs. */
export const skillExcerpt = (markdown: string) =>
  markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .trim()
    .slice(0, EXCERPT_CHARS)

export const CLASSIFIER_SYSTEM = `You curate a directory of agent skills for people who design and build user interfaces: UI and UX design, visual design, frontend engineering, UI animation, accessibility, design systems, typography and colour for interfaces, 3D on the web, and mobile/native UI.

For each skill, decide whether it belongs in that directory. It belongs only if its main purpose is designing, building, reviewing or improving user interfaces or frontend code.

It does NOT belong if it is mainly: AI image, video, audio or 3D-asset generation; photography or marketing creative; browser automation, scraping or end-to-end testing tools; app automation (Slack, Electron, Twitter…); general programming, data, backend, DevOps or cloud; repo tooling that isn't about UI (git hooks, linters, formatters, CI, package managers); writing, SEO or marketing copy; or a CLI/wrapper for running AI models. Topics like tooling, testing or code-quality can describe a UI skill but never make one on their own. Mentioning UI words in passing (e.g. "3D" in a list of capabilities) does not make a skill a UI skill.

For skills that belong, pick 1 to ${MAX_TOPICS} topics, most specific first, only from this list. Add a framework topic (react, nextjs, vue, nuxt, react-native, expo, threejs, remotion, swiftui, shadcn-ui-development) whenever the skill is written for that framework, and never for a framework it only mentions in passing or sends elsewhere:
${Object.entries(TOPIC_GUIDE)
  .map(([slug, about]) => `- ${slug}: ${about}`)
  .join('\n')}

Give a short reason (under 20 words) for every decision.`

/** JSON schema for the model's answer (OpenRouter structured outputs). */
export const CLASSIFIER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['skills'],
  properties: {
    skills: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'ui', 'topics', 'reason'],
        properties: {
          id: { type: 'string' },
          ui: { type: 'boolean' },
          topics: { type: 'array', items: { type: 'string', enum: Object.keys(TOPIC_GUIDE) } },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const

export const classifierUserMessage = (items: ClassifyInput[]) =>
  `Judge these ${items.length} skills. Answer with one entry per id.\n\n${items
    .map(
      (item) =>
        `<skill id="${item.id}">\nname: ${item.name ?? '(none)'}\npath: ${item.path}\ndescription: ${
          item.description ?? '(none)'
        }\n\n${item.body}\n</skill>`,
    )
    .join('\n\n')}`

const isTopic = (value: unknown): value is TopicSlug =>
  typeof value === 'string' && Object.hasOwn(TOPIC_GUIDE, value)

/**
 * Verdicts by id from the model's JSON. Ids the model skipped or garbled are left out, so those
 * skills stay unjudged and a later run asks again. A UI verdict with no valid topic counts as not UI.
 */
export function parseVerdicts(content: string, ids: string[]): Map<string, Verdict> {
  const wanted = new Set(ids)
  const verdicts = new Map<string, Verdict>()
  let parsed: unknown
  try {
    parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ''))
  } catch {
    return verdicts
  }
  const rows = (parsed as { skills?: unknown })?.skills
  if (!Array.isArray(rows)) return verdicts
  for (const row of rows as Array<Record<string, unknown>>) {
    if (typeof row?.id !== 'string' || !wanted.has(row.id) || typeof row.ui !== 'boolean') continue
    const topics = [...new Set(Array.isArray(row.topics) ? row.topics.filter(isTopic) : [])].slice(
      0,
      MAX_TOPICS,
    )
    const reason = typeof row.reason === 'string' ? row.reason.slice(0, 200) : ''
    verdicts.set(row.id, { ui: row.ui && topics.length > 0, topics: row.ui ? topics : [], reason })
  }
  return verdicts
}

/**
 * Identity of a skill's content for spotting copies published under other repos. Null without a
 * description, since a bare name like "setup" says nothing about sameness.
 */
export function skillFingerprint(name: string | undefined, description: string | undefined) {
  if (!description?.trim()) return null
  const norm = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim()
  return `${norm(name ?? '')}\n${norm(description)}`
}

/** The skill's slug: its folder name, or the repo name for a SKILL.md at the repo root. */
export function slugFromPath(path: string, repo: string) {
  const folder = path.split('/').slice(-2, -1)[0] ?? repo
  return folder.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
}

/** Folders that hold copies or fixtures of a skill, not the skill itself. */
const NOT_SOURCE = /(^|\/)(tests?|__tests__|fixtures?|examples?|node_modules)\//

/**
 * One SKILL.md per skill folder name. Repos often ship the same skill to every agent
 * (`.claude/skills/x`, `.cursor/skills/x`, `plugin/skills/x`…); the copy outside hidden folders,
 * then the shortest path, stands for all of them. Test fixtures never count.
 */
export function canonicalSkillPaths(paths: string[], repo: string) {
  const hidden = (path: string) => Number(path.split('/').some((part) => part.startsWith('.')))
  const depth = (path: string) => path.split('/').length
  const compare = (a: string, b: string) =>
    hidden(a) - hidden(b) || depth(a) - depth(b) || a.localeCompare(b)
  const best = new Map<string, string>()
  for (const path of paths) {
    if (NOT_SOURCE.test(path)) continue
    const slug = slugFromPath(path, repo)
    const current = best.get(slug)
    if (!current || compare(path, current) < 0) best.set(slug, path)
  }
  return [...best.values()].sort()
}

const MAX_FILES = 30

/**
 * Extra markdown files in a skill's folder, relative to its SKILL.md, leaving out anything that
 * belongs to another skill nested further down.
 */
export function skillFiles(skillPath: string, blobs: Iterable<string>) {
  const dir = skillPath.slice(0, -'SKILL.md'.length)
  const all = [...blobs].filter((p) => p.startsWith(dir) && p !== skillPath)
  const nested = all
    .filter((p) => p.endsWith('/SKILL.md'))
    .map((p) => p.slice(0, -'SKILL.md'.length))
  return all
    .filter((p) => p.toLowerCase().endsWith('.md') && !p.includes('node_modules/'))
    .filter((p) => !nested.some((n) => p.startsWith(n)))
    .map((p) => p.slice(dir.length))
    .sort()
    .slice(0, MAX_FILES)
}
