import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { BookOpen01Icon, Location01Icon, UserGroupIcon } from '@hugeicons/core-free-icons'

import { AuthorAvatar } from '#/components/author-avatar.tsx'
import { GithubRepoBadges } from '#/components/github-repo-badges.tsx'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '#/components/ui/hover-card.tsx'
import { useDirectory } from '#/lib/directory.ts'

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/**
 * A link to a skill that previews it on hover or focus: what it does, who wrote it, and how the
 * repo is doing (stars, last commit). Falls back to a plain link for skills not in the directory.
 */
export function SkillLink({
  pathSlug,
  className,
  children,
}: {
  pathSlug: string
  className?: string
  children: React.ReactNode
}) {
  const { getSkill, getAuthor } = useDirectory()
  const skill = getSkill(pathSlug)
  const author = skill && getAuthor(skill.sourceKey)
  const link = <Link to="/skills/$" params={{ _splat: pathSlug }} className={className} />
  if (!skill || !author)
    return (
      <Link to="/skills/$" params={{ _splat: pathSlug }} className={className}>
        {children}
      </Link>
    )

  const profile = author.profile
  const displayName = profile?.name || author.name
  const isGithub = author.profileUrl.startsWith('https://github.com/')

  return (
    <HoverCard>
      <HoverCardTrigger delay={300} closeDelay={150} render={link}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-80">
        <div className="flex flex-col gap-3 p-1.5">
          <div className="flex flex-col gap-1">
            <p className="font-medium">{skill.name}</p>
            <p className="line-clamp-3 text-muted-foreground">{skill.description}</p>
          </div>

          {isGithub && (
            <div className="flex flex-wrap items-center gap-1.5">
              <GithubRepoBadges user={skill.user} repo={skill.repo} />
            </div>
          )}

          <div className="flex flex-col gap-2 border-t pt-3">
            <Link
              to="/authors/$author"
              params={{ author: author.key }}
              className="flex min-w-0 items-center gap-2 rounded-md hover:text-foreground"
            >
              <AuthorAvatar author={author} size="base" />
              <span className="min-w-0 truncate font-medium">{displayName}</span>
              {displayName !== author.name && (
                <span className="truncate text-muted-foreground">@{author.name}</span>
              )}
            </Link>
            {profile?.bio && <p className="line-clamp-2 text-muted-foreground">{profile.bio}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {profile?.location && (
                <Meta icon={Location01Icon}>
                  <span className="max-w-40 truncate">{profile.location}</span>
                </Meta>
              )}
              {profile && profile.followers > 0 && (
                <Meta icon={UserGroupIcon}>{compact.format(profile.followers)} followers</Meta>
              )}
              <Meta icon={BookOpen01Icon}>
                {author.skills.length === 1 ? '1 skill' : `${author.skills.length} skills`}
              </Meta>
            </div>
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
    <span className="inline-flex items-center gap-1">
      <HugeiconsIcon icon={icon} className="size-3.5" aria-hidden />
      {children}
    </span>
  )
}
