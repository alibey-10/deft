import { createFileRoute, Link, notFound, type ErrorComponentProps } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { GithubIcon } from '@hugeicons/core-free-icons'

import { InstallCommand } from '#/components/install-command.tsx'
import { PageIntro } from '#/components/site-header.tsx'
import { SkillMarkdown } from '#/components/skill-markdown.tsx'
import { TableOfContents } from '#/components/table-of-contents.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { buttonVariants } from '#/components/ui/button.tsx'
import { getSkill, topicLabel, type RegistrySkill } from '#/lib/directory.ts'
import { fetchSkillMarkdown } from '#/lib/fetch-skill.ts'
import { buildInstallCommand } from '#/lib/install-command.ts'
import { parseSkill } from '#/lib/skill-content.ts'

const HIDDEN_FRONTMATTER = new Set(['name', 'description'])

export const Route = createFileRoute('/skills/$')({
  validateSearch: (search: Record<string, unknown>): { file?: string } =>
    typeof search.file === 'string' && search.file ? { file: search.file } : {},
  loaderDeps: ({ search }) => ({ file: search.file }),
  loader: async ({ params, deps }) => {
    const skill = getSkill(params._splat ?? '')
    if (!skill) throw notFound()
    if (deps.file && !skill.files?.includes(deps.file)) throw notFound()
    const { url, text } = await fetchSkillMarkdown({
      data: { pathSlug: skill.pathSlug, file: deps.file },
    })
    return { pathSlug: skill.pathSlug, file: deps.file, url, ...parseSkill(text) }
  },
  head: ({ loaderData }) => {
    const skill = loaderData && getSkill(loaderData.pathSlug)
    if (!skill) return {}
    return {
      meta: [
        { title: `${skill.name} by ${skill.user} · Skilly` },
        { name: 'description', content: skill.description },
      ],
    }
  },
  component: SkillPage,
  errorComponent: SkillError,
})

function SkillPage() {
  const { pathSlug, file, url, frontmatter, body, toc } = Route.useLoaderData()
  const skill = getSkill(pathSlug)!
  const extraMeta = Object.entries(frontmatter).filter(
    ([key, value]) => value && !HIDDEN_FRONTMATTER.has(key),
  )

  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1">
        <SkillHeader skill={skill} />

        <section aria-labelledby="install-heading" className="mb-8 flex flex-col gap-2">
          <h2 id="install-heading" className="text-sm font-medium">
            Install
          </h2>
          <InstallCommand command={buildInstallCommand(skill)} />
        </section>

        {extraMeta.length > 0 && (
          <dl className="mb-6 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
            {extraMeta.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {skill.files && skill.files.length > 0 && <FileTabs skill={skill} active={file} />}

        <div className="min-w-0">
          <SkillMarkdown skill={skill} markdown={body} sourceUrl={url} />
        </div>
      </article>

      {toc.length > 1 && (
        <aside className="sticky top-14 hidden max-h-[calc(100svh-3.5rem)] w-56 shrink-0 self-start overflow-y-auto py-2 xl:block">
          <TableOfContents entries={toc} />
        </aside>
      )}
    </div>
  )
}

function SkillHeader({ skill }: { skill: RegistrySkill }) {
  return (
    <PageIntro
      eyebrow={
        <span>
          <Link
            to="/authors/$author"
            params={{ author: skill.sourceKey }}
            className="hover:text-foreground"
          >
            {skill.user}
          </Link>
          <span> / {skill.repo}</span>
        </span>
      }
      title={skill.name}
      description={skill.description}
    >
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={skill.githubUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <HugeiconsIcon icon={GithubIcon} data-icon="inline-start" aria-hidden />
          View source
        </a>
        {skill.topics?.map((topic) => (
          <Badge
            key={topic}
            variant="secondary"
            render={<Link to="/topics/$topic" params={{ topic }} />}
          >
            {topicLabel(topic)}
          </Badge>
        ))}
      </div>
    </PageIntro>
  )
}

function FileTabs({ skill, active }: { skill: RegistrySkill; active?: string }) {
  const files = ['SKILL.md', ...(skill.files ?? [])]
  return (
    <nav aria-label="Skill files" className="mb-6 flex flex-wrap gap-1 border-b pb-2">
      {files.map((name) => {
        const isMain = name === 'SKILL.md'
        const current = isMain ? !active : active === name
        return (
          <Link
            key={name}
            to="/skills/$"
            params={{ _splat: skill.pathSlug }}
            search={isMain ? {} : { file: name }}
            aria-current={current ? 'page' : undefined}
            className="rounded-md px-2.5 py-1 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
          >
            {name}
          </Link>
        )
      })}
    </nav>
  )
}

function SkillError({ error }: ErrorComponentProps) {
  const { _splat } = Route.useParams()
  const skill = getSkill(_splat ?? '')
  return (
    <div className="flex flex-col gap-6">
      {skill && <SkillHeader skill={skill} />}
      <div className="rounded-lg border p-6 text-sm">
        <p className="font-medium">Couldn't load this skill's content.</p>
        <p className="mt-1 text-muted-foreground">
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    </div>
  )
}
