import { createFileRoute, Link, notFound } from '@tanstack/react-router'

import { AuthorAvatar } from '#/components/author-avatar.tsx'
import { PageIntro } from '#/components/site-header.tsx'
import { SkillGrid } from '#/components/skill-card.tsx'
import { SkillSearch, validateSkillSearch } from '#/components/skill-search.tsx'
import { GithubRepoBadges } from '#/components/github-repo-badges.tsx'
import { filterSkills, getAuthor } from '#/lib/directory.ts'

export const Route = createFileRoute('/authors/$author')({
  validateSearch: validateSkillSearch,
  loader: ({ params }) => {
    const author = getAuthor(params.author)
    if (!author) throw notFound()
    return { authorKey: author.key }
  },
  head: ({ loaderData }) => {
    const author = loaderData && getAuthor(loaderData.authorKey)
    return { meta: author ? [{ title: `UI skills by ${author.name} · Skilly` }] : [] }
  },
  component: AuthorPage,
})

function AuthorPage() {
  const { authorKey } = Route.useLoaderData()
  const author = getAuthor(authorKey)!
  const { q = '' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const results = filterSkills(author.skills, q)
  // One badge per repo, skipping skills hosted outside GitHub.
  const githubRepos = author.repos.flatMap((repo) => {
    const skill = author.skills.find(
      (s) => s.repo === repo && s.githubUrl.startsWith('https://github.com/'),
    )
    return skill ? [{ user: skill.user, repo }] : []
  })

  return (
    <>
      <PageIntro
        eyebrow={
          <Link to="/authors" className="hover:text-foreground">
            Authors
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <AuthorAvatar author={author} size="lg" />
            {author.name}
          </span>
        }
        description={`${author.skills.length} ${author.skills.length === 1 ? 'skill' : 'skills'} across ${author.repos.join(', ')}.`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {githubRepos.map(({ user, repo }) => (
            <GithubRepoBadges key={repo} user={user} repo={repo} />
          ))}
        </div>
      </PageIntro>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">
            Skills <span className="text-muted-foreground tabular-nums">{results.length}</span>
          </h2>
          {author.skills.length > 6 && (
            <SkillSearch
              value={q}
              placeholder={`Search ${author.name}'s skills…`}
              onChange={(value) =>
                navigate({ search: value ? { q: value } : {}, replace: true, resetScroll: false })
              }
            />
          )}
        </div>
        <SkillGrid skills={results} />
      </section>
    </>
  )
}
