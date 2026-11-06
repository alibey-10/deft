import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { GithubIcon } from '@hugeicons/core-free-icons'

import { AuthorAvatar } from '#/components/author-avatar.tsx'
import { PageIntro } from '#/components/site-header.tsx'
import { SkillGrid } from '#/components/skill-card.tsx'
import { SkillSearch, validateSkillSearch } from '#/components/skill-search.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { filterSkills, getAuthor, topicLabel, type TopicSlug } from '#/lib/directory.ts'

export const Route = createFileRoute('/authors/$author')({
  validateSearch: validateSkillSearch,
  loader: ({ params }) => {
    const author = getAuthor(params.author)
    if (!author) throw notFound()
    return { authorKey: author.key }
  },
  head: ({ loaderData }) => {
    const author = loaderData && getAuthor(loaderData.authorKey)
    return { meta: author ? [{ title: `UI skills by ${author.name} · Skilly` }] : [] }
  },
  component: AuthorPage,
})

function AuthorPage() {
  const { authorKey } = Route.useLoaderData()
  const author = getAuthor(authorKey)!
  const { q = '' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const results = filterSkills(author.skills, q)

  const topicCounts = new Map<TopicSlug, number>()
  for (const skill of author.skills) {
    for (const t of skill.topics ?? []) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1)
  }
  const topTopics = [...topicCounts].sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <>
      <PageIntro
        eyebrow={
          <Link to="/authors" className="hover:text-foreground">
            Authors
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <AuthorAvatar author={author} size="lg" />
            {author.name}
          </span>
        }
        description={`${author.skills.length} ${author.skills.length === 1 ? 'skill' : 'skills'} across ${author.repos.join(', ')}.`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            render={<a href={author.profileUrl} target="_blank" rel="noreferrer" />}
          >
            <HugeiconsIcon icon={GithubIcon} data-icon="inline-start" aria-hidden />
            GitHub
          </Badge>
          {topTopics.map(([slug, count]) => (
            <Badge
              key={slug}
              variant="secondary"
              render={<Link to="/topics/$topic" params={{ topic: slug }} />}
            >
              {topicLabel(slug)}
              <span className="text-muted-foreground tabular-nums">{count}</span>
            </Badge>
          ))}
        </div>
      </PageIntro>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">
            Skills <span className="text-muted-foreground tabular-nums">{results.length}</span>
          </h2>
          {author.skills.length > 6 && (
            <SkillSearch
              value={q}
              placeholder={`Search ${author.name}'s skills…`}
              onChange={(value) =>
                navigate({ search: value ? { q: value } : {}, replace: true, resetScroll: false })
              }
            />
          )}
        </div>
        <SkillGrid skills={results} hideAuthor />
      </section>
    </>
  )
}
