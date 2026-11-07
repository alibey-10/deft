import type { TopicSlug } from './registry.ts'
import type { DirectoryLink } from './directory-links'

export type Topic = {
  slug: TopicSlug
  label: string
  description: string
  isDesignCore: boolean
  relatedLinks?: DirectoryLink[]
  supportingSkillPaths?: string[]
}

export const topicsBySlug = {
  accessibility: {
    slug: 'accessibility',
    label: 'Accessibility',
    description: 'Inclusive UI patterns, WCAG audits, and remediation workflows.',
    isDesignCore: true,
  },
  motion: {
    slug: 'motion',
    label: 'Motion',
    description: 'Animation systems, transitions, and interaction timing.',
    isDesignCore: true,
  },
  systems: {
    slug: 'systems',
    label: 'Systems',
    description: 'Design systems, component architecture, and scalable UI foundations.',
    isDesignCore: true,
    relatedLinks: [
      {
        label: 'Design systems',
        href: '/design-systems',
        description:
          'Browse public design systems from product companies, component libraries, and government services.',
      },
      {
        label: 'Component libraries',
        href: '/components',
        description: 'Compare React libraries, primitives, shadcn components, and UI systems.',
      },
    ],
  },
  visual: {
    slug: 'visual',
    label: 'Visual',
    description: 'Visual polish, hierarchy, and intentional interface direction.',
    isDesignCore: true,
  },
  interaction: {
    slug: 'interaction',
    label: 'Interaction',
    description: 'Microinteractions, feedback loops, and UX behavior patterns.',
    isDesignCore: true,
  },
  performance: {
    slug: 'performance',
    label: 'Performance',
    description: 'Rendering, bundle, and runtime optimization for smooth UIs.',
    isDesignCore: true,
  },
  craft: {
    slug: 'craft',
    label: 'Craft',
    description: 'Execution quality, spacing, polish, and production readiness.',
    isDesignCore: true,
  },
  taste: {
    slug: 'taste',
    label: 'Taste',
    description:
      'Design taste for frontend UI: aesthetic judgment, style direction, and anti-generic quality. Browse taste skills such as design-taste-frontend.',
    isDesignCore: true,
  },
  typography: {
    slug: 'typography',
    label: 'Typography',
    description: 'Type systems, readability, and hierarchy refinement.',
    isDesignCore: true,
  },
  color: {
    slug: 'color',
    label: 'Color',
    description: 'Color systems, contrast, and palette strategy.',
    isDesignCore: true,
  },
  '3d': {
    slug: '3d',
    label: '3D',
    description: 'Spatial interfaces, real-time graphics, and immersive UI scenes.',
    isDesignCore: true,
  },
  architecture: {
    slug: 'architecture',
    label: 'Architecture',
    description: 'Project structure, composition patterns, and scalable code design.',
    isDesignCore: true,
  },
  testing: {
    slug: 'testing',
    label: 'Testing',
    description: 'Reliability checks, QA flows, and regression prevention.',
    isDesignCore: true,
  },
  debugging: {
    slug: 'debugging',
    label: 'Debugging',
    description: 'Root-cause analysis, instrumentation, and bug-fixing workflows.',
    isDesignCore: true,
  },
  'code-quality': {
    slug: 'code-quality',
    label: 'Code quality',
    description: 'Maintainability reviews, abstraction cleanup, and deep code health work.',
    isDesignCore: true,
  },
  tooling: {
    slug: 'tooling',
    label: 'Tooling',
    description: 'Build systems, CLI workflows, and developer productivity tools.',
    isDesignCore: true,
  },
  video: {
    slug: 'video',
    label: 'Video',
    description: 'Video composition, storytelling, and timeline-based UI content.',
    isDesignCore: true,
  },
  react: {
    slug: 'react',
    label: 'React',
    description: 'React components, hooks, rendering patterns, and React UI libraries.',
    isDesignCore: false,
  },
  nextjs: {
    slug: 'nextjs',
    label: 'Next.js',
    description: 'Next.js conventions, performance, caching, and upgrade guidance.',
    isDesignCore: false,
  },
  nuxt: {
    slug: 'nuxt',
    label: 'Nuxt',
    description: 'Nuxt workflows for Vue full-stack and SSR architectures.',
    isDesignCore: false,
  },
  vue: {
    slug: 'vue',
    label: 'Vue',
    description: 'Vue component patterns, reactivity, and ecosystem best practices.',
    isDesignCore: false,
  },
  'react-native': {
    slug: 'react-native',
    label: 'React Native',
    description: 'Mobile app performance, profiling, and React Native optimization.',
    isDesignCore: false,
  },
  expo: {
    slug: 'expo',
    label: 'Expo',
    description: 'Expo apps: Expo Router navigation, native UI, animation, and design systems.',
    isDesignCore: false,
  },
  threejs: {
    slug: 'threejs',
    label: 'Three.js',
    description: 'Three.js workflows for rendering, materials, interaction, and shaders.',
    isDesignCore: false,
  },
  remotion: {
    slug: 'remotion',
    label: 'Remotion',
    description: 'React-driven video generation, animation, and composition workflows.',
    isDesignCore: false,
  },
  swiftui: {
    slug: 'swiftui',
    label: 'SwiftUI',
    description: 'SwiftUI interface patterns, composition, and architecture guidance.',
    isDesignCore: false,
  },
  frameworks: {
    slug: 'frameworks',
    label: 'Other frameworks',
    description:
      'Agent skills for UI frameworks without their own topic, such as Svelte, Solid, and Angular.',
    isDesignCore: false,
  },
  'shadcn-ui-development': {
    slug: 'shadcn-ui-development',
    label: 'shadcn/ui',
    description:
      'Agent skills for building with shadcn/ui: find and compose components, customize styles and themes, translate designs into code, and migrate component primitives.',
    isDesignCore: false,
    supportingSkillPaths: [
      'millionco/tailwind-token-consolidation',
      'emilkowalski/ask-sonner',
      'ibelick/baseline-ui',
      'prototyperai/build-primitive',
    ],
    relatedLinks: [
      {
        label: 'shadcn components',
        href: '/components/shadcn',
        description:
          'Find component libraries and copy-paste building blocks for shadcn/ui projects.',
      },
      {
        label: 'Design system guidelines',
        href: '/collections/design-system-guidelines',
        description:
          'Explore skills for documenting tokens, components, and reusable interface patterns.',
      },
    ],
  },
} satisfies Record<TopicSlug, Topic>

export const topics: Topic[] = Object.values(topicsBySlug)

export const topicBySlug = new Map(topics.map((topic) => [topic.slug, topic]))

export const primaryDesignTopicSlugs: TopicSlug[] = [
  'accessibility',
  'motion',
  'systems',
  'visual',
  'interaction',
  'performance',
  'craft',
  'taste',
]
