import { cn } from 'cn'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { StarIcon } from '@hugeicons/core-free-icons'

import { AuthorAvatar } from '#/components/author-avatar.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { topicLabel, useDirectory, type RegistrySkill } from '#/lib/directory.ts'

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const full = new Intl.NumberFormat('en')

/**
 * What the card shows besides name and description. `source` (author + GitHub stars) suits
 * topic listings; `topics` suits an author's page, where the author is already known.
 */
export type SkillCardMeta = 'source' | 'topics'

/**
 * One entry in the index: a top rule, not a box. The rule turns redline when the entry is hovered
 * or its link has focus. The title link stretches over the entry; inner links sit above it.
 */
export function SkillCard({
  skill,
  meta = 'source',
}: {
  skill: RegistrySkill
  meta?: SkillCardMeta
}) {
  const author = useDirectory().getAuthor(skill.sourceKey)

  return (
    <article className="group/entry relative flex h-full flex-col gap-2 border-t pt-4 pb-6 text-sm transition-colors duration-150 ease-out before:absolute before:inset-x-0 before:-top-px before:h-px before:origin-left before:scale-x-0 before:bg-redline before:transition-transform before:duration-300 before:ease-out hover:before:scale-x-100 has-[a:focus-visible]:before:scale-x-100 motion-reduce:before:transition-none">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 text-base leading-snug font-semibold tracking-[-0.01em]">
          <Link
            to="/skills/$"
            params={{ _splat: skill.pathSlug }}
            className="break-words outline-none after:absolute after:inset-0 group-hover/entry:underline group-hover/entry:decoration-redline/60 group-hover/entry:underline-offset-4 focus-visible:underline focus-visible:decoration-redline focus-visible:underline-offset-4"
          >
            {skill.name}
          </Link>
        </h3>
        {meta === 'source' && (
          <Link
            to="/authors/$author"
            params={{ author: skill.sourceKey }}
            className="relative z-10 flex min-w-0 shrink-0 items-center gap-1.5 self-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="max-w-32 truncate">{author?.name ?? skill.user}</span>
            {author && <AuthorAvatar author={author} size="sm" />}
          </Link>
        )}
      </div>
      <p className="line-clamp-2 max-w-[72ch] leading-relaxed text-muted-foreground">
        {skill.description}
      </p>
      {meta === 'topics' ? (
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
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
      ) : (
        skill.stars !== undefined && (
          <a
            href={`https://github.com/${skill.user}/${skill.repo}`}
            target="_blank"
            rel="noreferrer"
            title={`${full.format(skill.stars)} stars on ${skill.user}/${skill.repo}`}
            aria-label={`${full.format(skill.stars)} GitHub stars`}
            className="relative z-10 mt-auto flex w-fit items-center gap-1 pt-1 text-xs text-muted-foreground tabular-nums transition-colors hover:text-foreground"
          >
            <HugeiconsIcon icon={StarIcon} aria-hidden className="size-3.5" />
            {compact.format(skill.stars)}
          </a>
        )
      )}
    </article>
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
    <ul className={cn('grid gap-x-10', columns === 2 && 'sm:grid-cols-2')}>
      {skills.map((skill) => (
        <li key={skill.pathSlug}>
          <SkillCard skill={skill} meta={meta} />
        </li>
      ))}
    </ul>
  )
}
