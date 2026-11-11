import { useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'

import { PageIntro } from '#/components/site-header.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Field, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Spinner } from '#/components/ui/spinner.tsx'
import { adminSignInServerFn, getIsAdminServerFn } from '#/lib/admin.ts'

export const Route = createFileRoute('/admin/login')({
  loader: async () => ({ isAdmin: await getIsAdminServerFn() }),
  head: () => ({
    meta: [{ title: 'Admin sign in · Deft' }, { name: 'robots', content: 'noindex' }],
  }),
  component: AdminLoginPage,
})

function AdminLoginPage() {
  const { isAdmin } = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const [token, setToken] = useState('')
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const submit = async () => {
    setPending(true)
    setFailed(false)
    try {
      const { ok } = await adminSignInServerFn({ data: { token } })
      if (!ok) {
        setFailed(true)
        return
      }
      await router.invalidate()
      await navigate({ to: '/ask' })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex max-w-sm flex-col">
      <PageIntro
        eyebrow="Admin"
        title="Sign in"
        description={
          isAdmin
            ? "You're signed in as an admin. The assistant's model picker is unlocked."
            : 'Enter the admin token to unlock admin features, like choosing the assistant model.'
        }
      />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <FieldGroup>
          <Field data-invalid={failed || undefined}>
            <FieldLabel htmlFor="admin-token">Admin token</FieldLabel>
            <Input
              id="admin-token"
              type="password"
              autoComplete="current-password"
              required
              value={token}
              aria-invalid={failed || undefined}
              onChange={(event) => setToken(event.target.value)}
            />
            {failed && <FieldError>That token isn't right.</FieldError>}
          </Field>
          <Field orientation="horizontal">
            <Button type="submit" disabled={pending || !token}>
              {pending && <Spinner data-icon="inline-start" />}
              Sign in
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
