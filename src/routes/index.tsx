import { convexQuery } from '@convex-dev/react-query'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { api } from '../../convex/_generated/api'
import { ListPagination } from '#/components/list-pagination.tsx'
import { PageIntro } from '#/components/site-header.tsx'
import { SkillGrid } from '#/components/skill-card.tsx'
import { SkillSearch, validateSkillSearch } from '#/components/skill-search.tsx'
import { useDirectory } from '#/lib/directory.ts'

const PAGE_SIZE = 20

const skillPageQuery = ({ q, page = 1 }: { q?: string; page?: number }) =>
  convexQuery(api.directory.listPage, { page, pageSize: PAGE_SIZE, q: q || undefined })

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { q?: string; page?: number } => {
    const page = Number(search.page)
    return {
      ...validateSkillSearch(search),
      ...(Number.isInteger(page) && page > 1 ? { page } : {}),
    }
  },
  // Only the page blocks navigation. Typing a search fetches in the component, keeping the
  // previous results on screen, so the input never waits on the network.
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ context, location }) => {
    const search = location.search as { q?: string; page?: number }
    await context.queryClient.ensureQueryData(skillPageQuery(search))
  },
  component: Home,
})

function Home() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { allSkills, authors } = useDirectory()
  const { data, isPlaceholderData } = useQuery({
    ...skillPageQuery(search),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <PageIntro
        title="A directory of UI skills for coding agents"
        description={`${allSkills.length} skills from ${authors.length} authors, organized by topic and author. Install them into Claude Code, Cursor, Codex, and other agents.`}
      />

      <section aria-label="All skills" className="flex flex-col gap-4">
        <div className="flex justify-end">
          <SkillSearch
            value={search.q ?? ''}
            onChange={(value) =>
              // Changing the query starts again from page 1.
              navigate({ search: value ? { q: value } : {}, replace: true, resetScroll: false })
            }
          />
        </div>
        <div
          aria-busy={isPlaceholderData}
          className="transition-opacity aria-busy:opacity-60 flex flex-col gap-4"
        >
          <SkillGrid skills={data?.skills ?? []} />
          {data && <ListPagination page={data.page} pageCount={data.pageCount} />}
        </div>
      </section>
    </>
  )
}
