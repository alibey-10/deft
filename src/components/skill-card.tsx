import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowUpRight01Icon } from '@hugeicons/core-free-icons'

import { Badge } from '#/components/ui/badge.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { topicLabel, type RegistrySkill } from '#/lib/directory.ts'

export function SkillCard({ skill, hideAuthor }: { skill: RegistrySkill; hideAuthor?: boolean }) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle>
          <div className="flex items-start justify-between gap-3">
            <a
              href={skill.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 break-words hover:underline"
            >
              {skill.name}
            </a>
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </div>
        </CardTitle>
        <CardDescription>
          {hideAuthor ? (
            <span>{skill.repo}</span>
          ) : (
            <>
              <Link
                to="/authors/$author"
                params={{ author: skill.sourceKey }}
                className="font-medium text-foreground hover:underline"
              >
                {skill.user}
              </Link>
              <span> / {skill.repo}</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="flex h-full flex-col gap-3">
          <p className="line-clamp-3 text-muted-foreground">{skill.description}</p>
          <div className="mt-auto flex flex-wrap gap-1.5">
            {skill.topics?.map((topic) => (
              <Badge
                key={topic}
                variant="outline"
                render={<Link to="/topics/$topic" params={{ topic }} />}
              >
                {topicLabel(topic)}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function SkillGrid({
  skills,
  hideAuthor,
}: {
  skills: RegistrySkill[]
  hideAuthor?: boolean
}) {
  if (skills.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">No skills match your search.</p>
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {skills.map((skill) => (
        <li key={skill.pathSlug}>
          <SkillCard skill={skill} hideAuthor={hideAuthor} />
        </li>
      ))}
    </ul>
  )
}
