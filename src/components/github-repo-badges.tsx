type Metric = 'stars' | 'last-commit'

const badgeUrl = (user: string, repo: string, metric: Metric, mode: 'light' | 'dark') =>
  `https://shieldcn.dev/github/${user}/${repo}/${metric}.svg?variant=outline&size=sm&mode=${mode}`

/** shieldcn badge for a GitHub repo metric, swapping artwork for dark mode. */
function RepoShield({
  user,
  repo,
  metric,
  label,
  href,
}: {
  user: string
  repo: string
  metric: Metric
  label: string
  href: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="inline-flex rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <img
        src={badgeUrl(user, repo, metric, 'light')}
        alt={label}
        className="h-7 w-auto dark:hidden"
      />
      <img
        src={badgeUrl(user, repo, metric, 'dark')}
        alt={label}
        className="hidden h-7 w-auto dark:block"
      />
    </a>
  )
}

/** Star count and last commit badges for a GitHub repo. */
export function GithubRepoBadges({ user, repo }: { user: string; repo: string }) {
  const repoUrl = `https://github.com/${user}/${repo}`
  return (
    <>
      <RepoShield
        user={user}
        repo={repo}
        metric="stars"
        label={`${user}/${repo} GitHub stars`}
        href={repoUrl}
      />
      <RepoShield
        user={user}
        repo={repo}
        metric="last-commit"
        label={`${user}/${repo} last commit`}
        href={`${repoUrl}/commits`}
      />
    </>
  )
}
