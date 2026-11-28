import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter'

import { components } from './_generated/api'

/**
 * Rate limits for public-facing actions, backed by `@convex-dev/rate-limiter`.
 *
 * - `submitPerIp`: 5 submissions per 10 minutes per hashed client IP (burst capacity 5).
 * - `submitGlobal`: 60 submissions per hour across all callers, protecting the shared
 *   GITHUB_TOKEN (5,000 req/hr shared with scan/discovery crons) and OPENROUTER_API_KEY.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  submitPerIp: {
    kind: 'token bucket',
    rate: 5,
    period: 10 * MINUTE,
    capacity: 5,
  },
  submitGlobal: {
    kind: 'fixed window',
    rate: 60,
    period: HOUR,
  },
})
