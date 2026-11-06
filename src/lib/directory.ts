import { registry, type RegistrySkill, type TopicSlug } from '#/data/registry.ts'
import { topicBySlug, topics, type Topic } from '#/data/topics.ts'
import authorProfiles from '#/data/author-profiles.json'

export type { RegistrySkill, Topic, TopicSlug }

export type Author = {
  /** Lowercased GitHub user, used in URLs. */
  key: string
  /** Display name as written in the registry. */
  name: string
  avatarUrl: string
  profileUrl: string
  repos: string[]
  skills: RegistrySkill[]
  /** GitHub profile snapshot from scripts/update-author-profiles.ts, if the account exists. */
  profile?: AuthorProfile
}

export type AuthorProfile = {
  login: string
  name: string | null
  bio: string | null
  website: string | null
  location: string | null
}

const profiles: Record<string, AuthorProfile> = authorProfiles.profiles

const byName = (a: RegistrySkill, b: RegistrySkill) => a.name.localeCompare(b.name)

export const allSkills: RegistrySkill[] = [...registry].sort(byName)

export const skillsByTopic = new Map<TopicSlug, RegistrySkill[]>()
for (const skill of allSkills) {
  for (const topic of skill.topics ?? []) {
    const list = skillsByTopic.get(topic) ?? []
    list.push(skill)
    skillsByTopic.set(topic, list)
  }
}

/** Topics that have at least one skill, most populated first. */
export const topicsWithSkills: Array<Topic & { count: number }> = topics
  .map((topic) => ({ ...topic, count: skillsByTopic.get(topic.slug)?.length ?? 0 }))
  .filter((topic) => topic.count > 0)
  .sort((a, b) => b.count - a.count)

const authorMap = new Map<string, Author>()
for (const skill of allSkills) {
  const key = skill.sourceKey
  let author = authorMap.get(key)
  if (!author) {
    author = {
      key,
      name: skill.sourceLabel,
      avatarUrl: `https://github.com/${skill.user}.png?size=80`,
      profileUrl: `https://github.com/${skill.user}`,
      repos: [],
      skills: [],
      profile: profiles[key],
    }
    authorMap.set(key, author)
  }
  author.skills.push(skill)
  if (!author.repos.includes(skill.repo)) author.repos.push(skill.repo)
}

/** Authors sorted alphabetically, ignoring case. */
export const authors: Author[] = [...authorMap.values()].sort((a, b) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }),
)

export const getAuthor = (key: string) => authorMap.get(key.toLowerCase())

export const getTopic = (slug: string) => topicBySlug.get(slug as TopicSlug)

export const topicLabel = (slug: TopicSlug) => topicBySlug.get(slug)?.label ?? slug

export function filterSkills(skills: RegistrySkill[], query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return skills
  return skills.filter((skill) => {
    const haystack = [
      skill.name,
      skill.description,
      skill.user,
      skill.repo,
      ...(skill.topics ?? []),
    ]
      .join(' ')
      .toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}

const skillByPath = new Map(allSkills.map((skill) => [skill.pathSlug.toLowerCase(), skill]))

export const getSkill = (pathSlug: string) => skillByPath.get(pathSlug.toLowerCase())
