import { useRef } from 'react'
import { cn } from 'cn'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '#/components/ui/input-group.tsx'

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
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <InputGroup className={cn('max-w-md', className)}>
      <InputGroupAddon>
        <HugeiconsIcon icon={Search01Icon} aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        type="search"
        aria-label={placeholder.replace(/…$/, '')}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Clear search"
            onClick={() => {
              onChange('')
              inputRef.current?.focus()
            }}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}

/** Shared `?q=` search param validation for skill listing routes. */
export const validateSkillSearch = (search: Record<string, unknown>): { q?: string } =>
  typeof search.q === 'string' && search.q ? { q: search.q } : {}
