import { useEffect, useState } from 'react'
import { cn } from 'cn'

import type { TocEntry } from '#/lib/skill-content.ts'

/** Tracks the heading closest to the top of the viewport. */
function useActiveHeading(ids: string[]) {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        const first = elements.find((el) => visible.has(el.id))
        if (first) setActive(first.id)
      },
      // Treat the band just under the sticky header as the "current" zone.
      { rootMargin: '-64px 0px -70% 0px' },
    )
    for (const el of elements) observer.observe(el)
    return () => observer.disconnect()
  }, [ids])

  return active
}

export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const ids = entries.map((entry) => entry.id)
  const active = useActiveHeading(ids)
  const minDepth = Math.min(...entries.map((entry) => entry.depth))

  return (
    <nav aria-label="Table of contents" className="flex flex-col gap-2">
      <h2 className="text-[0.8125rem] font-semibold">On this skill</h2>
      <ol className="flex flex-col border-l">
        {entries.map((entry, index) => (
          <li key={`${entry.id}-${index}`}>
            <a
              href={`#${entry.id}`}
              aria-current={active === entry.id ? 'location' : undefined}
              style={{ paddingLeft: `${(entry.depth - minDepth) * 0.75 + 0.75}rem` }}
              className={cn(
                '-ml-px block border-l border-transparent py-1 pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
                'aria-[current=location]:border-redline aria-[current=location]:font-medium aria-[current=location]:text-foreground',
              )}
            >
              <span className="line-clamp-2">{entry.text}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
