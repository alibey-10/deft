import { useEffect, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'

import { AuthorAvatar } from '#/components/author-avatar.tsx'
import { SkillSearch } from '#/components/skill-search.tsx'
import { ScrollArea } from '#/components/ui/scroll-area.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs.tsx'
import { allSkills, authors, topicsWithSkills } from '#/lib/directory.ts'

type SidebarTab = 'topics' | 'authors'

const itemClass =
  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground data-[status=active]:bg-muted data-[status=active]:font-medium data-[status=active]:text-foreground'

const topicGroups = [
  { title: 'Design engineering', items: topicsWithSkills.filter((t) => t.isDesignCore) },
  { title: 'Frontend & frameworks', items: topicsWithSkills.filter((t) => !t.isDesignCore) },
]

function Count({ value }: { value: number }) {
  return (
    <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{value}</span>
  )
}

export function DirectorySidebar() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const routeTab: SidebarTab = pathname.startsWith('/authors') ? 'authors' : 'topics'
  const [tab, setTab] = useState<SidebarTab>(routeTab)
  const [query, setQuery] = useState('')

  // Follow the route when navigating between topic and author pages.
  useEffect(() => {
    if (pathname.startsWith('/topics') || pathname.startsWith('/authors')) setTab(routeTab)
  }, [pathname, routeTab])

  const needle = query.trim().toLowerCase()
  const matches = (...values: string[]) =>
    !needle || values.some((value) => value.toLowerCase().includes(needle))

  const filteredGroups = topicGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((t) => matches(t.label, t.slug)),
    }))
    .filter((group) => group.items.length > 0)
  const filteredAuthors = authors.filter((a) => matches(a.name, ...a.repos))

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Link to="/" activeOptions={{ exact: true, includeSearch: false }} className={itemClass}>
        All skills
        <Count value={allSkills.length} />
      </Link>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as SidebarTab)}
        className="min-h-0 flex-1"
      >
        <TabsList className="w-full">
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="authors">Authors</TabsTrigger>
        </TabsList>

        <SkillSearch
          value={query}
          onChange={setQuery}
          placeholder={tab === 'topics' ? 'Filter topics…' : 'Filter authors…'}
        />

        <TabsContent value="topics" className="min-h-0">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-4 pr-3 pb-4">
              {filteredGroups.map((group) => (
                <div key={group.title} className="flex flex-col gap-0.5">
                  <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                    {group.title}
                  </h3>
                  {group.items.map((topic) => (
                    <Link
                      key={topic.slug}
                      to="/topics/$topic"
                      params={{ topic: topic.slug }}
                      className={itemClass}
                    >
                      <span className="truncate">{topic.label}</span>
                      <Count value={topic.count} />
                    </Link>
                  ))}
                </div>
              ))}
              {filteredGroups.length === 0 && <EmptyFilter />}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="authors" className="min-h-0">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-0.5 pr-3 pb-4">
              {filteredAuthors.map((author) => (
                <Link
                  key={author.key}
                  to="/authors/$author"
                  params={{ author: author.key }}
                  className={itemClass}
                >
                  <AuthorAvatar author={author} size="sm" />
                  <span className="truncate">{author.name}</span>
                  <Count value={author.skills.length} />
                </Link>
              ))}
              {filteredAuthors.length === 0 && <EmptyFilter />}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EmptyFilter() {
  return <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matches.</p>
}
