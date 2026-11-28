import { describe, expect, it } from 'vite-plus/test'

import { encodePath } from '../../convex/github.ts'
import {
  githubUrlFor,
  isExpectedGithubUrl,
  isExpectedRawUrl,
  parseRawUrl,
  parseSkillUrl,
  rawUrlFor,
} from '../../convex/githubUrls.ts'

describe('parseSkillUrl', () => {
  it('reads a file link', () => {
    expect(
      parseSkillUrl('https://github.com/acme/ui-skills/blob/main/skills/motion/SKILL.md'),
    ).toEqual({ owner: 'acme', repo: 'ui-skills', branch: 'main', path: 'skills/motion/SKILL.md' })
  })

  it('reads a folder link as the SKILL.md inside it', () => {
    expect(parseSkillUrl('https://github.com/acme/ui-skills/tree/main/skills/motion/')).toEqual({
      owner: 'acme',
      repo: 'ui-skills',
      branch: 'main',
      path: 'skills/motion/SKILL.md',
    })
  })

  it('reads a folder link at the repo root', () => {
    expect(parseSkillUrl('https://github.com/acme/ui-skills/tree/main/')).toEqual({
      owner: 'acme',
      repo: 'ui-skills',
      branch: 'main',
      path: 'SKILL.md',
    })
  })

  it('strips a trailing .git from a valid repo name', () => {
    expect(parseSkillUrl('https://github.com/acme/ui-skills.git/blob/main/SKILL.md')).toEqual({
      owner: 'acme',
      repo: 'ui-skills',
      branch: 'main',
      path: 'SKILL.md',
    })
  })

  it('reads a raw link, decoding the path', () => {
    expect(
      parseSkillUrl('https://raw.githubusercontent.com/acme/ui-skills/dev/my%20skill/SKILL.md'),
    ).toEqual({ owner: 'acme', repo: 'ui-skills', branch: 'dev', path: 'my skill/SKILL.md' })
  })

  it('reads a SKILL.md at the repo root', () => {
    expect(parseSkillUrl('https://github.com/acme/skill/blob/main/SKILL.md')?.path).toBe('SKILL.md')
  })

  it('ignores query strings and fragments', () => {
    expect(parseSkillUrl('https://github.com/acme/ui/blob/main/SKILL.md?plain=1#L4')?.path).toBe(
      'SKILL.md',
    )
  })

  it.each([
    'not a url',
    'https://gitlab.com/acme/ui/blob/main/SKILL.md',
    'https://github.com/acme/ui',
    'https://github.com/acme/ui/blob/main/README.md',
    'https://github.com/acme/ui/issues/1',
    'https://github.com/acme/ui/blob/main/../SKILL.md',
    'ftp://github.com/acme/ui/blob/main/SKILL.md',
    // Branch traversal
    'https://github.com/vercel/next.js/blob/..%2F..%2Fattacker%2Fevil%2Fmain/SKILL.md',
    'https://github.com/vercel/next.js/tree/..%2F..%2Fattacker%2Fevil%2Fmain/skills/x',
    'https://raw.githubusercontent.com/vercel/next.js/..%2F..%2Fattacker%2Fevil%2Fmain/SKILL.md',
    // Branch special characters and dot segments
    'https://github.com/acme/ui/blob/feat%2Fx/SKILL.md',
    'https://github.com/acme/ui/blob/feat%5Cx/SKILL.md',
    'https://github.com/acme/ui/blob/main%3Fx=1/SKILL.md',
    'https://github.com/acme/ui/blob/main%23frag/SKILL.md',
    'https://github.com/acme/ui/blob/main%25/SKILL.md',
    'https://github.com/acme/ui/blob/./SKILL.md',
    'https://github.com/acme/ui/blob/../SKILL.md',
    'https://github.com/acme/ui/blob/%2e/SKILL.md',
    'https://github.com/acme/ui/blob/%2e%2e/SKILL.md',
    // Invalid owner and repo segments
    'https://github.com/./ui/blob/main/SKILL.md',
    'https://github.com/../ui/blob/main/SKILL.md',
    'https://github.com/acme/./blob/main/SKILL.md',
    'https://github.com/acme/../blob/main/SKILL.md',
    'https://github.com/acme/.git/blob/main/SKILL.md',
    'https://github.com/acme/..git/blob/main/SKILL.md',
    'https://github.com/acme/...git/blob/main/SKILL.md',
    'https://raw.githubusercontent.com/./ui/main/SKILL.md',
    'https://raw.githubusercontent.com/../ui/main/SKILL.md',
    'https://raw.githubusercontent.com/acme/./main/SKILL.md',
    'https://raw.githubusercontent.com/acme/../main/SKILL.md',
    'https://raw.githubusercontent.com/acme/.git/main/SKILL.md',
    // Encoded path traversal inside path segments
    'https://github.com/acme/ui/blob/main/..%2F..%2F..%2Fattacker%2Fevil%2Fmain/skills/x/SKILL.md',
    'https://raw.githubusercontent.com/acme/ui/main/..%2F..%2F..%2Fattacker%2Fevil%2Fmain/skills/x/SKILL.md',
    'https://github.com/acme/ui/blob/main/%2e%2e/SKILL.md',
    'https://github.com/acme/ui/blob/main/skills/%2e%2e/SKILL.md',
    'https://raw.githubusercontent.com/acme/ui/main/skills/%2e%2e/SKILL.md',
    'https://github.com/acme/ui/blob/main/skills%5Cx/SKILL.md',
    'https://github.com/acme/ui/blob/main/skills\\x/SKILL.md',
    'https://github.com/acme/ui/blob/main/skills//SKILL.md',
    // Malformed percent-encoding
    'https://github.com/acme/ui/blob/%ZZ/SKILL.md',
    'https://github.com/acme/ui/blob/main/%ZZ/SKILL.md',
    'https://github.com/%ZZ/ui/blob/main/SKILL.md',
    'https://raw.githubusercontent.com/acme/ui/main/%ZZ/SKILL.md',
  ])('rejects %s', (input) => {
    expect(parseSkillUrl(input)).toBeNull()
  })
})

