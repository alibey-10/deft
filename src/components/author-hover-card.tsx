import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  BookOpen01Icon,
  Link01Icon,
  Location01Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'

import { AuthorAvatar } from '#/components/author-avatar.tsx'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '#/components/ui/hover-card.tsx'
import type { Author } from '#/lib/directory.ts'

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/**
 * A link to an author's page that previews them on hover or focus: who they are (name, bio) and
 * their reach (followers, skills), from the GitHub profile snapshot.
 */
export function AuthorHoverLink({
  author,
  className,
  children,
}: {
  author: Author
  className?: string
  children: React.ReactNode
}) {
  const profile = author.profile
  const displayName = profile?.name || author.name
  const login = profile?.login ?? author.name
  const skillCount = author.skills.length

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={300}
        closeDelay={150}
        render={
          <Link to="/authors/$author" params={{ author: author.key }} className={className} />
        }
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-80">
        <div className="flex flex-col gap-3 p-1.5">
          <Link
            to="/authors/$author"
            params={{ author: author.key }}
            className="flex min-w-0 items-center gap-3"
          >
            <AuthorAvatar author={author} size="lg" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium hover:underline hover:underline-offset-4">
                {displayName}
              </span>
              <span className="truncate text-muted-foreground">@{login}</span>
            </span>
          </Link>

          {profile?.bio && <p className="line-clamp-3 text-muted-foreground">{profile.bio}</p>}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            {profile && (
              <Meta icon={UserGroupIcon}>
                <span className="font-medium text-foreground tabular-nums">
                  {compact.format(profile.followers)}
                </span>
                {profile.followers === 1 ? 'follower' : 'followers'}
              </Meta>
            )}
            <Meta icon={BookOpen01Icon}>
              <span className="font-medium text-foreground tabular-nums">{skillCount}</span>
              {skillCount === 1 ? 'skill' : 'skills'}
            </Meta>
            {profile?.location && (
              <Meta icon={Location01Icon}>
                <span className="max-w-40 truncate">{profile.location}</span>
              </Meta>
            )}
            {profile?.website && (
              <Meta icon={Link01Icon}>
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="max-w-48 truncate hover:text-foreground"
                >
                  {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              </Meta>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

function Meta({
  icon,
  children,
}: {
  icon: React.ComponentProps<typeof HugeiconsIcon>['icon']
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <HugeiconsIcon icon={icon} className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  )
}
