import { createFileRoute, Link, notFound, type ErrorComponentProps } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { GithubIcon } from '@hugeicons/core-free-icons'
import { cn } from 'cn'

import { InstallCommand } from '#/components/install-command.tsx'
import { PageIntro } from '#/components/site-header.tsx'
import { SkillMarkdown } from '#/components/skill-markdown.tsx'
import { TableOfContents } from '#/components/table-of-contents.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { buttonVariants } from '#/components/ui/button.tsx'
import { loadDirectory, topicLabel, useDirectory, type RegistrySkill } from '#/lib/directory.ts'
import { fetchSkillMarkdown } from '#/lib/fetch-skill.ts'
import { buildInstallCommand } from '#/lib/install-command.ts'
import { parseSkill } from '#/lib/skill-content.ts'

const HIDDEN_FRONTMATTER = new Set(['name', 'description'])

export const Route = createFileRoute('/skills/$')({
  validateSearch: (search: Record<string, unknown>): { file?: string } =>
    typeof search.file === 'string' && search.file ? { file: search.file } : {},
  loaderDeps: ({ search }) => ({ file: search.file }),
  loader: async ({ params, deps, context }) => {
    const skill = (await loadDirectory(context.queryClient)).getSkill(params._splat ?? '')
    if (!skill) throw notFound()
    if (deps.file && !skill.files?.includes(deps.file)) throw notFound()
    const { url, text } = await fetchSkillMarkdown({
      data: { pathSlug: skill.pathSlug, file: deps.file },
    })
    return {
      pathSlug: skill.pathSlug,
      file: deps.file,
      url,
      meta: { name: skill.name, user: skill.user, description: skill.description },
      ...parseSkill(text),
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    const { name, user, description } = loaderData.meta
    return {
      meta: [{ title: `${name} by ${user} - Deft` }, { name: 'description', content: description }],
    }
  },
  component: SkillPage,
  errorComponent: SkillError,
})

function SkillPage() {
  const { pathSlug, file, url, frontmatter, body, toc } = Route.useLoaderData()
  const skill = useDirectory().getSkill(pathSlug)
  if (!skill) throw notFound()
  const extraMeta = Object.entries(frontmatter).filter(
    ([key, value]) => value && !HIDDEN_FRONTMATTER.has(key),
  )

  return (
    <div className="flex gap-10">
      <article className="min-w-0 flex-1">
        <SkillHeader skill={skill} />

        <section aria-labelledby="install-heading" className="mb-10 flex flex-col gap-2.5">
          <h2 id="install-heading" className="text-sm font-semibold">
            Install
          </h2>
          <InstallCommand command={buildInstallCommand(skill)} />
        </section>

        {extraMeta.length > 0 && (
          <dl className="mb-8 grid max-w-[72ch] gap-x-6 gap-y-1.5 text-sm leading-relaxed sm:grid-cols-[max-content_1fr]">
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

      <aside className="sticky top-14 hidden max-h-[calc(100svh-3.5rem)] w-56 shrink-0 self-start overflow-y-auto py-2 xl:flex xl:flex-col xl:gap-6">
        {toc.length > 1 && <TableOfContents entries={toc} />}
        <ViewSourceButton href={skill.githubUrl} className="self-start" />
      </aside>
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
        <ViewSourceButton href={skill.githubUrl} className="xl:hidden" />
        {skill.topics.map((topic) => (
          <Badge
            key={topic}
            variant="outline"
            render={<Link to="/topics/$topic" params={{ topic }} />}
          >
            {topicLabel(topic)}
          </Badge>
        ))}
      </div>
    </PageIntro>
  )
}

function ViewSourceButton({ href, className }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), className)}
    >
      <HugeiconsIcon icon={GithubIcon} data-icon="inline-start" aria-hidden />
      View source
    </a>
  )
}

function FileTabs({ skill, active }: { skill: RegistrySkill; active?: string }) {
  const files = ['SKILL.md', ...(skill.files ?? [])]
  return (
    <nav aria-label="Skill files" className="mb-8 flex flex-wrap gap-1 border-b pb-3">
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
            className="rounded-md px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
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
  const skill = useDirectory().getSkill(_splat ?? '')
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