describe('rawUrlFor / githubUrlFor / parseRawUrl', () => {
  it('encodes owner, repo, and branch without double-encoding encoded paths', () => {
    const encoded = encodePath({
      owner: 'acme',
      repo: 'ui-skills',
      branch: '../../attacker/evil/main?x=1#y%z',
      path: 'my skill/SKILL.md',
    })
    expect(rawUrlFor(encoded)).toBe(
      'https://raw.githubusercontent.com/acme/ui-skills/..%2F..%2Fattacker%2Fevil%2Fmain%3Fx%3D1%23y%25z/my%20skill/SKILL.md',
    )
    expect(githubUrlFor(encoded)).toBe(
      'https://github.com/acme/ui-skills/blob/..%2F..%2Fattacker%2Fevil%2Fmain%3Fx%3D1%23y%25z/my%20skill/SKILL.md',
    )
  })

  it('encodes special characters in owner and repo', () => {
    const encoded = encodePath({
      owner: 'o/1',
      repo: 'r?2',
      branch: 'main',
      path: 'SKILL.md',
    })
    expect(rawUrlFor(encoded)).toBe('https://raw.githubusercontent.com/o%2F1/r%3F2/main/SKILL.md')
    expect(githubUrlFor(encoded)).toBe('https://github.com/o%2F1/r%3F2/blob/main/SKILL.md')
  })

  it('round-trips encoded owner, repo, branch, and path in parseRawUrl', () => {
    const original = {
      owner: 'acme',
      repo: 'ui-skills',
      branch: 'feat/my branch',
      path: 'my skill/SKILL.md',
    }
    const rawUrl = rawUrlFor(encodePath(original))
    expect(parseRawUrl(rawUrl)).toEqual(original)
  })

  it('returns null from parseRawUrl on malformed percent-encoding', () => {
    expect(
      parseRawUrl('https://raw.githubusercontent.com/acme/ui-skills/main/%ZZ/SKILL.md'),
    ).toBeNull()
  })
})

