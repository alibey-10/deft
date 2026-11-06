import { cn } from 'cn'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon, StarIcon } from '@hugeicons/core-free-icons'

import { AuthorAvatar } from '#/components/author-avatar.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { topicLabel, useDirectory, type RegistrySkill } from '#/lib/directory.ts'

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const full = new Intl.NumberFormat('en')

/**
 * What the card shows besides name and description. `source` (author + GitHub stars) suits
 * topic listings; `topics` suits an author's page, where the author is already known.
 */
export type SkillCardMeta = 'source' | 'topics'

/** The title link stretches over the card; inner links sit above it via z-index. */
export function SkillCard({
  skill,
  meta = 'source',
}: {
  skill: RegistrySkill
  meta?: SkillCardMeta
}) {
  const author = useDirectory().getAuthor(skill.sourceKey)

  return (
    <Card size="sm" className="relative h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="min-w-0">
            <Link
              to="/skills/$"
              params={{ _splat: skill.pathSlug }}
              className="break-words after:absolute after:inset-0"
            >
              {skill.name}
            </Link>
          </CardTitle>
          {meta === 'source' && (
            <Link
              to="/authors/$author"
              params={{ author: skill.sourceKey }}
              className="relative z-10 flex min-w-0 shrink-0 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="max-w-32 truncate">{author?.name ?? skill.user}</span>
              {author && <AuthorAvatar author={author} size="sm" />}
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="flex h-full flex-col gap-3">
          <p className="line-clamp-3 text-muted-foreground">{skill.description}</p>
          <div className="mt-auto flex items-end justify-between gap-3">
            {meta === 'topics' ? (
              <div className="flex flex-wrap gap-1.5">
                {skill.topics.map((topic) => (
                  <Badge
                    key={topic}
                    variant="outline"
                    className="relative z-10"
                    render={<Link to="/topics/$topic" params={{ topic }} />}
                  >
                    {topicLabel(topic)}
                  </Badge>
                ))}
              </div>
            ) : skill.stars !== undefined ? (
              <a
                href={`https://github.com/${skill.user}/${skill.repo}`}
                target="_blank"
                rel="noreferrer"
                title={`${full.format(skill.stars)} stars on ${skill.user}/${skill.repo}`}
                aria-label={`${full.format(skill.stars)} GitHub stars`}
                className="relative z-10 flex shrink-0 items-center gap-1 text-muted-foreground tabular-nums transition-colors hover:text-foreground"
              >
                <HugeiconsIcon icon={StarIcon} aria-hidden className="size-3.5" />
                {compact.format(skill.stars)}
              </a>
            ) : (
              <span />
            )}
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-[translate,color] duration-200 ease-out group-hover/card:translate-x-0.5 group-hover/card:text-foreground motion-reduce:transition-none"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function SkillGrid({
  skills,
  columns = 2,
  meta,
}: {
  skills: RegistrySkill[]
  columns?: 1 | 2
  meta?: SkillCardMeta
}) {
  if (skills.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">No skills match your search.</p>
  }
  return (
    <ul className={cn('grid gap-4', columns === 2 && 'sm:grid-cols-2')}>
      {skills.map((skill) => (
        <li key={skill.pathSlug}>
          <SkillCard skill={skill} meta={meta} />
        </li>
      ))}
    </ul>
  )
}
