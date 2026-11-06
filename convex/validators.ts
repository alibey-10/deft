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

/** Submissions start as `pending`; only `approved` skills are listed publicly. */
export const vSkillStatus = v.union(
  v.literal('pending'),
  v.literal('approved'),
  v.literal('rejected'),
)
export type SkillStatus = Infer<typeof vSkillStatus>
