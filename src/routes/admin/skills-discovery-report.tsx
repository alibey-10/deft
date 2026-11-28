import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { FunctionReturnType } from 'convex/server'
import { cn } from 'cn'

import { PageIntro } from '#/components/site-header.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { topicsBySlug } from '#/data/topics.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { MIN_INSTALLS, MIN_REPO_STARS } from '../../../convex/skillDiscoveryRules.ts'

type Report = FunctionReturnType<typeof api.skillDiscovery.report>
type Run = NonNullable<Report['run']>
type Candidate = Report['notUi'][number]

const reportQuery = (runId?: string) =>
  convexQuery(api.skillDiscovery.report, runId ? { runId: runId as Id<'discoveryRuns'> } : {})

export const Route = createFileRoute('/admin/skills-discovery-report')({
  validateSearch: (search: Record<string, unknown>): { run?: string } =>
    typeof search.run === 'string' && search.run ? { run: search.run } : {},
  loaderDeps: ({ search }) => ({ run: search.run }),
  loader: async ({ deps, context }) => {
    await context.queryClient.ensureQueryData(reportQuery(deps.run))
  },
  head: () => ({
    meta: [{ title: 'Skills discovery report - Deft' }, { name: 'robots', content: 'noindex' }],
  }),
  component: ReportPage,
})

// Fixed time zone so the server render and the browser agree.
const dateFormat = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})
const formatDate = (ms: number) => `${dateFormat.format(ms)} UTC`

const formatDuration = (ms: number) => {
  const minutes = Math.round(ms / 60_000)
  return minutes < 1 ? 'under a minute' : `${minutes} min`
}

const statusLabel: Record<Run['status'], string> = {
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
}

function ReportPage() {
  const { run: runId } = Route.useSearch()
  const { data } = useSuspenseQuery(reportQuery(runId))
  const { run } = data

  return (
    <>
      <PageIntro
        eyebrow="Admin"
        title="Skills discovery report"
        description="Every 2 days, skills.sh/trending is crawled and every GitHub repo on it is read. A DeepSeek model judges each new SKILL.md, and UI skills are added to the directory right away when the repo has 50+ stars or the skill has 100+ installs; the rest are listed here so you can see what was passed over."
      />
      {!run ? (
        <p className="py-12 text-center text-muted-foreground">No discovery runs yet.</p>
      ) : (
        <div className="flex flex-col gap-10">
          <RunSummary run={run} isLatest={run._id === data.runs[0]?._id} />
          <AddedSection added={data.added} />
          {data.notUi.length > 0 && (
            <PassedSection
              title="Passed over as not UI"
              intro="New SKILL.md files the classifier judged not to be UI skills, with its reason. Each file is judged once; later runs skip it."
              rows={data.notUi}
            />
          )}
          {data.duplicates.length > 0 && (
            <PassedSection
              title="Copies of known skills"
              intro="Same name and description as a skill already in the directory, already judged, or ranked higher in this run. Copies are never added."
              rows={data.duplicates}
            />
          )}
          {run.errors.length > 0 && (
            <ErrorsSection errors={run.errors} open={run.status === 'failed'} />
          )}
          <RunHistory runs={data.runs} selectedId={run._id} />
        </div>
      )}
    </>
  )
}

