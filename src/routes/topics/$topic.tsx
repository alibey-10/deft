import { createFileRoute, notFound } from '@tanstack/react-router'

import { PageWithAside } from '#/components/page-with-aside.tsx'
import { PageIntro } from '#/components/site-header.tsx'
import { SkillGrid } from '#/components/skill-card.tsx'
import { SkillSortTabs, sortSkills, validateSortSearch } from '#/components/skill-sort.tsx'
import { getTopic, useDirectory } from '#/lib/directory.ts'

export const Route = createFileRoute('/topics/$topic')({
  validateSearch: validateSortSearch,
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
  const { skillsByTopic } = useDirectory()
  const { sort = 'recent' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const skills = sortSkills(skillsByTopic.get(topic.slug) ?? [], sort)

  return (
    <PageWithAside>
      <PageIntro title={topic.label} description={topic.description} />
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-end gap-2">
          <SkillSortTabs
            value={sort}
            onChange={(value) =>
              navigate({
                search: value === 'recent' ? {} : { sort: value },
                replace: true,
                resetScroll: false,
              })
            }
          />
        </div>
        <SkillGrid skills={skills} columns={1} />
      </section>
    </PageWithAside>
  )
}
