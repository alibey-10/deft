import { cn } from 'cn'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'

import { Badge } from '#/components/ui/badge.tsx'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { topicLabel, type RegistrySkill } from '#/lib/directory.ts'

/** The title link stretches over the card; inner links sit above it via z-index. */
export function SkillCard({ skill }: { skill: RegistrySkill }) {
  return (
    <Card size="sm" className="relative h-full">
      <CardHeader>
        <CardTitle>
          <div className="flex items-start justify-between gap-3">
            <Link
              to="/skills/$"
              params={{ _splat: skill.pathSlug }}
              className="min-w-0 break-words after:absolute after:inset-0"
            >
              {skill.name}
            </Link>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-hover/card:translate-x-0.5 group-hover/card:text-foreground motion-reduce:transition-none"
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="flex h-full flex-col gap-3">
          <p className="line-clamp-3 text-muted-foreground">{skill.description}</p>
          <div className="mt-auto flex flex-wrap gap-1.5">
            {skill.topics?.map((topic) => (
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
        </div>
      </CardContent>
    </Card>
  )
}

export function SkillGrid({
  skills,
  maxColumns = 3,
}: {
  skills: RegistrySkill[]
  maxColumns?: 2 | 3
}) {
  if (skills.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">No skills match your search.</p>
  }
  return (
    <ul className={cn('grid gap-4 sm:grid-cols-2', maxColumns === 3 && 'xl:grid-cols-3')}>
      {skills.map((skill) => (
        <li key={skill.pathSlug}>
          <SkillCard skill={skill} />
        </li>
      ))}
    </ul>
  )
}
