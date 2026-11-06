import { createLink } from '@tanstack/react-router'

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '#/components/ui/pagination.tsx'

const PageLink = createLink(PaginationLink)
const PreviousLink = createLink(PaginationPrevious)
const NextLink = createLink(PaginationNext)

/** Page numbers to show: first, last, and a window around the current page. */
export function pageRange(page: number, pageCount: number): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = []
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) {
      pages.push(p)
    } else if (pages.at(-1) !== 'ellipsis') {
      pages.push('ellipsis')
    }
  }
  return pages
}

/** Pagination that writes the page to the `?page=` search param of the current route. */
export function ListPagination({ page, pageCount }: { page: number; pageCount: number }) {
  if (pageCount <= 1) return null

  const searchFor = (target: number) => (prev: Record<string, unknown>) => ({
    ...prev,
    page: target === 1 ? undefined : target,
  })

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PreviousLink
            to="."
            search={searchFor(page - 1)}
            disabled={page <= 1}
            className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
          />
        </PaginationItem>
        {pageRange(page, pageCount).map((p, index) =>
          p === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PageLink to="." search={searchFor(p)} isActive={p === page}>
                {p}
              </PageLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <NextLink
            to="."
            search={searchFor(page + 1)}
            disabled={page >= pageCount}
            className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
