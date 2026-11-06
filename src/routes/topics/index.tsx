import { createFileRoute, Link } from '@tanstack/react-router'

import { PageIntro } from '#/components/site-header.tsx'
import { Card, CardDescription, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { useDirectory } from '#/lib/directory.ts'

export const Route = createFileRoute('/topics/')({
  head: () => ({ meta: [{ title: 'Topics · Skilly' }] }),
  component: TopicsPage,
})

function TopicsPage() {
  const { topicsWithSkills } = useDirectory()
  const groups = [
    { title: 'Design engineering', items: topicsWithSkills.filter((t) => t.isDesignCore) },
    { title: 'Frontend & frameworks', items: topicsWithSkills.filter((t) => !t.isDesignCore) },
  ]

  return (
    <>
      <PageIntro
        title="Topics"
        description="Find UI skills grouped by what they help an agent do, from accessibility and motion to framework-specific guidance."
      />
      <div className="flex flex-col gap-10">
        {groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-4">
            <h2 className="text-sm font-medium">{group.title}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((topic) => (
                <li key={topic.slug}>
                  <Link
                    to="/topics/$topic"
                    params={{ topic: topic.slug }}
                    className="group block h-full"
                  >
                    <Card size="sm" className="h-full">
                      <CardHeader>
                        <CardTitle>
                          <div className="flex items-baseline justify-between gap-3 group-hover:underline">
                            {topic.label}
                            <span className="text-sm font-normal text-muted-foreground tabular-nums">
                              {topic.count} skills
                            </span>
                          </div>
                        </CardTitle>
                        <CardDescription>{topic.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
