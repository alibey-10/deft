import { describe, expect, it } from 'vite-plus/test'

import { parseSkillUrl } from '../../convex/githubUrls.ts'

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
  ])('rejects %s', (input) => {
    expect(parseSkillUrl(input)).toBeNull()
  })
})
