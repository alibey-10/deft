import { TableAggregate } from '@convex-dev/aggregate'
import { components } from './_generated/api'
import type { DataModel, Doc } from './_generated/dataModel'

/**
 * Skills ordered by name, namespaced by status. Gives the home page counts and offsets for
 * numbered pagination. Every write to `skills` must update it (see `convex/seed.ts`).
 */
export const skillsByName = new TableAggregate<{
  Namespace: Doc<'skills'>['status']
  Key: string
  DataModel: DataModel
  TableName: 'skills'
}>(components.skillsByName, {
  namespace: (doc) => doc.status,
  sortKey: (doc) => doc.name.toLowerCase(),
})

/** Text the `search_text` index matches against: everything the home page search covers. */
export const skillSearchText = (skill: {
  name: string
  description: string
  user: string
  repo: string
  topics: string[]
}) => [skill.name, skill.description, skill.user, skill.repo, ...skill.topics].join(' ')