function RunSummary({ run, isLatest }: { run: Run; isLatest: boolean }) {
  const stats = [
    { label: 'Added', value: run.added },
    { label: 'Not UI', value: run.notUi },
    { label: 'Copies', value: run.duplicates ?? 0 },
    { label: 'Below the bar', value: run.belowThreshold },
    { label: 'Already known', value: run.alreadyKnown },
    { label: 'New authors', value: run.authorsAdded },
    { label: 'Trending skills', value: run.listed },
    { label: 'Repos read', value: run.reposRead },
  ]
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <Badge
          variant={
            run.status === 'failed'
              ? 'destructive'
              : run.status === 'running'
                ? 'secondary'
                : 'outline'
          }
        >
          {statusLabel[run.status]}
        </Badge>
        <span>
          {isLatest ? 'Latest run' : 'Run'} started {formatDate(run.startedAt)}
          {run.finishedAt && `, took ${formatDuration(run.finishedAt - run.startedAt)}`}
        </span>
        <span>· {run.trigger === 'cron' ? 'Scheduled' : 'Manual'}</span>
        {run.pages.map((page) => (
          <a
            key={page}
            href={page}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground hover:underline"
          >
            · {page.replace(/^https:\/\//, '')}
          </a>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4 lg:grid-cols-8">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 bg-background p-4">
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
      {run.belowThreshold > 0 && (
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
          {run.belowThreshold} new SKILL.md {run.belowThreshold === 1 ? 'file was' : 'files were'}{' '}
          skipped because the repo has under {MIN_REPO_STARS} stars and the skill isn't on the
          trending list with {MIN_INSTALLS}+ installs. They're checked again on the next run.
        </p>
      )}
    </section>
  )
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="flex items-baseline gap-2 text-xl font-semibold tracking-tight">
      {title}
      <span className="text-base font-normal text-muted-foreground tabular-nums">{count}</span>
    </h2>
  )
}

/** Candidates grouped by repo, repos in trending order. */
function byRepo<T extends Candidate>(rows: T[]) {
  const groups = new Map<string, T[]>()
  const sorted = [...rows].sort(
    (a, b) => (a.trendingRank ?? Infinity) - (b.trendingRank ?? Infinity),
  )
  for (const row of sorted) groups.set(row.repo, [...(groups.get(row.repo) ?? []), row])
  return [...groups]
}

function RepoHeading({ repo }: { repo: string }) {
  return (
    <h3 className="text-sm font-medium">
      <a
        href={`https://github.com/${repo}`}
        target="_blank"
        rel="noreferrer"
        className="hover:underline"
      >
        {repo}
      </a>
    </h3>
  )
}

function Reason({ candidate }: { candidate: Candidate }) {
  if (candidate.duplicateOf)
    return <p className="text-sm text-muted-foreground">Copy of {candidate.duplicateOf}</p>
  if (!candidate.reason) return null
  return <p className="text-sm text-pretty text-foreground/80">{candidate.reason}</p>
}

function CandidateMeta({ candidate }: { candidate: Candidate }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {candidate.trendingRank !== undefined && <span>#{candidate.trendingRank} on trending</span>}
      {candidate.installs !== undefined && (
        <span>{compact.format(candidate.installs)} installs</span>
      )}
      {candidate.stars !== undefined && <span>{compact.format(candidate.stars)} stars</span>}
      <a href={candidate.githubUrl} target="_blank" rel="noreferrer" className="hover:underline">
        <code className="truncate">{candidate.path}</code>
      </a>
    </div>
  )
}

function AddedSection({ added }: { added: Report['added'] }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title="Added to the directory" count={added.length} />
      {added.length === 0 ? (
        <p className="text-sm text-muted-foreground">No new UI skills in this run.</p>
      ) : (
        byRepo(added).map(([repo, rows]) => (
          <div key={repo} className="flex flex-col gap-2">
            <RepoHeading repo={repo} />
            <ul className="divide-y rounded-lg border">
              {rows.map((c) => (
                <li key={c._id} className="flex flex-col gap-1.5 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {c.pathSlug && c.status === 'approved' ? (
                      <Link
                        to="/skills/$"
                        params={{ _splat: c.pathSlug }}
                        className="font-medium hover:underline"
                      >
                        {c.name ?? c.path}
                      </Link>
                    ) : (
                      <span className="font-medium">{c.name ?? c.path}</span>
                    )}
                    {!c.exists && <Badge variant="destructive">Deleted</Badge>}
                    {c.exists && c.status !== 'approved' && (
                      <Badge variant="secondary">{c.status}</Badge>
                    )}
                    {c.topics.map((topic) => (
                      <Badge key={topic} variant="outline">
                        {topicsBySlug[topic].label}
                      </Badge>
                    ))}
                  </div>
                  {c.description && (
                    <p className="text-sm text-pretty text-muted-foreground">{c.description}</p>
                  )}
                  <Reason candidate={c} />
                  <CandidateMeta candidate={c} />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}

function PassedSection({
  title,
  intro,
  rows: all,
}: {
  title: string
  intro: string
  rows: Candidate[]
}) {
  return (
    <section className="flex flex-col gap-4">
      <details>
        <summary className="cursor-pointer list-none">
          <SectionHeading title={title} count={all.length} />
        </summary>
        <p className="mt-2 max-w-2xl text-sm text-pretty text-muted-foreground">{intro}</p>
        <div className="mt-4 flex flex-col gap-6">
          {byRepo(all).map(([repo, rows]) => (
            <div key={repo} className="flex flex-col gap-2">
              <RepoHeading repo={repo} />
              <ul className="divide-y rounded-lg border">
                {rows.map((c) => (
                  <li key={c._id} className="flex flex-col gap-1 p-3">
                    <span className="font-medium">{c.name ?? c.path}</span>
                    {c.description && (
                      <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">
                        {c.description}
                      </p>
                    )}
                    <Reason candidate={c} />
                    <CandidateMeta candidate={c} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}

function ErrorsSection({ errors, open }: { errors: Run['errors']; open: boolean }) {
  return (
    <section className="flex flex-col gap-4">
      <details open={open}>
        <summary className="cursor-pointer list-none">
          <SectionHeading title="Problems" count={errors.length} />
        </summary>
        <ul className="mt-4 divide-y rounded-lg border text-sm">
          {errors.map((e, i) => (
            <li key={i} className="flex flex-col gap-0.5 p-3">
              <span className="font-medium break-words">{e.target}</span>
              <span className="break-words text-muted-foreground">{e.message}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

function RunHistory({ runs, selectedId }: { runs: Report['runs']; selectedId: Run['_id'] }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title="Run history" count={runs.length} />
      <ul className="divide-y rounded-lg border text-sm">
        {runs.map((r) => (
          <li key={r._id}>
            <Link
              to="/admin/skills-discovery-report"
              search={{ run: r._id }}
              className={cn(
                'flex flex-wrap items-center gap-x-4 gap-y-1 p-3 hover:bg-muted',
                r._id === selectedId && 'bg-muted',
              )}
            >
              <span className="font-medium">{formatDate(r.startedAt)}</span>
              <span className="text-muted-foreground">
                {r.status !== 'done'
                  ? statusLabel[r.status]
                  : r.trigger === 'cron'
                    ? 'Scheduled'
                    : 'Manual'}
              </span>
              <span className="ml-auto text-muted-foreground tabular-nums">
                +{r.added} added · {r.notUi} not UI · {r.alreadyKnown} known
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
