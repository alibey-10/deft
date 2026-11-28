import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlusSignIcon, Tick02Icon } from '@hugeicons/core-free-icons'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog.tsx'
import { Field, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Spinner } from '#/components/ui/spinner.tsx'
import { topicBySlug } from '#/data/topics.ts'
import { submitSkillServerFn } from '#/lib/submissions.ts'

type Result = Awaited<ReturnType<typeof submitSkillServerFn>>
type Failure = Extract<Result, { ok: false }>
type Success = Extract<Result, { ok: true }>
type Skipped = Success['skipped'][number]

const urlErrors: Partial<Record<Failure['error'], string>> = {
  'invalid-url': 'Paste a GitHub link to a skill’s folder or SKILL.md, or a folder of skills.',
  'repo-not-found': "That repo doesn't exist or isn't public.",
  'file-not-found': 'There’s no SKILL.md at that link. Check the branch and path.',
  'no-frontmatter':
    'That SKILL.md needs a name and description in its frontmatter before it can be listed.',
}

/** The header's "Submit" button and the dialog it opens. */
export function SubmitSkillDialog() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<Failure | 'unexpected' | null>(null)
  const [submitted, setSubmitted] = useState<Success | null>(null)

  const reset = () => {
    setUrl('')
    setFailure(null)
    setSubmitted(null)
  }

  const submit = async () => {
    setPending(true)
    setFailure(null)
    try {
      const result = await submitSkillServerFn({ data: { url } })
      if (result.ok) setSubmitted(result)
      else setFailure(result)
    } catch {
      setFailure('unexpected')
    } finally {
      setPending(false)
    }
  }

  const urlError = failure && failure !== 'unexpected' ? urlErrors[failure.error] : undefined
  // Everything at the link is already known; editing the link clears this.
  const alreadySubmitted =
    failure !== null &&
    failure !== 'unexpected' &&
    (failure.error === 'exists' ||
      (failure.error === 'nothing-new' && failure.skipped.every((s) => s.reason === 'exists')))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        setOpen(next)
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) reset()
      }}
    >
      <DialogTrigger aria-label="Submit a skill" render={<Button variant="ghost" size="sm" />}>
        <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" aria-hidden />
        <span className="max-sm:hidden">Submit</span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <>
            <SubmittedSummary added={submitted.added} onNavigate={() => setOpen(false)} />
            {submitted.skipped.length > 0 && <SkippedList skipped={submitted.skipped} />}
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Submit another
              </Button>
              <DialogClose render={<Button />}>Done</DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <DialogHeader>
              <DialogTitle>Submit a skill</DialogTitle>
              <DialogDescription>
                Share a skill that helps agents design or build interfaces. Its topics are picked
                for you, and skills from repos with 10+ stars are listed straight away.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup>
              <Field data-invalid={urlError ? true : undefined}>
                <FieldLabel htmlFor="submit-skill-url">GitHub link</FieldLabel>
                <Input
                  id="submit-skill-url"
                  type="url"
                  inputMode="url"
                  required
                  autoComplete="off"
                  placeholder="https://github.com/owner/repo/tree/main/skills/name"
                  value={url}
                  disabled={pending}
                  aria-invalid={urlError ? true : undefined}
                  onChange={(event) => {
                    setUrl(event.target.value)
                    if (failure) setFailure(null)
                  }}
                />
                {urlError && <FieldError>{urlError}</FieldError>}
              </Field>

              {failure && <SubmitAlert failure={failure} onNavigate={() => setOpen(false)} />}
            </FieldGroup>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" disabled={pending} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={pending || alreadySubmitted || !url.trim()}>
                {pending && <Spinner data-icon="inline-start" />}
                {alreadySubmitted && (
                  <HugeiconsIcon icon={Tick02Icon} data-icon="inline-start" aria-hidden />
                )}
                {pending
                  ? 'Reading the skill…'
                  : alreadySubmitted
                    ? 'Successfully submitted'
                    : 'Submit'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Failures that aren't about the link field itself. */
function SubmitAlert({
  failure,
  onNavigate,
}: {
  failure: Failure | 'unexpected'
  onNavigate: () => void
}) {
  if (
    failure === 'unexpected' ||
    failure.error === 'rate-limited' ||
    failure.error === 'busy' ||
    failure.error === 'unavailable'
  )
    return (
      <Alert variant="destructive">
        <AlertTitle>
          {failure !== 'unexpected' && failure.error === 'rate-limited'
            ? 'Too many submissions'
            : 'Couldn’t submit right now'}
        </AlertTitle>
        <AlertDescription>
          {failure === 'unexpected'
            ? 'Something went wrong on our side. Try again in a moment.'
            : failure.error === 'rate-limited'
              ? 'Too many submissions right now. Please wait a few minutes and try again.'
              : failure.error === 'busy'
                ? 'GitHub is limiting our requests. Try again in a few minutes.'
                : 'We couldn’t analyze the skill just now. Try again in a moment.'}
        </AlertDescription>
      </Alert>
    )
  if (failure.error === 'not-ui')
    return (
      <Alert>
        <AlertTitle>Doesn’t look like a UI skill</AlertTitle>
        <AlertDescription>
          This directory lists skills for designing and building interfaces, and this one seems to
          be about something else.
        </AlertDescription>
      </Alert>
    )
  if (failure.error === 'nothing-new')
    return (
      <Alert>
        <AlertTitle>Nothing new in that folder</AlertTitle>
        <AlertDescription>
          <SkippedList skipped={failure.skipped} />
        </AlertDescription>
      </Alert>
    )
  if (failure.error !== 'exists') return null

  const { existing } = failure
  const listed =
    (existing.status === 'approved' || existing.status === 'missing') && existing.pathSlug
  const what =
    existing.match === 'copy' ? 'A skill with the same name and description' : 'This skill'
  return (
    <Alert>
      <AlertTitle>Already in the directory</AlertTitle>
      <AlertDescription>
        {listed ? (
          <>
            {what} is already listed as{' '}
            <Link
              to="/skills/$"
              params={{ _splat: existing.pathSlug }}
              onClick={onNavigate}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {existing.name}
            </Link>
            .
          </>
        ) : existing.status === 'pending' ? (
          `${what} was already submitted and is waiting for review.`
        ) : (
          `${what} was already reviewed and isn’t listed.`
        )}
      </AlertDescription>
    </Alert>
  )
}

type Added = Success['added'][number]

/** What a submission added: approved skills link to their page, the rest wait for review. */
function SubmittedSummary({ added, onNavigate }: { added: Added[]; onNavigate: () => void }) {
  const listed = added.filter((a) => a.pathSlug)
  const queued = added.filter((a) => !a.pathSlug)
  const count = (n: number) => (n === 1 ? '1 skill' : `${n} skills`)
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {listed.length ? 'Added to the directory' : 'Thanks, it’s in the queue'}
        </DialogTitle>
        <DialogDescription>
          {listed.length
            ? `${count(listed.length)} from a popular repo went straight in, with topics picked for you.`
            : `${count(queued.length)} waiting for review. Approved skills show up in the directory.`}
          {listed.length > 0 && queued.length > 0 && ` ${count(queued.length)} waiting for review.`}
        </DialogDescription>
      </DialogHeader>
      {listed.length > 0 && (
        <SkillNames label="Listed">
          {listed.map((skill) => (
            <li key={skill.pathSlug}>
              <Link
                to="/skills/$"
                params={{ _splat: skill.pathSlug }}
                onClick={onNavigate}
                className="font-medium underline-offset-4 hover:underline"
              >
                {skill.name}
              </Link>
              <TopicNames topics={skill.topics} />
            </li>
          ))}
        </SkillNames>
      )}
      {queued.length > 0 && (
        <SkillNames label="Waiting for review">
          {queued.map((skill) => (
            <li key={skill.name}>
              <span className="font-medium">{skill.name}</span>
              <TopicNames topics={skill.topics} />
            </li>
          ))}
        </SkillNames>
      )}
    </>
  )
}

/** The topics the classifier picked, after a skill's name. */
function TopicNames({ topics }: { topics: Added['topics'] }) {
  return (
    <span className="text-muted-foreground">
      {' · '}
      {topics.map((slug) => topicBySlug.get(slug)?.label ?? slug).join(', ')}
    </span>
  )
}

function SkillNames({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  )
}

const skipReason = (skip: Skipped) =>
  skip.reason === 'no-frontmatter'
    ? 'no name or description in its frontmatter'
    : skip.reason === 'not-ui'
      ? 'doesn’t look like a UI skill'
      : skip.existing?.status === 'pending'
        ? 'already waiting for review'
        : skip.existing?.status === 'rejected'
          ? 'already reviewed'
          : 'already listed'

/** Skills from a folder link that weren't submitted, and why. */
function SkippedList({ skipped }: { skipped: Skipped[] }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="text-muted-foreground">Skipped</div>
      <ul className="flex flex-col gap-1">
        {skipped.map((skip) => (
          <li key={skip.name}>
            <span className="font-medium">{skip.name}</span>
            <span className="text-muted-foreground"> · {skipReason(skip)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
