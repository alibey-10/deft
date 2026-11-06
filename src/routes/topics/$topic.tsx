import { createFileRoute, Link, notFound } from '@tanstack/react-router'

import { PageIntro } from '#/components/site-header.tsx'
import { SkillGrid } from '#/components/skill-card.tsx'
import { SkillSearch, validateSkillSearch } from '#/components/skill-search.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { filterSkills, getTopic, skillsByTopic, topicLabel } from '#/lib/directory.ts'
import { relatedTopicSlugs } from '#/data/topics.ts'

export const Route = createFileRoute('/topics/$topic')({
  validateSearch: validateSkillSearch,
  loader: ({ params }) => {
    const topic = getTopic(params.topic)
    if (!topic) throw notFound()
    return { topic }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.topic.label} UI skills · Skilly` },
          { name: 'description', content: loaderData.topic.description },
        ]
      : [],
  }),
  component: TopicPage,
})

function TopicPage() {
  const { topic } = Route.useLoaderData()
  const { q = '' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const skills = skillsByTopic.get(topic.slug) ?? []
  const results = filterSkills(skills, q)
  const related = relatedTopicSlugs[topic.slug].filter((slug) => skillsByTopic.has(slug))

  return (
    <>
      <PageIntro
        eyebrow={
          <Link to="/topics" className="hover:text-foreground">
            Topics
          </Link>
        }
        title={topic.label}
        description={topic.description}
      >
        {related.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            Related:
            {related.map((slug) => (
              <Badge
                key={slug}
                variant="secondary"
                render={<Link to="/topics/$topic" params={{ topic: slug }} />}
              >
                {topicLabel(slug)}
              </Badge>
            ))}
          </div>
        )}
      </PageIntro>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">
            Skills <span className="text-muted-foreground tabular-nums">{results.length}</span>
          </h2>
          <SkillSearch
            value={q}
            placeholder={`Search ${topic.label} skills…`}
            onChange={(value) =>
              navigate({ search: value ? { q: value } : {}, replace: true, resetScroll: false })
            }
          />
        </div>
        <SkillGrid skills={results} />
      </section>
    </>
  )
}
