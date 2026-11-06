import { useEffect, useRef } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { usePaginatedQuery } from 'convex/react'

import { api } from '../../convex/_generated/api'
import { SkillGrid } from '#/components/skill-card.tsx'
import { SkillSearch, validateSkillSearch } from '#/components/skill-search.tsx'
import { useDirectory, type RegistrySkill } from '#/lib/directory.ts'

const PAGE_SIZE = 20
const count = new Intl.NumberFormat('en')

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
      <Hero />

      <section aria-label="All skills" className="flex flex-col gap-6">
        <SkillSearch
          value={q}
          className="max-w-sm"
          onChange={(value) =>
            navigate({ search: value ? { q: value } : {}, replace: true, resetScroll: false })
          }
        />
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

/**
 * The headline carries a spec redline, the way a designer marks up a handoff file. Its label is
 * the measurement that matters here: how much taste the directory holds.
 */
function Hero() {
  const { allSkills, authors } = useDirectory()
  return (
    <header className="flex flex-col gap-6 pt-2 pb-12">
      <div className="w-fit max-w-full">
        <div className="redline-dimension mb-3 text-xs font-medium tabular-nums">
          <span>
            {count.format(allSkills.length)} skills from {count.format(authors.length)} authors
          </span>
        </div>
        <h1 className="text-[clamp(2.75rem,6.5vw,4.5rem)] leading-[1] font-semibold tracking-[-0.022em] text-balance [font-stretch:88%]">
          Give your agent better taste
        </h1>
      </div>
      <p className="max-w-[58ch] text-[1.0625rem] leading-relaxed text-pretty text-muted-foreground">
        Skills that teach coding agents to ship polished interfaces, from typography and motion to
        accessibility and design systems. Works with Claude Code, Cursor, Codex, and more.
      </p>
    </header>
  )
}

/** Keeps showing the last value while `stale` is true, e.g. old results while a search loads. */
function useStickyValue(value: RegistrySkill[] | undefined, stale: boolean) {
  const last = useRef(value)
  if (!stale) last.current = value
  return last.current
}
