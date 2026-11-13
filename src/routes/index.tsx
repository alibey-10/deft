import { useEffect, useRef } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { usePaginatedQuery } from 'convex/react'

import { api } from '../../convex/_generated/api'
import { AuthorAvatar } from '#/components/author-avatar.tsx'
import { AuthorHoverLink } from '#/components/author-hover-card.tsx'
import { PageIntro } from '#/components/site-header.tsx'
import { SkillGrid } from '#/components/skill-card.tsx'
import { SkillSearch, validateSkillSearch } from '#/components/skill-search.tsx'
import { useDirectory, type Author, type RegistrySkill } from '#/lib/directory.ts'

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
      <Intro />

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

const FEATURED_AUTHORS = 8
/** Always shown in the intro's author row, after the most-starred authors. */
const PINNED_AUTHORS = ['emilkowalski']
/** Never shown in the intro's author row, whatever their stars. */
const UNFEATURED_AUTHORS = ['addyosmani']
const topStars = (author: Author) => Math.max(0, ...author.skills.map((skill) => skill.stars ?? 0))

/** Says what the directory is for and who wrote what's in it, then gets out of the way. */
function Intro() {
  const { authors, getAuthor } = useDirectory()
  const pinned = PINNED_AUTHORS.map(getAuthor).filter((author) => author !== undefined)
  // Mostly the authors whose repos have the most GitHub stars: names a visitor is likely to know.
  const featured = [
    ...authors
      .filter((a) => !PINNED_AUTHORS.includes(a.key) && !UNFEATURED_AUTHORS.includes(a.key))
      .sort((a, b) => topStars(b) - topStars(a))
      .slice(0, FEATURED_AUTHORS - pinned.length),
    ...pinned,
  ]

  return (
    <PageIntro
      title="Agent skills for tasteful UI"
      description="End AI slop with skills that teach your agent interface craft."
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
        <ul aria-label="Featured authors" className="flex items-center gap-1.5">
          {featured.map((author) => (
            <li key={author.key}>
              <AuthorHoverLink author={author} className="block rounded-full">
                <AuthorAvatar author={author} size="md" />
                <span className="sr-only">{author.name}</span>
              </AuthorHoverLink>
            </li>
          ))}
        </ul>
        <Link
          to="/authors"
          className="text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground"
        >
          All {count.format(authors.length)} authors
        </Link>
      </div>
    </PageIntro>
  )
}

/** Keeps showing the last value while `stale` is true, e.g. old results while a search loads. */
function useStickyValue(value: RegistrySkill[] | undefined, stale: boolean) {
  const last = useRef(value)
  if (!stale) last.current = value
  return last.current
}
