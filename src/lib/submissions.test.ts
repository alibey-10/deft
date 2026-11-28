import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vite-plus/test'

import {
  AUTO_APPROVE_STARS,
  assertValidCandidateUrls,
  shouldAutoApprove,
} from '../../convex/submissions.ts'

describe('shouldAutoApprove', () => {
  it('approves only when stars meet the threshold and tree lookup succeeded', () => {
    expect(shouldAutoApprove(AUTO_APPROVE_STARS, 'ok')).toBe(true)
    expect(shouldAutoApprove(AUTO_APPROVE_STARS + 100, 'ok')).toBe(true)
  })

  it('does not auto-approve when tree lookup failed or repo lacks stars', () => {
    expect(shouldAutoApprove(AUTO_APPROVE_STARS, 'not-found')).toBe(false)
    expect(shouldAutoApprove(AUTO_APPROVE_STARS, 'error')).toBe(false)
    expect(shouldAutoApprove(AUTO_APPROVE_STARS - 1, 'ok')).toBe(false)
  })
})

describe('assertValidCandidateUrls', () => {
  const validCandidate = {
    owner: 'vercel',
    repo: 'next.js',
    rawUrl: 'https://raw.githubusercontent.com/vercel/next.js/main/skills/ui/SKILL.md',
    githubUrl: 'https://github.com/vercel/next.js/blob/main/skills/ui/SKILL.md',
  }

  it('accepts valid rawUrl and githubUrl for the candidate owner/repo', () => {
    expect(() => assertValidCandidateUrls(validCandidate)).not.toThrow()
  })

  it.each([
    {
      label: 'rawUrl traversal',
      candidate: {
        ...validCandidate,
        rawUrl:
          'https://raw.githubusercontent.com/vercel/next.js/../../attacker/evil/main/SKILL.md',
      },
    },
    {
      label: 'githubUrl traversal',
      candidate: {
        ...validCandidate,
        githubUrl: 'https://github.com/vercel/next.js/blob/../../attacker/evil/main/SKILL.md',
      },
    },
    {
      label: 'host mismatch',
      candidate: {
        ...validCandidate,
        rawUrl: 'https://evil.com/vercel/next.js/main/skills/ui/SKILL.md',
      },
    },
    {
      label: 'owner/repo mismatch',
      candidate: {
        ...validCandidate,
        rawUrl: 'https://raw.githubusercontent.com/attacker/evil/main/skills/ui/SKILL.md',
      },
    },
    {
      label: 'githubUrl using /tree/ instead of /blob/',
      candidate: {
        ...validCandidate,
        githubUrl: 'https://github.com/vercel/next.js/tree/main/skills/ui/SKILL.md',
      },
    },
    {
      label: 'query injection on rawUrl',
      candidate: {
        ...validCandidate,
        rawUrl: `${validCandidate.rawUrl}?token=1`,
      },
    },
    {
      label: 'hash injection on githubUrl',
      candidate: {
        ...validCandidate,
        githubUrl: `${validCandidate.githubUrl}#L1`,
      },
    },
  ])('throws ConvexError on $label', ({ candidate }) => {
    expect(() => assertValidCandidateUrls(candidate)).toThrowError(ConvexError)
  })
})
