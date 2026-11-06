import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { isAdminRequest, signInAdmin, signOutAdmin } from '#/lib/admin.server.ts'

export const getIsAdminServerFn = createServerFn({ method: 'GET' }).handler(() => isAdminRequest())

export const adminSignInServerFn = createServerFn({ method: 'POST' })
  .validator((data: { token: string }) =>
    z.object({ token: z.string().min(1).max(512) }).parse(data),
  )
  .handler(async ({ data }) => ({ ok: await signInAdmin(data.token) }))

export const adminSignOutServerFn = createServerFn({ method: 'POST' }).handler(() => {
  signOutAdmin()
})
