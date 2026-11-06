import { createFileRoute } from '@tanstack/react-router'

import { PageIntro } from '#/components/site-header.tsx'
import { SkillGrid } from '#/components/skill-card.tsx'
import { SkillSearch, validateSkillSearch } from '#/components/skill-search.tsx'
import { allSkills, authors, filterSkills } from '#/lib/directory.ts'

export const Route = createFileRoute('/')({
  validateSearch: validateSkillSearch,
  component: Home,
})

function Home() {
  const { q = '' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const results = filterSkills(allSkills, q)

  return (
    <>
      <PageIntro
        title="A directory of UI skills for coding agents"
        description={`${allSkills.length} skills from ${authors.length} authors, organized by topic and author. Install them into Claude Code, Cursor, Codex, and other agents.`}
      />

      <section aria-labelledby="skills-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="skills-heading" className="text-sm font-medium">
            All skills <span className="text-muted-foreground tabular-nums">{results.length}</span>
          </h2>
          <SkillSearch
            value={q}
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
