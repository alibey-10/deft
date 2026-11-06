import { AuthorAvatar } from '#/components/author-avatar.tsx'
import { useDirectory } from '#/lib/directory.ts'

/** The avatar of a skill's author, or `fallback` when the skill or author isn't listed. */
export function SkillAvatar({
  pathSlug,
  fallback = null,
}: {
  pathSlug: string
  fallback?: React.ReactNode
}) {
  const { getSkill, getAuthor } = useDirectory()
  const skill = getSkill(pathSlug)
  const author = skill && getAuthor(skill.sourceKey)
  return author ? <AuthorAvatar author={author} size="xs" /> : fallback
}

/** `/skills/<pathSlug>` → `<pathSlug>`, for links the assistant writes. */
export const skillPathFromHref = (href: string) =>
  /^\/skills\/([^?#]+)/.exec(href)?.[1]?.replace(/\/$/, '')
