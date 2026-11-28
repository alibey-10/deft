import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { FunctionReturnType } from 'convex/server'
import { cn } from 'cn'

import { PageIntro } from '#/components/site-header.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { MissingReason } from '../../../convex/validators.ts'

type Report = FunctionReturnType<typeof api.skillScan.report>
type Run = NonNullable<Report['run']>

const reportQuery = (runId?: string) =>
  convexQuery(api.skillScan.report, runId ? { runId: runId as Id<'scanRuns'> } : {})

export const Route = createFileRoute('/admin/skills-update-report')({
  validateSearch: (search: Record<string, unknown>): { run?: string } =>
    typeof search.run === 'string' && search.run ? { run: search.run } : {},
  loaderDeps: ({ search }) => ({ run: search.run }),
  loader: async ({ deps, context }) => {
    await context.queryClient.ensureQueryData(reportQuery(deps.run))
  },
  head: () => ({
    meta: [{ title: 'Skills update report - Deft' }, { name: 'robots', content: 'noindex' }],
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

const missingReasonLabel: Record<MissingReason, string> = {
  'repo-not-found': 'Repo not found',
  'branch-not-found': 'Branch not found',
  'file-not-found': 'File not found',
}

function ReportPage() {
  const { run: runId } = Route.useSearch()
  const { data } = useSuspenseQuery(reportQuery(runId))
  const { run } = data

  return (
    <>
      <PageIntro
        eyebrow="Admin"
        title="Skills update report"
        description="Every 3 days, each known author's GitHub repos are checked for SKILL.md files that aren't in the directory yet, and every directory skill is checked for a source file that has gone missing."
      />
      {!run ? (
        <p className="py-12 text-center text-muted-foreground">No scans have run yet.</p>
      ) : (
        <div className="flex flex-col gap-10">
          <RunSummary run={run} isLatest={run._id === data.runs[0]?._id} />
          <AddedSection added={data.added} />
          <MissingSection missing={data.missing} run={run} />
          {data.restored.length > 0 && <RestoredSection restored={data.restored} />}
          {run.errors.length > 0 && <ErrorsSection errors={run.errors} />}
          <RunHistory runs={data.runs} selectedId={run._id} />
        </div>
      )}
    </>
  )
}

function RunSummary({ run, isLatest }: { run: Run; isLatest: boolean }) {
  const stats = [
    { label: 'New skills', value: run.added },
    { label: 'Newly missing', value: run.newlyMissing },
    { label: 'Restored', value: run.restored },
    { label: 'Repos read', value: run.reposScanned },
    { label: 'Repos unchanged', value: run.reposUnchanged },
    { label: 'Baseline files', value: run.baselined },
  ]
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <Badge variant={run.status === 'running' ? 'secondary' : 'outline'}>
          {run.status === 'running'
            ? `Running · ${run.authorsDone}/${run.authorsTotal} authors`
            : 'Done'}
        </Badge>
        <span>
          {isLatest ? 'Latest scan' : 'Scan'} started {formatDate(run.startedAt)}
          {run.finishedAt && `, took ${formatDuration(run.finishedAt - run.startedAt)}`}
        </span>
        <span>· {run.trigger === 'cron' ? 'Scheduled' : 'Manual'}</span>
        <span>· {run.authorsTotal} authors</span>
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 bg-background p-4">
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
      {run.baselined > 0 && (
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
          {run.baselined} SKILL.md {run.baselined === 1 ? 'file was' : 'files were'} already in
          repos read for the first time, so {run.baselined === 1 ? 'it was' : 'they were'} recorded
          as a starting point instead of being reported as new. Files added after this scan show up
          as new skills.
        </p>
      )}
    </section>
  )
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="flex items-baseline gap-2 text-xl font-semibold tracking-tight">
      {title}
      <span className="text-base font-normal text-muted-foreground tabular-nums">{count}</span>
    </h2>
  )
}

function AddedSection({ added }: { added: Report['added'] }) {
  const byRepo = new Map<string, Report['added']>()
  for (const finding of added)
    byRepo.set(finding.repo, [...(byRepo.get(finding.repo) ?? []), finding])
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title="New skills" count={added.length} />
      {added.length === 0 ? (
        <p className="text-sm text-muted-foreground">No new SKILL.md files in this scan.</p>
      ) : (
        [...byRepo].map(([repo, findings]) => (
          <div key={repo} className="flex flex-col gap-2">
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
            <ul className="divide-y rounded-lg border">
              {findings.map((f) => (
                <li key={f._id} className="flex flex-col gap-1 p-3">
                  <a
                    href={f.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:underline"
                  >
                    {f.name ?? f.path.split('/').at(-2) ?? f.path}
                  </a>
                  {f.description && (
                    <p className="text-sm text-pretty text-muted-foreground">{f.description}</p>
                  )}
                  <code className="truncate text-xs text-muted-foreground">{f.path}</code>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}

function MissingSection({ missing, run }: { missing: Report['missing']; run: Run }) {
  const newThisRun = (since: number) =>
    since >= run.startedAt && since <= (run.finishedAt ?? Number.POSITIVE_INFINITY)
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title="Missing skills" count={missing.length} />
      <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
        Directory skills whose source file couldn't be found, as of the latest scan. They are hidden
        from the site and come back automatically once a scan finds the file again.
      </p>
      {missing.length === 0 ? (
        <p className="text-sm text-muted-foreground">Every directory skill was found.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {missing.map((s) => (
            <li
              key={s._id}
              className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {s.pathSlug && s.status === 'approved' ? (
                    <Link
                      to="/skills/$"
                      params={{ _splat: s.pathSlug }}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{s.name}</span>
                  )}
                  {newThisRun(s.missingSince) && <Badge>New this scan</Badge>}
                </div>
                <a
                  href={s.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm text-muted-foreground hover:underline"
                >
                  {s.repo}
                </a>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {s.missingReason && (
                  <Badge variant="destructive">{missingReasonLabel[s.missingReason]}</Badge>
                )}
                <span>
                  Since {formatDate(s.missingSince)} · {s.missingScans}{' '}
                  {s.missingScans === 1 ? 'scan' : 'scans'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RestoredSection({ restored }: { restored: Report['restored'] }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title="Back again" count={restored.length} />
      <ul className="divide-y rounded-lg border">
        {restored.map((f) => (
          <li key={f._id} className="flex flex-col gap-1 p-3">
            <a
              href={f.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium hover:underline"
            >
              {f.name ?? f.path}
            </a>
            <span className="text-sm text-muted-foreground">{f.repo}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ErrorsSection({ errors }: { errors: Run['errors'] }) {
  return (
    <section className="flex flex-col gap-4">
      <details className="group">
        <summary className="cursor-pointer list-none">
          <SectionHeading title="Problems" count={errors.length} />
        </summary>
        <ul className="mt-4 divide-y rounded-lg border text-sm">
          {errors.map((e, i) => (
            <li key={i} className="flex flex-col gap-0.5 p-3">
              <span className="font-medium">{e.target}</span>
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
      <SectionHeading title="Scan history" count={runs.length} />
      <ul className="divide-y rounded-lg border text-sm">
        {runs.map((r) => (
          <li key={r._id}>
            <Link
              to="/admin/skills-update-report"
              search={{ run: r._id }}
              className={cn(
                'flex flex-wrap items-center gap-x-4 gap-y-1 p-3 hover:bg-muted',
                r._id === selectedId && 'bg-muted',
              )}
            >
              <span className="font-medium">{formatDate(r.startedAt)}</span>
              <span className="text-muted-foreground">
                {r.status === 'running' ? 'Running' : r.trigger === 'cron' ? 'Scheduled' : 'Manual'}
              </span>
              <span className="ml-auto text-muted-foreground tabular-nums">
                +{r.added} new · {r.newlyMissing} missing · {r.restored} restored
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
