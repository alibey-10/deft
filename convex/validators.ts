import { v, type Infer } from 'convex/values'

/** Single source of truth for topic slugs. Labels and descriptions live in `src/data/topics.ts`. */
export const topicSlugs = [
  // Design engineering core
  'accessibility',
  'motion',
  'systems',
  'visual',
  'interaction',
  'performance',
  'craft',
  'taste',
  'typography',
  'color',
  '3d',
  // Broader frontend
  'frontend',
  'architecture',
  'frameworks',
  'shadcn-ui-development',
  'testing',
  'debugging',
  'code-quality',
  'tooling',
  'video',
  // Framework-specific topics
  'nextjs',
  'nuxt',
  'vue',
  'react-native',
  'threejs',
  'remotion',
  'swiftui',
] as const

export const vTopicSlug = v.union(...topicSlugs.map((slug) => v.literal(slug)))
export type TopicSlug = Infer<typeof vTopicSlug>

/**
 * Submissions start as `pending`; only `approved` skills are listed publicly. The skill scan
 * moves an approved skill to `missing` while its source file is gone, and back when it returns.
 */
export const vSkillStatus = v.union(
  v.literal('pending'),
  v.literal('approved'),
  v.literal('rejected'),
  v.literal('missing'),
)
export type SkillStatus = Infer<typeof vSkillStatus>

/** Why the skill scan couldn't find a directory skill's source file. */
export const vMissingReason = v.union(
  /** The repo returns 404 (deleted, renamed away, or made private). */
  v.literal('repo-not-found'),
  /** The branch in the skill's raw URL no longer exists. */
  v.literal('branch-not-found'),
  /** The repo and branch exist but the file path doesn't. */
  v.literal('file-not-found'),
)
export type MissingReason = Infer<typeof vMissingReason>
