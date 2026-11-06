import { createFileRoute } from '@tanstack/react-router'

import { ListPagination } from '#/components/list-pagination.tsx'
import { PageIntro } from '#/components/site-header.tsx'
import { SkillGrid } from '#/components/skill-card.tsx'
import { SkillSearch, validateSkillSearch } from '#/components/skill-search.tsx'
import { filterSkills, useDirectory } from '#/lib/directory.ts'

const PAGE_SIZE = 20

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { q?: string; page?: number } => {
    const page = Number(search.page)
    return {
      ...validateSkillSearch(search),
      ...(Number.isInteger(page) && page > 1 ? { page } : {}),
    }
  },
  component: Home,
})

function Home() {
  const { q = '', page: requestedPage = 1 } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { allSkills, authors } = useDirectory()
  const results = filterSkills(allSkills, q)
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const pageSkills = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <PageIntro
        title="A directory of UI skills for coding agents"
        description={`${allSkills.length} skills from ${authors.length} authors, organized by topic and author. Install them into Claude Code, Cursor, Codex, and other agents.`}
      />

      <section aria-label="All skills" className="flex flex-col gap-4">
        <div className="flex justify-end">
          <SkillSearch
            value={q}
            onChange={(value) =>
              // Changing the query starts again from page 1.
              navigate({ search: value ? { q: value } : {}, replace: true, resetScroll: false })
            }
          />
        </div>
        <SkillGrid skills={pageSkills} />
        <ListPagination page={page} pageCount={pageCount} />
      </section>
    </>
  )
}
