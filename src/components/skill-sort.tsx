import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs.tsx'
import type { RegistrySkill } from '#/lib/directory.ts'

export const skillSorts = [
  { value: 'recent', label: 'Recently added' },
  { value: 'stars', label: 'Most stars' },
] as const

export type SkillSort = (typeof skillSorts)[number]['value']

const isSkillSort = (value: unknown): value is SkillSort =>
  skillSorts.some((sort) => sort.value === value)

/** `?sort=` search param; the default (`recent`) stays out of the URL. */
export const validateSortSearch = (search: Record<string, unknown>): { sort?: SkillSort } =>
  isSkillSort(search.sort) && search.sort !== 'recent' ? { sort: search.sort } : {}

const compare: Record<SkillSort, (a: RegistrySkill, b: RegistrySkill) => number> = {
  recent: (a, b) => b.addedAt - a.addedAt,
  // Skills without a star count go last.
  stars: (a, b) => (b.stars ?? -1) - (a.stars ?? -1),
}

/** Input is A–Z, and the sort is stable, so ties stay alphabetical. */
export const sortSkills = (skills: RegistrySkill[], sort: SkillSort) =>
  [...skills].sort(compare[sort])

export function SkillSortTabs({
  value,
  onChange,
}: {
  value: SkillSort
  onChange: (value: SkillSort) => void
}) {
  return (
    <Tabs value={value} onValueChange={(next) => isSkillSort(next) && onChange(next)}>
      <TabsList aria-label="Sort skills">
        {skillSorts.map((sort) => (
          <TabsTrigger key={sort.value} value={sort.value}>
            {sort.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
