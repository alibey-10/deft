import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'

import { PageIntro } from '#/components/site-header.tsx'
import { SkillSearch } from '#/components/skill-search.tsx'
import { AuthorAvatar } from '#/components/author-avatar.tsx'
import { useDirectory } from '#/lib/directory.ts'

export const Route = createFileRoute('/authors/')({
  head: () => ({ meta: [{ title: 'Authors - Deft' }] }),
  component: AuthorsPage,
})

function AuthorsPage() {
  const { authors } = useDirectory()
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const results = needle
    ? authors.filter(
        (a) => a.key.includes(needle) || a.repos.some((r) => r.toLowerCase().includes(needle)),
      )
    : authors

  return (
    <>
      <PageIntro
        title="Authors"
        description={`${authors.length} people and teams publishing UI skills for coding agents.`}
      >
        <SkillSearch value={query} onChange={setQuery} placeholder="Search authors or repos…" />
      </PageIntro>
      {results.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No authors match your search.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((author) => (
            <li key={author.key}>
              <Link
                to="/authors/$author"
                params={{ author: author.key }}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
              >
                <AuthorAvatar author={author} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{author.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {author.repos.join(', ')}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {author.skills.length}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