describe('isExpectedRawUrl / isExpectedGithubUrl', () => {
  it('accepts valid URLs including case-insensitive owner/repo and encoded spaces', () => {
    expect(
      isExpectedRawUrl(
        'https://raw.githubusercontent.com/Vercel/Next.js/main/SKILL.md',
        'vercel',
        'next.js',
      ),
    ).toBe(true)
    expect(
      isExpectedRawUrl(
        'https://raw.githubusercontent.com/acme/ui-skills/dev/my%20skill/SKILL.md',
        'acme',
        'ui-skills',
      ),
    ).toBe(true)
    expect(
      isExpectedGithubUrl(
        'https://github.com/Vercel/Next.js/blob/main/skills/my%20skill/SKILL.md',
        'vercel',
        'next.js',
      ),
    ).toBe(true)
  })

  it.each([
    'https://raw.githubusercontent.com/vercel/next.js/../../attacker/evil/main/SKILL.md',
    'https://raw.githubusercontent.com/vercel/next.js/..%2F..%2Fattacker%2Fevil%2Fmain/SKILL.md',
    'https://raw.githubusercontent.com/vercel/next.js/main/..%2F..%2F..%2Fattacker/SKILL.md',
    'https://raw.githubusercontent.com/vercel/next.js/main/skills/%2e%2e/SKILL.md',
    'https://raw.githubusercontent.com/vercel/next.js/main/%5C/SKILL.md',
    'https://raw.githubusercontent.com/vercel/next.js/main/skills/../SKILL.md',
    'https://evil.com/vercel/next.js/main/SKILL.md',
    'https://github.com/vercel/next.js/main/SKILL.md',
    'http://raw.githubusercontent.com/vercel/next.js/main/SKILL.md',
    'https://raw.githubusercontent.com/vercel/next.js/main/README.md',
    'https://raw.githubusercontent.com/vercel/next.js/SKILL.md',
    'https://raw.githubusercontent.com/vercel/next.js.evil/main/SKILL.md',
    'https://raw.githubusercontent.com/other/next.js/main/SKILL.md',
    'https://raw.githubusercontent.com/vercel/next.js/main/SKILL.md?foo=1',
    'https://raw.githubusercontent.com/vercel/next.js/main/SKILL.md#frag',
    'https://raw.githubusercontent.com/vercel/next.js/main/SKILL.md?',
    'https://raw.githubusercontent.com/vercel/next.js/main/SKILL.md#',
    'https://raw.githubusercontent.com/vercel/next.js/main/%ZZ/SKILL.md',
  ])('rejects rawUrl %s', (rawUrl) => {
    expect(isExpectedRawUrl(rawUrl, 'vercel', 'next.js')).toBe(false)
  })

  it.each([
    'https://github.com/vercel/next.js/blob/../../attacker/evil/main/SKILL.md',
    'https://github.com/vercel/next.js/blob/..%2F..%2Fattacker%2Fevil%2Fmain/SKILL.md',
    'https://github.com/vercel/next.js/blob/main/..%2F..%2F..%2Fattacker/SKILL.md',
    'https://github.com/vercel/next.js/blob/main/skills/%2e%2e/SKILL.md',
    'https://github.com/vercel/next.js/blob/main/%5C/SKILL.md',
    'https://github.com/vercel/next.js/blob/main/skills/../SKILL.md',
    'https://www.github.com/vercel/next.js/blob/main/SKILL.md',
    'https://evil.com/vercel/next.js/blob/main/SKILL.md',
    'https://raw.githubusercontent.com/vercel/next.js/blob/main/SKILL.md',
    'http://github.com/vercel/next.js/blob/main/SKILL.md',
    'https://github.com/vercel/next.js/tree/main/SKILL.md',
    'https://github.com/vercel/next.js/blob/main/README.md',
    'https://github.com/vercel/next.js/blob/SKILL.md',
    'https://github.com/vercel/next.js.evil/blob/main/SKILL.md',
    'https://github.com/other/next.js/blob/main/SKILL.md',
    'https://github.com/vercel/next.js/blob/main/SKILL.md?plain=1',
    'https://github.com/vercel/next.js/blob/main/SKILL.md#L4',
    'https://github.com/vercel/next.js/blob/main/SKILL.md?',
    'https://github.com/vercel/next.js/blob/main/SKILL.md#',
    'https://github.com/vercel/next.js/blob/main/%ZZ/SKILL.md',
  ])('rejects githubUrl %s', (githubUrl) => {
    expect(isExpectedGithubUrl(githubUrl, 'vercel', 'next.js')).toBe(false)
  })

  it('rejects invalid owner or repo arguments', () => {
    expect(
      isExpectedRawUrl('https://raw.githubusercontent.com/./next.js/main/SKILL.md', '.', 'next.js'),
    ).toBe(false)
    expect(
      isExpectedRawUrl('https://raw.githubusercontent.com/vercel/../main/SKILL.md', 'vercel', '..'),
    ).toBe(false)
    expect(isExpectedGithubUrl('https://github.com/a/b/c/blob/main/SKILL.md', 'a/b', 'c')).toBe(
      false,
    )
  })
})
