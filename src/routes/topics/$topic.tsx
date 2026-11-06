import { createFileRoute, notFound } from '@tanstack/react-router'

import { PageIntro } from '#/components/site-header.tsx'
import { SkillGrid } from '#/components/skill-card.tsx'
import { SkillSearch, validateSkillSearch } from '#/components/skill-search.tsx'
import { filterSkills, getTopic, useDirectory } from '#/lib/directory.ts'

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
  const { skillsByTopic } = useDirectory()
  const skills = skillsByTopic.get(topic.slug) ?? []
  const results = filterSkills(skills, q)

  return (
    <>
      <PageIntro title={topic.label} description={topic.description} />

      <section className="flex flex-col gap-4">
        <div className="flex justify-end">
          <SkillSearch
            value={q}
            placeholder={`Search ${topic.label} skills…`}
            onChange={(value) =>
              navigate({ search: value ? { q: value } : {}, replace: true, resetScroll: false })
            }
          />
        </div>
        <SkillGrid skills={results} maxColumns={2} />
      </section>
    </>
  )
}
