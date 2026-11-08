import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { defaultFilter } from 'cmdk'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon, SparklesIcon, Tag01Icon } from '@hugeicons/core-free-icons'

import { AuthorAvatar } from '#/components/author-avatar.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '#/components/ui/command.tsx'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs.tsx'
import { topicLabel, useDirectory } from '#/lib/directory.ts'

const TABS = [
  { value: 'skills', label: 'Skills' },
  { value: 'authors', label: 'Authors' },
  { value: 'topics', label: 'Topics' },
] as const

type Tab = (typeof TABS)[number]['value']

/** How many of the newest skills the Skills tab lists before anything is typed. */
const RECENT_SKILLS = 20

/** Keeps the entries that match `search`, best match first (all of them, unsorted, when empty). */
function rank<T>(entries: T[], search: string, text: (entry: T) => [string, string[]?]): T[] {
  const query = search.trim()
  if (!query) return entries
  return entries
    .map((entry) => {
      const [value, keywords] = text(entry)
      return { entry, score: defaultFilter(value, query, keywords) }
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((match) => match.entry)
}

/** ⌘K / Ctrl+K palette for jumping to a skill, author or topic, one tab per kind. */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('skills')
  const navigate = useNavigate()
  const { allSkills, authors, topicsWithSkills } = useDirectory()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setSearch('')
  }

  const go = (to: () => void) => {
    onOpenChange(false)
    to()
  }

  const skillResults = rank(allSkills, search, (skill) => [
    skill.name,
    [skill.user, skill.repo, ...skill.topics.map(topicLabel)],
  ])
  const searching = search.trim() !== ''
  // Newest additions to the directory (approval time, see `convex/directory.ts`).
  const recentSkills = [...allSkills].sort((a, b) => b.addedAt - a.addedAt).slice(0, RECENT_SKILLS)
  const authorResults = rank(authors, search, (author) => [author.name, author.repos])
  const topicResults = rank(topicsWithSkills, search, (topic) => [topic.label, [topic.slug]])
  const counts: Record<Tab, number> = {
    skills: skillResults.length,
    authors: authorResults.length,
    topics: topicResults.length,
  }

  const skillRows = (searching ? skillResults : recentSkills).map((skill) => (
    <CommandItem
      key={skill.pathSlug}
      value={`skill ${skill.pathSlug}`}
      onSelect={() => go(() => navigate({ to: '/skills/$', params: { _splat: skill.pathSlug } }))}
    >
      <HugeiconsIcon icon={SparklesIcon} aria-hidden />
      <span className="truncate">{skill.name}</span>
      <CommandShortcut variant="meta">{skill.user}</CommandShortcut>
    </CommandItem>
  ))

  // Tab / Shift+Tab cycles the tabs without leaving the search field.
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    const index = TABS.findIndex((t) => t.value === tab)
    const step = event.shiftKey ? -1 : 1
    setTab(TABS[(index + step + TABS.length) % TABS.length].value)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Search skills, authors and topics"
        className="justify-start sm:w-56"
      >
        <HugeiconsIcon icon={Search01Icon} data-icon="inline-start" aria-hidden />
        <span className="hidden text-muted-foreground sm:inline">Search…</span>
        <kbd className="ml-auto hidden rounded border px-1 font-sans text-xs text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Search"
        description="Search skills, authors and topics"
        className="sm:max-w-2xl"
      >
        {/* Filtering happens above so each tab can show its match count. */}
        <Command shouldFilter={false} onKeyDown={onKeyDown}>
          <CommandInput
            placeholder="Search skills, authors and topics…"
            value={search}
            onValueChange={setSearch}
          />

          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as Tab)}
            className="mx-1 mt-3 mb-3"
          >
            <TabsList className="w-full">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {counts[t.value]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Keyed by tab so the highlight resets to the first result on switch. */}
          <CommandList key={tab} className="mx-1">
            <CommandEmpty>
              No {tab} match “{search.trim()}”.
            </CommandEmpty>

            {tab === 'skills' &&
              (searching ? (
                skillRows
              ) : (
                <CommandGroup heading="Recently added">{skillRows}</CommandGroup>
              ))}

            {tab === 'authors' &&
              authorResults.map((author) => (
                <CommandItem
                  key={author.key}
                  value={`author ${author.key}`}
                  onSelect={() =>
                    go(() => navigate({ to: '/authors/$author', params: { author: author.key } }))
                  }
                >
                  <AuthorAvatar author={author} size="sm" />
                  <span className="truncate">{author.name}</span>
                  <CommandShortcut variant="meta">
                    {author.skills.length} {author.skills.length === 1 ? 'skill' : 'skills'}
                  </CommandShortcut>
                </CommandItem>
              ))}

            {tab === 'topics' &&
              topicResults.map((topic) => (
                <CommandItem
                  key={topic.slug}
                  value={`topic ${topic.slug}`}
                  onSelect={() =>
                    go(() => navigate({ to: '/topics/$topic', params: { topic: topic.slug } }))
                  }
                >
                  <HugeiconsIcon icon={Tag01Icon} aria-hidden />
                  <span className="truncate">{topic.label}</span>
                  <CommandShortcut variant="meta">
                    {topic.count} {topic.count === 1 ? 'skill' : 'skills'}
                  </CommandShortcut>
                </CommandItem>
              ))}
          </CommandList>

          <div className="mx-1 mt-2 flex items-center gap-4 border-t px-3 pt-3 pb-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              Switch tab
              <kbd className="rounded border px-1 font-sans">Tab</kbd>
            </span>
            <span className="flex items-center gap-1.5">
              Close
              <kbd className="rounded border px-1 font-sans">Esc</kbd>
            </span>
          </div>
        </Command>
      </CommandDialog>
    </>
  )
}
