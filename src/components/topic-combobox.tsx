import { Fragment } from 'react'

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '#/components/ui/combobox.tsx'
import type { TopicSlug } from '#/data/registry.ts'
import { topicBySlug, topics } from '#/data/topics.ts'

const groups = [
  { value: 'Design engineering', items: topics.filter((t) => t.isDesignCore).map((t) => t.slug) },
  {
    value: 'Frameworks & libraries',
    items: topics.filter((t) => !t.isDesignCore).map((t) => t.slug),
  },
]

const labelOf = (slug: TopicSlug) => topicBySlug.get(slug)?.label ?? slug

/** Multi-select combobox for a skill's topics, kept in the order they were picked. */
export function TopicCombobox({
  id,
  value,
  onChange,
  max,
  invalid,
  disabled,
}: {
  id?: string
  value: TopicSlug[]
  onChange: (value: TopicSlug[]) => void
  max: number
  invalid?: boolean
  disabled?: boolean
}) {
  const anchor = useComboboxAnchor()
  const full = value.length >= max

  return (
    <Combobox
      multiple
      autoHighlight
      items={groups}
      value={value}
      onValueChange={(next: TopicSlug[]) => onChange(next)}
      itemToStringLabel={labelOf}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(selected: TopicSlug[]) => (
            <Fragment>
              {selected.map((slug) => (
                <ComboboxChip key={slug}>{labelOf(slug)}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                aria-invalid={invalid || undefined}
                placeholder={selected.length ? (full ? '' : 'Add another…') : 'Search topics…'}
              />
            </Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No topics match.</ComboboxEmpty>
        <ComboboxList>
          {(group: (typeof groups)[number]) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel>{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(slug: TopicSlug) => (
                  <ComboboxItem key={slug} value={slug} disabled={full && !value.includes(slug)}>
                    {labelOf(slug)}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
