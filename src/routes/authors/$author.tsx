import { createFileRoute, notFound } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { GithubIcon, Link01Icon, Location01Icon, UserGroupIcon } from '@hugeicons/core-free-icons'

import { cn } from 'cn'

import { AuthorAvatar } from '#/components/author-avatar.tsx'
import { PageWithAside } from '#/components/page-with-aside.tsx'
import { PageIntro } from '#/components/site-header.tsx'
import { SkillGrid } from '#/components/skill-card.tsx'
import { GithubRepoBadges } from '#/components/github-repo-badges.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { loadDirectory, useDirectory } from '#/lib/directory.ts'

export const Route = createFileRoute('/authors/$author')({
  loader: async ({ params, context }) => {
    const author = (await loadDirectory(context.queryClient)).getAuthor(params.author)
    if (!author) throw notFound()
    return { authorKey: author.key, authorName: author.name }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `UI skills by ${loaderData.authorName} · Skilly` }] : [],
  }),
  component: AuthorPage,
})

const formatCount = (n: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

function AuthorPage() {
  const { authorKey } = Route.useLoaderData()
  const author = useDirectory().getAuthor(authorKey)
  if (!author) throw notFound()
  const profile = author.profile
  const displayName = profile?.name ?? author.name
  const repos = author.repos.map((repo) => {
    const skills = author.skills.filter((s) => s.repo === repo)
    // Badges only make sense for repos hosted on GitHub.
    const onGithub = skills.some((s) => s.githubUrl.startsWith('https://github.com/'))
    return {
      repo,
      user: skills[0].user,
      onGithub,
      description: author.repoDescriptions.get(repo),
    }
  })

  return (
    <PageWithAside>
      <PageIntro
        title={
          <span className="flex items-center gap-3">
            <AuthorAvatar author={author} size="lg" />
            {displayName}
          </span>
        }
        description={profile?.bio ?? undefined}
      >
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {profile && (
            <li className="flex items-center gap-1.5">
              <HugeiconsIcon icon={UserGroupIcon} className="size-4" aria-hidden />
              <span>
                <span className="font-medium text-foreground tabular-nums">
                  {formatCount(profile.followers)}
                </span>{' '}
                {profile.followers === 1 ? 'follower' : 'followers'}
              </span>
            </li>
          )}
          {profile?.location && (
            <li className="flex items-center gap-1.5">
              <HugeiconsIcon icon={Location01Icon} className="size-4" aria-hidden />
              {profile.location}
            </li>
          )}
          {profile?.website && (
            <li className="flex min-w-0 items-center gap-1.5">
              <HugeiconsIcon icon={Link01Icon} className="size-4 shrink-0" aria-hidden />
              <a
                href={profile.website}
                target="_blank"
                rel="noreferrer"
                className="truncate hover:text-foreground"
              >
                {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </li>
          )}
        </ul>
      </PageIntro>

      <section
        aria-label={repos.length === 1 ? 'Repository' : 'Repositories'}
        className={cn('mb-10 grid gap-4', repos.length > 1 && 'md:grid-cols-2')}
      >
        {repos.map(({ repo, user, onGithub, description }) => (
          <Card key={repo}>
            <CardHeader>
              <CardTitle>
                <div className="flex min-w-0 items-center gap-2">
                  <HugeiconsIcon icon={GithubIcon} className="size-5 shrink-0" aria-hidden />
                  {onGithub ? (
                    <a
                      href={`https://github.com/${user}/${repo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate hover:underline hover:underline-offset-4"
                    >
                      {user}/{repo}
                    </a>
                  ) : (
                    <span className="truncate">
                      {user}/{repo}
                    </span>
                  )}
                </div>
              </CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            {onGithub && (
              <CardContent className="mt-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <GithubRepoBadges user={user} repo={repo} />
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </section>

      <section aria-label="Skills">
        <SkillGrid skills={author.skills} columns={1} meta="topics" />
      </section>
    </PageWithAside>
  )
}
