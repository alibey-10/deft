import { getRequestHeader } from '@tanstack/react-start/server'

import { extractClientIp, hashClientIp } from '#/lib/client-ip.ts'

/**
 * Shared secret authenticating submission requests from the TanStack Start server to Convex.
 * Uses `SUBMIT_TOKEN` when set, falling back to `ADMIN_TOKEN` so existing deployments don't
 * require a new env var.
 */
export function getSubmitSecret(): string | null {
  return process.env.SUBMIT_TOKEN || process.env.ADMIN_TOKEN || null
}

/**
 * Derives a deterministic, non-PII SHA-256 key from the caller's IP address for rate limiting.
 */
export function getSubmitClientKey(pepper: string): Promise<string> {
  return hashClientIp(extractClientIp(getRequestHeader), pepper)
}
