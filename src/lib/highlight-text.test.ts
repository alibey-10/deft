import { describe, expect, it } from 'vite-plus/test'

import { createSearchMatcher, highlightDescription } from './highlight-text.ts'

describe('highlightDescription', () => {
  it('returns plain text for empty, whitespace, or punctuation-only queries', () => {
    const text = 'Build accessible UI components.'
    expect(highlightDescription('', 'ui')).toEqual([])
    expect(highlightDescription(text, '')).toEqual([{ text, match: false }])
    expect(highlightDescription(text, '   ')).toEqual([{ text, match: false }])
    expect(highlightDescription(text, '--- !!!')).toEqual([{ text, match: false }])
  })

  it('matches single words case-insensitively while preserving original casing', () => {
    expect(highlightDescription('Design Tokens for Web Apps', 'tokens')).toEqual([
      { text: 'Design ', match: false },
      { text: 'Tokens', match: true },
      { text: ' for Web Apps', match: false },
    ])
  })

  it('matches at word starts and prefixes without matching mid-word', () => {
    expect(highlightDescription('Quickly build UIs and typography systems for UI.', 'ui')).toEqual([
      { text: 'Quickly build ', match: false },
      { text: 'UI', match: true },
      { text: 's and typography systems for ', match: false },
      { text: 'UI', match: true },
      { text: '.', match: false },
    ])

    expect(highlightDescription('Fix spacing and typography.', 'typog')).toEqual([
      { text: 'Fix spacing and ', match: false },
      { text: 'typog', match: true },
      { text: 'raphy.', match: false },
    ])
  })

  it('highlights every matching term in multi-word queries', () => {
    expect(
      highlightDescription('Evidence-based design tokens and color guidance.', 'design tokens'),
    ).toEqual([
      { text: 'Evidence-based ', match: false },
      { text: 'design', match: true },
      { text: ' ', match: false },
      { text: 'tokens', match: true },
      { text: ' and color guidance.', match: false },
    ])
  })

  it('handles punctuated tokens literally when present and splits them otherwise', () => {
    expect(highlightDescription('Build woven cloth in Three.js scenes.', 'three.js')).toEqual([
      { text: 'Build woven cloth in ', match: false },
      { text: 'Three.js', match: true },
      { text: ' scenes.', match: false },
    ])

    expect(
      highlightDescription('Create a modern design system with tokens.', 'design-system'),
    ).toEqual([
      { text: 'Create a modern ', match: false },
      { text: 'design', match: true },
      { text: ' ', match: false },
      { text: 'system', match: true },
      { text: ' with tokens.', match: false },
    ])
  })

  it('escapes regex metacharacters safely without throwing', () => {
    expect(
      highlightDescription('Support for c++ and foo(bar) [a-z] $1.', 'c++ foo(bar) [a-z] $1'),
    ).toEqual([
      { text: 'Support for ', match: false },
      { text: 'c', match: true },
      { text: '++ and ', match: false },
      { text: 'foo(bar', match: true },
      { text: ') [', match: false },
      { text: 'a-z', match: true },
      { text: '] $', match: false },
      { text: '1', match: true },
      { text: '.', match: false },
    ])
  })

  it('prefers longer overlapping tokens and deduplicates case-variant tokens', () => {
    expect(
      highlightDescription('Frosted glassmorphism and glass UI.', 'glass glassmorphism'),
    ).toEqual([
      { text: 'Frosted ', match: false },
      { text: 'glassmorphism', match: true },
      { text: ' and ', match: false },
      { text: 'glass', match: true },
      { text: ' UI.', match: false },
    ])

    expect(highlightDescription('Accessible UI kit.', 'ui UI')).toEqual([
      { text: 'Accessible ', match: false },
      { text: 'UI', match: true },
      { text: ' kit.', match: false },
    ])
  })

  describe('windowing', () => {
    it('keeps the original start when the first match is within windowAfter', () => {
      const text =
        'Craft accessible interfaces with clear spacing, clean typography, and crisp keyboard navigation.'
      expect(highlightDescription(text, 'typography', { windowAfter: 80, leadChars: 36 })).toEqual([
        { text: 'Craft accessible interfaces with clear spacing, clean ', match: false },
        { text: 'typography', match: true },
        { text: ', and crisp keyboard navigation.', match: false },
      ])
    })

    it('slices cleanly at a word boundary with a leading ellipsis when the match is past windowAfter', () => {
      const text =
        'This skill teaches coding agents to audit layout grids, color contrast, focus rings, motion timing, and glassmorphism surfaces for web apps.'
      const segments = highlightDescription(text, 'glassmorphism surfaces', {
        windowAfter: 80,
        leadChars: 36,
      })

      expect(segments[0].match).toBe(false)
      expect(segments[0].text.startsWith('…')).toBe(true)
      // Should start cleanly on a whole word (not cutting mid-word like `...s rings`).
      expect(segments[0].text).toBe('…focus rings, motion timing, and ')
      expect(segments).toEqual([
        { text: '…focus rings, motion timing, and ', match: false },
        { text: 'glassmorphism', match: true },
        { text: ' ', match: false },
        { text: 'surfaces', match: true },
        { text: ' for web apps.', match: false },
      ])
    })

    it('returns the full unclipped text when there is no match in a long description', () => {
      const text =
        'This skill teaches coding agents to audit layout grids, color contrast, focus rings, and motion timing across complex multi-panel applications.'
      expect(highlightDescription(text, 'nonexistent')).toEqual([{ text, match: false }])
    })

    it('falls back cleanly when a long unbroken token precedes the match', () => {
      const prefix = 'a'.repeat(120)

      expect(
        highlightDescription(`${prefix} target word here.`, 'target', {
          windowAfter: 80,
          leadChars: 36,
        }),
      ).toEqual([
        { text: '…', match: false },
        { text: 'target', match: true },
        { text: ' word here.', match: false },
      ])

      expect(
        highlightDescription(`${prefix}-target word here.`, 'target', {
          windowAfter: 80,
          leadChars: 36,
        }),
      ).toEqual([
        { text: `…${'a'.repeat(35)}-`, match: false },
        { text: 'target', match: true },
        { text: ' word here.', match: false },
      ])
    })
  })
})

