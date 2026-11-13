import { useHotkey } from '@tanstack/react-hotkeys'
import { useNavigate } from '@tanstack/react-router'

/** `id` of the sidebar's filter input, focused after a tab hotkey. */
export const SIDEBAR_FILTER_ID = 'sidebar-filter'

const bare = { shift: false, ctrl: false, alt: false, meta: false } as const

/** Focuses the sidebar filter when it's on screen (the sidebar is hidden below `lg`). */
function focusSidebarFilter() {
  const input = document.getElementById(SIDEBAR_FILTER_ID)
  if (input instanceof HTMLInputElement && input.offsetParent !== null) input.focus()
}

/** Binds T to the topics index and A to the authors index, then focuses the sidebar filter. */
export function NavHotkeys() {
  const navigate = useNavigate()

  const go = (to: '/topics' | '/authors') => {
    // Focus right away so typing straight after the key lands in the filter; the sidebar
    // switches its tab once the route changes, and the input is shared by both tabs.
    focusSidebarFilter()
    void navigate({ to })
  }

  useHotkey({ key: 'T', ...bare }, () => go('/topics'), {
    conflictBehavior: 'replace',
    // Stop the keystroke itself from being typed into the newly focused filter.
    preventDefault: true,
    meta: { name: 'Go to topics', description: 'Open topics and focus the filter' },
  })
  useHotkey({ key: 'A', ...bare }, () => go('/authors'), {
    conflictBehavior: 'replace',
    preventDefault: true,
    meta: { name: 'Go to authors', description: 'Open authors and focus the filter' },
  })

  return null
}
