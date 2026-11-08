import { useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'

import { PageIntro } from '#/components/site-header.tsx'
import { TopicCombobox } from '#/components/topic-combobox.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Field, FieldError, FieldLabel } from '#/components/ui/field.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Spinner } from '#/components/ui/spinner.tsx'
import type { TopicSlug } from '#/data/registry.ts'
import { listPendingServerFn, reviewSubmissionServerFn } from '#/lib/submissions.ts'

type Submission = NonNullable<Awaited<ReturnType<typeof listPendingServerFn>>>[number]

export const Route = createFileRoute('/admin/submissions')({
  loader: () => listPendingServerFn(),
  head: () => ({
    meta: [{ title: 'Submissions · Skilly' }, { name: 'robots', content: 'noindex' }],
  }),
  component: SubmissionsPage,
})

// Fixed time zone so the server render and the browser agree.
const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })

function SubmissionsPage() {
  const pending = Route.useLoaderData()

  if (!pending)
    return (
      <PageIntro
        eyebrow="Admin"
        title="Submissions"
        description={
          <>
            <Link to="/admin/login" className="text-foreground underline underline-offset-4">
              Sign in as an admin
            </Link>{' '}
            to review submitted skills.
          </>
        }
      />
    )

  return (
    <>
      <PageIntro
        eyebrow="Admin"
        title="Submissions"
        description="Skills people submitted from the site, oldest first. Approving one adds it to the directory with the topics selected below."
      />
      {pending.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">Nothing waiting for review.</p>
      ) : (
        <ul className="flex flex-col">
          {pending.map((submission) => (
            <SubmissionEntry key={submission._id} submission={submission} />
          ))}
        </ul>
      )}
    </>
  )
}

function SubmissionEntry({ submission }: { submission: Submission }) {
  const router = useRouter()
  const [topics, setTopics] = useState<TopicSlug[]>(submission.topics)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const review = async (decision: 'approve' | 'reject') => {
    setBusy(decision)
    setError(null)
    try {
      await reviewSubmissionServerFn({
        data: {
          skillId: submission._id,
          decision,
          ...(decision === 'approve' ? { topics } : reason.trim() && { reason: reason.trim() }),
        },
      })
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed')
      setBusy(null)
    }
  }

  return (
    <li className="flex flex-col gap-4 border-t pt-5 pb-9">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <a
            href={submission.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="text-base font-semibold tracking-[-0.01em] underline-offset-4 hover:underline"
          >
            {submission.name}
          </a>
          <span className="text-sm text-muted-foreground tabular-nums">
            {dateFormat.format(submission._creationTime)}
          </span>
        </div>
        <div className="font-mono text-[0.8125rem] text-muted-foreground">
          {submission.user}/{submission.repo}
          {submission.files.length > 0 && ` · ${submission.files.length} extra files`}
        </div>
        <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
          {submission.description}
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor={`topics-${submission._id}`}>Topics</FieldLabel>
        <TopicCombobox
          id={`topics-${submission._id}`}
          value={topics}
          onChange={setTopics}
          max={4}
        />
      </Field>

      <Field data-invalid={error ? true : undefined}>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={busy !== null || topics.length === 0} onClick={() => review('approve')}>
            {busy === 'approve' && <Spinner data-icon="inline-start" />}
            Approve
          </Button>
          <Input
            aria-label={`Reason for rejecting ${submission.name} (optional)`}
            placeholder="Reason for rejecting (optional)"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            className="w-64 max-sm:flex-1"
          />
          <Button variant="destructive" disabled={busy !== null} onClick={() => review('reject')}>
            {busy === 'reject' && <Spinner data-icon="inline-start" />}
            Reject
          </Button>
        </div>
        {error && <FieldError>{error}</FieldError>}
      </Field>
    </li>
  )
}
