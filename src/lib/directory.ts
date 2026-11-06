import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery, type QueryClient } from '@tanstack/react-query'
import type { FunctionReturnType } from 'convex/server'

import { api } from '../../convex/_generated/api'
import type { TopicSlug } from '../../convex/validators.ts'
import { topicBySlug, topics, type Topic } from '#/data/topics.ts'

type DirectoryData = FunctionReturnType<typeof api.directory.get>

export type RegistrySkill = DirectoryData['skills'][number]
export type { Topic, TopicSlug }

export type Author = {
  /** Lowercased GitHub user, used in URLs. */
  key: string
  /** Login as written in the registry. */
  name: string
  avatarUrl: string
  profileUrl: string
  repos: string[]
  skills: RegistrySkill[]
  /** GitHub profile snapshot, if the account exists. */
  profile?: AuthorProfile
}

export type AuthorProfile = {
  login: string
  name: string | null
  bio: string | null
  website: string | null
  location: string | null
  followers: number
}

export type Directory = {
  allSkills: RegistrySkill[]
  skillsByTopic: Map<TopicSlug, RegistrySkill[]>
  /** Topics that have at least one skill, most populated first. */
  topicsWithSkills: Array<Topic & { count: number }>
  /** Authors sorted alphabetically, ignoring case. */
  authors: Author[]
  getAuthor: (key: string) => Author | undefined
  getSkill: (pathSlug: string) => RegistrySkill | undefined
}

/** The one Convex query behind every directory page; preloaded by the root route. */
export const directoryQuery = convexQuery(api.directory.get, {})

const byName = (a: RegistrySkill, b: RegistrySkill) => a.name.localeCompare(b.name)

// The query result only changes identity when Convex pushes new data, so derive once per result.
const built = new WeakMap<DirectoryData, Directory>()

export function buildDirectory(data: DirectoryData): Directory {
  const cached = built.get(data)
  if (cached) return cached

  const allSkills = [...data.skills].sort(byName)

  const skillsByTopic = new Map<TopicSlug, RegistrySkill[]>()
  for (const skill of allSkills) {
    for (const topic of skill.topics) {
      const list = skillsByTopic.get(topic) ?? []
      list.push(skill)
      skillsByTopic.set(topic, list)
    }
  }

  const topicsWithSkills = topics
    .map((topic) => ({ ...topic, count: skillsByTopic.get(topic.slug)?.length ?? 0 }))
    .filter((topic) => topic.count > 0)
    .sort((a, b) => b.count - a.count)

  const authorRows = new Map(data.authors.map((a) => [a.key, a]))
  const authorMap = new Map<string, Author>()
  for (const skill of allSkills) {
    const key = skill.sourceKey
    let author = authorMap.get(key)
    if (!author) {
      const row = authorRows.get(key)
      author = {
        key,
        name: row?.login ?? skill.user,
        avatarUrl: row?.avatarUrl ?? `https://github.com/${skill.user}.png?size=80`,
        profileUrl: row?.profileUrl ?? `https://github.com/${skill.user}`,
        repos: [],
        skills: [],
        profile:
          row?.profileFetchedAt !== undefined
            ? {
                login: row.login,
                name: row.name ?? null,
                bio: row.bio ?? null,
                website: row.website ?? null,
                location: row.location ?? null,
                followers: row.followers ?? 0,
              }
            : undefined,
      }
      authorMap.set(key, author)
    }
    author.skills.push(skill)
    if (!author.repos.includes(skill.repo)) author.repos.push(skill.repo)
  }

  const authors = [...authorMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }),
  )
  const skillByPath = new Map(allSkills.map((skill) => [skill.pathSlug.toLowerCase(), skill]))

  const directory: Directory = {
    allSkills,
    skillsByTopic,
    topicsWithSkills,
    authors,
    getAuthor: (key) => authorMap.get(key.toLowerCase()),
    getSkill: (pathSlug) => skillByPath.get(pathSlug.toLowerCase()),
  }
  built.set(data, directory)
  return directory
}

/** Directory data for components. The root route preloads it, so this never suspends there. */
export function useDirectory(): Directory {
  const { data } = useSuspenseQuery(directoryQuery)
  return buildDirectory(data)
}

/** Directory data for route loaders. */
export async function loadDirectory(queryClient: QueryClient): Promise<Directory> {
  return buildDirectory(await queryClient.ensureQueryData(directoryQuery))
}

export const getTopic = (slug: string) => topicBySlug.get(slug as TopicSlug)

export const topicLabel = (slug: TopicSlug) => topicBySlug.get(slug)?.label ?? slug
