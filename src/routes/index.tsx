import { useEffect, useRef } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { usePaginatedQuery } from 'convex/react'

import { api } from '../../convex/_generated/api'
import { PageIntro } from '#/components/site-header.tsx'
import { SkillGrid } from '#/components/skill-card.tsx'
import { SkillSearch, validateSkillSearch } from '#/components/skill-search.tsx'
import { useDirectory, type RegistrySkill } from '#/lib/directory.ts'

const PAGE_SIZE = 20

/** The first page, fetched in the loader so the server can render it. */
const firstPageQuery = (q: string) =>
  convexQuery(api.directory.list, {
    paginationOpts: { numItems: PAGE_SIZE, cursor: null },
    q: q || undefined,
  })

export const Route = createFileRoute('/')({
  validateSearch: validateSkillSearch,
  // Only the initial load waits for the first page. Typing a search fetches in the component,
  // keeping the previous results on screen, so the input never waits on the network.
  loader: async ({ context, location }) => {
    const { q = '' } = location.search as { q?: string }
    await context.queryClient.ensureQueryData(firstPageQuery(q))
  },
  component: Home,
})

function Home() {
  const { q = '' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { allSkills, authors } = useDirectory()
  const { results, status, loadMore } = usePaginatedQuery(
    api.directory.list,
    { q: q || undefined },
    { initialNumItems: PAGE_SIZE },
  )
  const loading = status === 'LoadingFirstPage'
  // `usePaginatedQuery` only runs in the browser: show the loader's first page until it loads.
  // Disabled afterwards so it doesn't hold a second subscription to the same page.
  const firstPage = useQuery({ ...firstPageQuery(q), enabled: loading }).data?.page
  const shown = useStickyValue(loading ? firstPage : results, loading && !firstPage)

  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = sentinel.current
    if (!node || status !== 'CanLoadMore') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) loadMore(PAGE_SIZE)
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [status, loadMore])

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
              navigate({ search: value ? { q: value } : {}, replace: true, resetScroll: false })
            }
          />
        </div>
        <div aria-busy={loading || status === 'LoadingMore'} className="flex flex-col gap-4">
          <SkillGrid skills={shown ?? []} />
          <div ref={sentinel} aria-hidden />
          {status === 'LoadingMore' && (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading more skills…</p>
          )}
        </div>
      </section>
    </>
  )
}

/** Keeps showing the last value while `stale` is true, e.g. old results while a search loads. */
function useStickyValue(value: RegistrySkill[] | undefined, stale: boolean) {
  const last = useRef(value)
  if (!stale) last.current = value
  return last.current
}
