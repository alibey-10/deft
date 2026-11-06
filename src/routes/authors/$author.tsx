import { createFileRoute, notFound } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { GithubIcon, Link01Icon, Location01Icon, UserGroupIcon } from '@hugeicons/core-free-icons'

import { AuthorAvatar } from '#/components/author-avatar.tsx'
import { GridColumnsToggle, useGridColumns } from '#/components/grid-columns.tsx'
import { PageIntro } from '#/components/site-header.tsx'
import { SkillGrid } from '#/components/skill-card.tsx'
import { GithubRepoBadges } from '#/components/github-repo-badges.tsx'
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
  const [columns, setColumns] = useGridColumns()
  const profile = author.profile
  const displayName = profile?.name ?? author.name
  const repos = author.repos.map((repo) => {
    const skills = author.skills.filter((s) => s.repo === repo)
    // Badges only make sense for repos hosted on GitHub.
    const github = skills.find((s) => s.githubUrl.startsWith('https://github.com/'))
    return { repo, user: skills[0].user, onGithub: !!github }
  })

  return (
    <div className="grid gap-x-10 xl:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="xl:col-start-1">
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
      </div>

      <aside
        aria-label={repos.length === 1 ? 'Repository' : 'Repositories'}
        className="mb-8 flex flex-col gap-3 self-start xl:sticky xl:top-14 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:mb-0 xl:py-2"
      >
        <ul className="flex flex-col gap-8">
          {repos.map(({ repo, user, onGithub }) => (
            <li key={repo} className="flex flex-col items-start gap-4">
              {onGithub ? (
                <a
                  href={`https://github.com/${user}/${repo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex max-w-full min-w-0 items-center gap-2 text-base font-medium hover:underline hover:underline-offset-4"
                >
                  <HugeiconsIcon icon={GithubIcon} className="size-5 shrink-0" aria-hidden />
                  <span className="truncate">
                    {user}/{repo}
                  </span>
                </a>
              ) : (
                <span className="max-w-full truncate text-base font-medium">
                  {user}/{repo}
                </span>
              )}
              {onGithub && (
                <div className="flex flex-col items-start gap-3">
                  <GithubRepoBadges user={user} repo={repo} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </aside>

      <section aria-label="Skills" className="flex flex-col gap-4 xl:col-start-1">
        <div className="flex justify-end">
          <GridColumnsToggle value={columns} onChange={setColumns} />
        </div>
        <SkillGrid skills={author.skills} columns={columns} meta="topics" />
      </section>
    </div>
  )
}
