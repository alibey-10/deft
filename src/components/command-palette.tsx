import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
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
  CommandShortcut,
  CommandList,
} from '#/components/ui/command.tsx'
import { allSkills, authors, topicLabel, topicsWithSkills } from '#/lib/directory.ts'

/** ⌘K / Ctrl+K palette for jumping to any skill, topic or author. */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

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

  const go = (to: () => void) => {
    setOpen(false)
    to()
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Search skills, topics and authors"
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
        onOpenChange={setOpen}
        title="Search"
        description="Search skills, topics and authors"
      >
        <Command>
          <CommandInput placeholder="Search skills, topics and authors…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Topics">
              {topicsWithSkills.map((topic) => (
                <CommandItem
                  key={topic.slug}
                  value={`topic ${topic.label} ${topic.slug}`}
                  onSelect={() =>
                    go(() => navigate({ to: '/topics/$topic', params: { topic: topic.slug } }))
                  }
                >
                  <HugeiconsIcon icon={Tag01Icon} aria-hidden />
                  {topic.label}
                  <CommandShortcut variant="meta">{topic.count}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading="Authors">
              {authors.map((author) => (
                <CommandItem
                  key={author.key}
                  value={`author ${author.name}`}
                  keywords={author.repos}
                  onSelect={() =>
                    go(() => navigate({ to: '/authors/$author', params: { author: author.key } }))
                  }
                >
                  <AuthorAvatar author={author} size="sm" />
                  {author.name}
                  <CommandShortcut variant="meta">{author.skills.length}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading="Skills">
              {allSkills.map((skill) => (
                <CommandItem
                  key={skill.pathSlug}
                  value={`skill ${skill.name} ${skill.pathSlug}`}
                  keywords={[skill.user, skill.repo, ...(skill.topics ?? []).map(topicLabel)]}
                  onSelect={() =>
                    go(() => navigate({ to: '/skills/$', params: { _splat: skill.pathSlug } }))
                  }
                >
                  <HugeiconsIcon icon={SparklesIcon} aria-hidden />
                  <span className="truncate">{skill.name}</span>
                  <CommandShortcut variant="meta">{skill.user}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