describe('createSearchMatcher', () => {
  it('returns 0 for empty, whitespace, or punctuation-only queries', () => {
    const entry = {
      value: 'accessible-ui',
      keywords: ['acme', 'accessibility'],
      description: 'Accessible UI primitives with keyboard support.',
    }
    expect(createSearchMatcher('')(entry)).toBe(0)
    expect(createSearchMatcher('   ')(entry)).toBe(0)
    expect(createSearchMatcher('--- !!!')(entry)).toBe(0)
  })

  it('rejects scattered fuzzy subsequences across value, keywords, and description', () => {
    const matchGsap = createSearchMatcher('gsap')
    expect(
      matchGsap({
        value: 'gemini-omni-flash-api',
        keywords: ['google-gemini', 'gemini-skills', 'Video', 'Tooling'],
        description:
          'Generative video editing, text-to-video, image-referenced video, frame transitions, and extensions using Gemini Omni 1.1 Flash via the official google-genai SDK.',
      }),
    ).toBe(0)
    expect(
      matchGsap({
        value: 'brand-guidelines',
        keywords: ['anthropics', 'skills', 'Visual'],
        description:
          "Applies Anthropic's official brand colors and typography to any sort of artifact.",
      }),
    ).toBe(0)
    expect(
      matchGsap({
        value: 'appllama-app-design-skill',
        keywords: ['Appllama', 'appllama-skills', 'Expo', 'React Native'],
        description: 'Build native-feeling, benchmark-quality mobile app screens.',
      }),
    ).toBe(0)

    const matchSvg = createSearchMatcher('svg')
    expect(matchSvg({ value: 'grid-system', description: 'Style visual grids for layout.' })).toBe(
      0,
    )
    expect(
      matchSvg({ value: 'icon-maker', description: 'Generate SVG icons and illustrations.' }),
    ).toBeGreaterThan(0)
  })

  it('ranks exact value > prefix value > mid-value word start > keywords > earlier description > later description', () => {
    const matchGsap = createSearchMatcher('gsap')

    const exact = matchGsap({ value: 'gsap', description: 'Animate anything.' })
    const prefix = matchGsap({ value: 'gsap-utils', description: 'Official skill.' })
    const midValue = matchGsap({
      value: 'cinematic-gsap-lenis-motion-system',
      description: 'Motion systems.',
    })
    const keywordOnly = matchGsap({
      value: 'scroll-choreography',
      keywords: ['gsap-helpers'],
      description: 'Scroll choreography helpers.',
    })
    const earlyDesc = matchGsap({
      value: 'web-motion',
      description: 'GSAP guidance for code-driven web motion.',
    })
    const lateDesc = matchGsap({
      value: 'editorial-motion',
      description:
        'Build expressive editorial web experiences with scroll-linked timelines, physics, and GSAP transitions.',
    })

    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(midValue)
    expect(midValue).toBeGreaterThan(keywordOnly)
    expect(keywordOnly).toBeGreaterThan(earlyDesc)
    expect(earlyDesc).toBeGreaterThan(lateDesc)
    expect(lateDesc).toBeGreaterThan(0)
  })

  it('requires every query token across value, keywords, and description', () => {
    const matcher = createSearchMatcher('react glassmorphism')

    expect(
      matcher({
        value: 'glass-cards',
        keywords: ['acme', 'React'],
        description: 'Frosted glassmorphism surfaces for web apps.',
      }),
    ).toBeGreaterThan(0)
    expect(
      matcher({
        value: 'glass-cards',
        keywords: ['acme', 'Vue'],
        description: 'Frosted glassmorphism surfaces for web apps.',
      }),
    ).toBe(0)
    expect(
      matcher({
        value: 'fast-ui',
        keywords: ['acme', 'React'],
        description: 'Build fast UIs.',
      }),
    ).toBe(0)
  })

  it('supports punctuated tokens literally and via parts fallback', () => {
    const threeMatcher = createSearchMatcher('three.js')
    expect(
      threeMatcher({
        value: 'woven-cloth',
        description: 'Build woven cloth in Three.js scenes.',
      }),
    ).toBeGreaterThan(0)
    expect(
      threeMatcher({
        value: 'three-scenes',
        description: 'Build three components in vanilla JS.',
      }),
    ).toBeGreaterThan(0)

    const systemMatcher = createSearchMatcher('design-system')
    expect(
      systemMatcher({
        value: 'token-kit',
        description: 'Create a modern design system with tokens.',
      }),
    ).toBeGreaterThan(0)
    expect(
      systemMatcher({
        value: 'token-kit',
        description: 'Create a modern design language.',
      }),
    ).toBe(0)
  })
})
