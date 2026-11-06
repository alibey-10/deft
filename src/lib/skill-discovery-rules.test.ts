import { describe, expect, test } from 'vite-plus/test'

import {
  canonicalSkillPaths,
  isPopular,
  parseVerdicts,
  skillExcerpt,
  skillFingerprint,
  parseTrendingSkills,
  skillFiles,
  slugFromPath,
} from '../../convex/skillDiscoveryRules.ts'

describe('parseTrendingSkills', () => {
  test('reads the escaped leaderboard rows in page order, GitHub sources only', () => {
    const rows = [
      {
        source: 'skills-shell/superpowers',
        skillId: 'ai-image-generation',
        name: 'x',
        installs: 29584,
      },
      { source: 'uizze.sh', skillId: 'ui-taste', name: 'ui-taste', installs: 21200 },
      {
        source: 'vercel-labs/agent-skills',
        skillId: 'web-design-guidelines',
        name: 'w',
        installs: 3986,
        isOfficial: true,
      },
      {
        source: 'skills-shell/superpowers',
        skillId: 'ai-image-generation',
        name: 'x',
        installs: 29584,
      },
    ]
    // As in the page: JSON inside a JS string, so every quote is escaped.
    const html = `<script>self.__next_f.push([1,"{"skills":${JSON.stringify(rows).replace(/"/g, '\\"')}}"])</script>`
    expect(parseTrendingSkills(html)).toEqual([
      {
        owner: 'skills-shell',
        repo: 'superpowers',
        skill: 'ai-image-generation',
        installs: 29584,
        rank: 1,
      },
      {
        owner: 'vercel-labs',
        repo: 'agent-skills',
        skill: 'web-design-guidelines',
        installs: 3986,
        rank: 3,
      },
    ])
  })

  test('finds nothing in a page without the data', () => {
    expect(parseTrendingSkills('<html><a href="/a/b/c">c</a></html>')).toEqual([])
  })
})

describe('isPopular', () => {
  test('50 stars or 100 installs', () => {
    expect(isPopular(50, undefined)).toBe(true)
    expect(isPopular(49, 100)).toBe(true)
    expect(isPopular(49, 99)).toBe(false)
    expect(isPopular(10, undefined)).toBe(false)
  })
})

describe('parseVerdicts', () => {
  test('keeps valid verdicts, drops unknown ids and topics', () => {
    const content = JSON.stringify({
      skills: [
        { id: '1', ui: true, topics: ['motion', 'made-up', 'motion'], reason: 'UI animation' },
        { id: '2', ui: false, topics: [], reason: 'AI video generation' },
        { id: '3', ui: true, topics: ['made-up'], reason: 'No valid topic' },
        { id: '9', ui: true, topics: ['visual'], reason: 'Not asked about' },
      ],
    })
    expect(Object.fromEntries(parseVerdicts(content, ['1', '2', '3', '4']))).toEqual({
      '1': { ui: true, topics: ['motion'], reason: 'UI animation' },
      '2': { ui: false, topics: [], reason: 'AI video generation' },
      '3': { ui: false, topics: [], reason: 'No valid topic' },
    })
  })

  test('tolerates a fenced answer and rejects garbage', () => {
    const fenced = '```json\n{"skills":[{"id":"1","ui":false,"topics":[],"reason":"x"}]}\n```'
    expect(parseVerdicts(fenced, ['1']).get('1')?.ui).toBe(false)
    expect(parseVerdicts('not json', ['1']).size).toBe(0)
  })
})

describe('skillFingerprint', () => {
  test('matches copies regardless of case and spacing, ignores bare names', () => {
    expect(skillFingerprint('Landing-Page-Design', 'Landing page  conversion\noptimization')).toBe(
      skillFingerprint('landing-page-design', 'landing page conversion optimization'),
    )
    expect(skillFingerprint('setup', '')).toBeNull()
  })
})

describe('skillExcerpt', () => {
  test('drops the frontmatter', () => {
    expect(skillExcerpt('---\nname: x\n---\n\n# Title\nBody')).toBe('# Title\nBody')
  })
})

describe('slugFromPath', () => {
  test('uses the folder, or the repo at the root', () => {
    expect(slugFromPath('skills/Emil Design/SKILL.md', 'skills')).toBe('emil-design')
    expect(slugFromPath('SKILL.md', 'Impeccable')).toBe('impeccable')
  })
})

describe('skillFiles', () => {
  test('lists markdown beside SKILL.md, not nested skills', () => {
    const blobs = [
      'skills/a/SKILL.md',
      'skills/a/references/motion.md',
      'skills/a/README.md',
      'skills/a/script.ts',
      'skills/a/nested/SKILL.md',
      'skills/a/nested/notes.md',
      'skills/b/SKILL.md',
    ]
    expect(skillFiles('skills/a/SKILL.md', blobs)).toEqual(['README.md', 'references/motion.md'])
  })
})

describe('canonicalSkillPaths', () => {
  test('one path per skill: plain folder over agent copies, no test fixtures', () => {
    const paths = [
      '.agents/skills/impeccable/SKILL.md',
      '.claude/skills/impeccable/SKILL.md',
      'cursor-plugin/skills/impeccable/SKILL.md',
      'plugin/skills/impeccable/SKILL.md',
      'tests/oracle/workspaces/ctx-pin/.claude/skills/audit/SKILL.md',
      '.claude/skills/polish/SKILL.md',
    ]
    expect(canonicalSkillPaths(paths, 'impeccable')).toEqual([
      '.claude/skills/polish/SKILL.md',
      'cursor-plugin/skills/impeccable/SKILL.md',
    ])
  })
})
