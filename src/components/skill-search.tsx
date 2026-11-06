import { cn } from 'cn'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon } from '@hugeicons/core-free-icons'

import { InputGroup, InputGroupAddon, InputGroupInput } from '#/components/ui/input-group.tsx'

export function SkillSearch({
  value,
  onChange,
  placeholder = 'Search skills…',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <InputGroup className={cn('max-w-md', className)}>
      <InputGroupAddon>
        <HugeiconsIcon icon={Search01Icon} aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label="Search skills"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </InputGroup>
  )
}

/** Shared `?q=` search param validation for skill listing routes. */
export const validateSkillSearch = (search: Record<string, unknown>): { q?: string } =>
  typeof search.q === 'string' && search.q ? { q: search.q } : {}
