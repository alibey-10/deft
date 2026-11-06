import { useSyncExternalStore } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Layout2ColumnIcon, RectangularIcon } from '@hugeicons/core-free-icons'

import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs.tsx'

export type GridColumns = 1 | 2

const STORAGE_KEY = 'skilly:grid-columns'
const DEFAULT: GridColumns = 1
const listeners = new Set<() => void>()

function read(): GridColumns {
  try {
    return localStorage.getItem(STORAGE_KEY) === '2' ? 2 : 1
  } catch {
    return DEFAULT
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Keep other tabs in sync.
  const onStorage = (event: StorageEvent) => event.key === STORAGE_KEY && listener()
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function write(columns: GridColumns) {
  try {
    localStorage.setItem(STORAGE_KEY, String(columns))
  } catch {
    // Storage blocked (private mode etc.); the choice just won't persist.
  }
  for (const listener of listeners) listener()
}

/** Skill grid column count, shared across pages and remembered in localStorage. */
export function useGridColumns() {
  const columns = useSyncExternalStore(subscribe, read, () => DEFAULT)
  return [columns, write] as const
}

const options = [
  { value: 1, label: 'One column', icon: RectangularIcon },
  { value: 2, label: 'Two columns', icon: Layout2ColumnIcon },
] as const

export function GridColumnsToggle({
  value,
  onChange,
}: {
  value: GridColumns
  onChange: (value: GridColumns) => void
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next === 2 ? 2 : 1)}>
      <TabsList aria-label="Grid layout">
        {options.map(({ value, label, icon }) => (
          <TabsTrigger key={value} value={value} aria-label={label} title={label}>
            <HugeiconsIcon icon={icon} aria-hidden />
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
