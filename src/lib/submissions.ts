import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { isAdminRequest } from '#/lib/admin.server.ts'
import { getConvex } from '#/lib/skill-source.server.ts'
import { getSubmitClientKey, getSubmitSecret } from '#/lib/submissions.server.ts'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { topicSlugs } from '../../convex/validators.ts'

const submitInput = z.object({
  url: z.string().min(1).max(2000),
})

/**
 * Submits a skill URL through the Worker so Convex can verify the shared server secret and
 * enforce per-IP and global rate limits on a hashed client IP.
 *
 * Requires `SUBMIT_TOKEN` or `ADMIN_TOKEN` to match between the Worker (or `.env.local` in
 * local dev) and the Convex deployment, matching `listPendingServerFn` / `reviewSubmissionServerFn`.
 */
export const submitSkillServerFn = createServerFn({ method: 'POST' })
  .validator((data: z.input<typeof submitInput>) => submitInput.parse(data))
  .handler(async ({ data }) => {
    const secret = getSubmitSecret()
    if (!secret) throw new Error('Submissions are not configured (set SUBMIT_TOKEN or ADMIN_TOKEN)')
    const clientKey = await getSubmitClientKey(secret)
    return getConvex().action(api.submissions.submit, {
      url: data.url,
      secret,
      clientKey,
    })
  })

/**
 * Review of submitted skills. Convex has no accounts, so these server functions check the admin
 * cookie and pass the Worker's ADMIN_TOKEN on to Convex, which compares it with its own copy.
 */
const adminSecret = async () => {
  const secret = process.env.ADMIN_TOKEN
  if (!secret || !(await isAdminRequest())) return null
  return secret
}

/** Pending submissions, or null when the request isn't from a signed-in admin. */
export const listPendingServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const secret = await adminSecret()
  if (!secret) return null
  return getConvex().query(api.submissions.listPending, { secret })
})

const reviewInput = z.object({
  skillId: z.string().min(1).max(64),
  decision: z.enum(['approve', 'reject']),
  topics: z.array(z.enum(topicSlugs)).min(1).max(8).optional(),
  reason: z.string().max(500).optional(),
})

export const reviewSubmissionServerFn = createServerFn({ method: 'POST' })
  .validator((data: z.input<typeof reviewInput>) => reviewInput.parse(data))
  .handler(async ({ data }) => {
    const secret = await adminSecret()
    if (!secret) throw new Error('Sign in as an admin first')
    return getConvex().mutation(api.submissions.review, {
      secret,
      ...data,
      skillId: data.skillId as Id<'skills'>,
    })
  })
