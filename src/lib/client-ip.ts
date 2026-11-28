/**
 * Extracts the client IP from incoming request headers on the server.
 *
 * Prefers Cloudflare's `cf-connecting-ip`, then the first entry of `x-forwarded-for`,
 * falling back to `'local'` in local development where proxy headers are absent.
 */
export function extractClientIp(
  getHeader: (name: 'cf-connecting-ip' | 'x-forwarded-for') => string | null | undefined,
): string {
  const cfIp = getHeader('cf-connecting-ip')?.trim()
  if (cfIp) return cfIp.toLowerCase()

  const forwarded = getHeader('x-forwarded-for')
  if (forwarded) {
    for (const part of forwarded.split(',')) {
      const candidate = part.trim()
      if (candidate) return candidate.toLowerCase()
    }
  }

  return 'local'
}

/**
 * Hashes a client IP with SHA-256 (and an optional server pepper) into a non-PII rate-limit key.
 */
export async function hashClientIp(ip: string, pepper = ''): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`skilly-submit:${pepper}:${ip}`),
  )
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
