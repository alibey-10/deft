import { ConvexError } from 'convex/values'
import { describe, expect, it, vi } from 'vite-plus/test'

import { extractClientIp, hashClientIp } from '#/lib/client-ip.ts'
import {
  AUTO_APPROVE_STARS,
  assertSubmitSecret,
  assertValidCandidateUrls,
  checkSubmitRateLimits,
  constantTimeEqual,
  normalizeClientKey,
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

describe('extractClientIp', () => {
  it('prefers cf-connecting-ip over x-forwarded-for', () => {
    const headers = new Headers({
      'cf-connecting-ip': '203.0.113.10',
      'x-forwarded-for': '198.51.100.1, 198.51.100.2',
    })
    expect(extractClientIp((name) => headers.get(name))).toBe('203.0.113.10')
  })

  it('trims whitespace and lowercases IPv6 addresses', () => {
    expect(
      extractClientIp((name) => (name === 'cf-connecting-ip' ? '  2001:DB8::1  ' : undefined)),
    ).toBe('2001:db8::1')
  })

  it('ignores blank cf-connecting-ip and takes the first non-empty x-forwarded-for entry', () => {
    const headers = new Headers({
      'cf-connecting-ip': '   ',
      'x-forwarded-for': ' , 198.51.100.7 , 198.51.100.8',
    })
    expect(extractClientIp((name) => headers.get(name))).toBe('198.51.100.7')
  })

  it('falls back to "local" when headers are missing or blank', () => {
    expect(extractClientIp(() => undefined)).toBe('local')
    expect(
      extractClientIp((name) =>
        name === 'cf-connecting-ip' ? '' : name === 'x-forwarded-for' ? ' ,  ' : null,
      ),
    ).toBe('local')
  })

  it('reads headers case-insensitively with a real Headers object', () => {
    const headers = new Headers({
      'CF-Connecting-IP': '192.0.2.42',
    })
    expect(extractClientIp((name) => headers.get(name))).toBe('192.0.2.42')
  })
})

describe('hashClientIp', () => {
  it('produces a deterministic 64-char lowercase hex digest without leaking the raw IP', async () => {
    const a = await hashClientIp('203.0.113.10', 'secret-pepper')
    const b = await hashClientIp('203.0.113.10', 'secret-pepper')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).toBe(b)
    expect(a).not.toContain('203.0.113.10')
  })

  it('varies across different IPs and different peppers', async () => {
    const ip1 = await hashClientIp('203.0.113.10', 'pepper-1')
    const ip2 = await hashClientIp('203.0.113.11', 'pepper-1')
    const otherPepper = await hashClientIp('203.0.113.10', 'pepper-2')
    expect(ip1).not.toBe(ip2)
    expect(ip1).not.toBe(otherPepper)
  })
})

describe('constantTimeEqual and assertSubmitSecret', () => {
  it('compares equal, unequal, and differently sized strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
    expect(constantTimeEqual('abc', 'abd')).toBe(false)
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
  })

  it('accepts SUBMIT_TOKEN and rejects ADMIN_TOKEN when SUBMIT_TOKEN is non-empty', () => {
    const env = { SUBMIT_TOKEN: 'submit-only', ADMIN_TOKEN: 'admin-only' }
    expect(() => assertSubmitSecret('submit-only', env)).not.toThrow()
    expect(() => assertSubmitSecret('admin-only', env)).toThrowError(ConvexError)
  })

  it('falls back to ADMIN_TOKEN when SUBMIT_TOKEN is unset or empty', () => {
    expect(() => assertSubmitSecret('admin-secret', { ADMIN_TOKEN: 'admin-secret' })).not.toThrow()
    expect(() =>
      assertSubmitSecret('admin-secret', { SUBMIT_TOKEN: '', ADMIN_TOKEN: 'admin-secret' }),
    ).not.toThrow()
  })

  it('fails closed on missing env tokens or mismatched secrets', () => {
    expect(() => assertSubmitSecret('anything', {})).toThrowError(ConvexError)
    expect(() => assertSubmitSecret('', { ADMIN_TOKEN: '' })).toThrowError(ConvexError)
    expect(() => assertSubmitSecret('wrong-secret', { ADMIN_TOKEN: 'admin-secret' })).toThrowError(
      ConvexError,
    )
    expect(() => assertSubmitSecret('admin-secreX', { ADMIN_TOKEN: 'admin-secret' })).toThrowError(
      ConvexError,
    )
  })
})

describe('normalizeClientKey', () => {
  it('trims valid client keys', () => {
    expect(normalizeClientKey('  abc123  ')).toBe('abc123')
  })

  it('throws ConvexError for empty or overly long client keys', () => {
    expect(() => normalizeClientKey('')).toThrowError(ConvexError)
    expect(() => normalizeClientKey('   ')).toThrowError(ConvexError)
    expect(() => normalizeClientKey('a'.repeat(129))).toThrowError(ConvexError)
  })
})

describe('checkSubmitRateLimits', () => {
  it('checks submitPerIp before submitGlobal and allows when both pass', async () => {
    const limitFn = vi.fn(async () => ({ ok: true }))
    const allowed = await checkSubmitRateLimits(limitFn, 'hashed-ip')
    expect(allowed).toBe(true)
    expect(limitFn).toHaveBeenNthCalledWith(1, 'submitPerIp', 'hashed-ip')
    expect(limitFn).toHaveBeenNthCalledWith(2, 'submitGlobal')
    expect(limitFn).toHaveBeenCalledTimes(2)
  })

  it('short-circuits without consuming global quota when per-IP limit rejects', async () => {
    const limitFn = vi.fn(async (name: 'submitPerIp' | 'submitGlobal') => ({
      ok: name !== 'submitPerIp',
    }))
    const allowed = await checkSubmitRateLimits(limitFn, 'hashed-ip')
    expect(allowed).toBe(false)
    expect(limitFn).toHaveBeenCalledTimes(1)
    expect(limitFn).toHaveBeenCalledWith('submitPerIp', 'hashed-ip')
  })

  it('rejects when per-IP allows but global limit rejects', async () => {
    const limitFn = vi.fn(async (name: 'submitPerIp' | 'submitGlobal') => ({
      ok: name !== 'submitGlobal',
    }))
    const allowed = await checkSubmitRateLimits(limitFn, 'hashed-ip')
    expect(allowed).toBe(false)
    expect(limitFn).toHaveBeenCalledTimes(2)
  })
})
