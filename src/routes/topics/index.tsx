import { createFileRoute, Link } from '@tanstack/react-router'

import { PageIntro } from '#/components/site-header.tsx'
import { useDirectory } from '#/lib/directory.ts'

export const Route = createFileRoute('/topics/')({
  head: () => ({ meta: [{ title: 'Topics · Skilly' }] }),
  component: TopicsPage,
})

function TopicsPage() {
  const { topicsWithSkills } = useDirectory()
  const groups = [
    { title: 'Design engineering', items: topicsWithSkills.filter((t) => t.isDesignCore) },
    { title: 'Frameworks & libraries', items: topicsWithSkills.filter((t) => !t.isDesignCore) },
  ]

  return (
    <>
      <PageIntro
        title="Topics"
        description="Find UI skills grouped by what they help an agent do, from accessibility and motion to framework-specific guidance."
      />
      <div className="flex flex-col gap-14">
        {groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-4">
            <h2 className="text-[1.3125rem] font-semibold tracking-[-0.015em] [font-stretch:92%]">
              {group.title}
            </h2>
            <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((topic) => (
                <li key={topic.slug}>
                  <Link
                    to="/topics/$topic"
                    params={{ topic: topic.slug }}
                    className="group/entry relative flex h-full flex-col gap-1.5 border-t pt-4 pb-6 text-sm outline-none before:absolute before:inset-x-0 before:-top-px before:h-px before:origin-left before:scale-x-0 before:bg-redline before:transition-transform before:duration-300 before:ease-out hover:before:scale-x-100 focus-visible:before:scale-x-100 motion-reduce:before:transition-none"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-base font-semibold tracking-[-0.01em] group-hover/entry:underline group-hover/entry:decoration-redline/60 group-hover/entry:underline-offset-4 group-focus-visible/entry:underline group-focus-visible/entry:decoration-redline">
                        {topic.label}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {topic.count} skills
                      </span>
                    </span>
                    <span className="leading-relaxed text-muted-foreground">
                      {topic.description}
                    </span>
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
