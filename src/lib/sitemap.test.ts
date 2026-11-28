import { describe, expect, it } from 'vite-plus/test'

import { buildDirectory, type RegistrySkill } from './directory.ts'
import { buildSitemapXml } from './sitemap.ts'

const skill = (overrides: Partial<RegistrySkill>): RegistrySkill => ({
  slug: 'a11y',
  pathSlug: 'acme/a11y',
  sourceKey: 'acme',
  user: 'Acme',
  repo: 'skills',
  rawUrl: 'https://raw.githubusercontent.com/Acme/skills/main/a11y/SKILL.md',
  githubUrl: 'https://github.com/Acme/skills/blob/main/a11y/SKILL.md',
  name: 'A11y',
  description: 'Accessibility checks.',
  topics: ['accessibility'],
  files: undefined,
  addedAt: Date.UTC(2026, 0, 2),
  stars: 1,
  ...overrides,
})

describe('buildSitemapXml', () => {
  const directory = buildDirectory({
    skills: [
      skill({}),
      skill({
        slug: 'motion',
        pathSlug: 'acme/motion',
        name: 'Motion & Easing',
        topics: ['motion'],
        files: ['refs/curves & timing.md'],
        addedAt: Date.UTC(2026, 4, 9),
      }),
    ],
    authors: [],
    repos: [],
  })
  const xml = buildSitemapXml(directory, 'https://usedeft.dev')
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])

  it('lists static, topic, author, skill and skill file pages with absolute URLs', () => {
    expect(locs).toEqual([
      'https://usedeft.dev/',
      'https://usedeft.dev/topics',
      'https://usedeft.dev/authors',
      'https://usedeft.dev/ask',
      'https://usedeft.dev/docs/mcp',
      'https://usedeft.dev/topics/accessibility',
      'https://usedeft.dev/topics/motion',
      'https://usedeft.dev/authors/acme',
      'https://usedeft.dev/skills/acme/a11y',
      'https://usedeft.dev/skills/acme/motion',
      'https://usedeft.dev/skills/acme/motion?file=refs%2Fcurves%20%26%20timing.md',
    ])
  })

  it('dates listing pages by their newest skill', () => {
    expect(xml).toContain('<loc>https://usedeft.dev/</loc><lastmod>2026-05-09</lastmod>')
    expect(xml).toContain(
      '<loc>https://usedeft.dev/topics/accessibility</loc><lastmod>2026-01-02</lastmod>',
    )
    expect(xml).toContain('<url><loc>https://usedeft.dev/skills/acme/a11y</loc></url>')
  })
})
