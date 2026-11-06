import { useHotkey } from '@tanstack/react-hotkeys'
import { useRouteContext, useRouter } from '@tanstack/react-router'

import { setThemeServerFn, type Theme } from '#/lib/theme.ts'

const themes: Theme[] = ['light', 'dark']

/** Current light or dark theme, plus a toggle that persists the choice in a cookie. */
export function useTheme() {
  const { theme: routeTheme } = useRouteContext({ from: '__root__' })
  const router = useRouter()
  const theme: Theme = routeTheme === 'dark' ? 'dark' : 'light'

  function toggleTheme() {
    const next = themes[(themes.indexOf(theme) + 1) % themes.length]
    document.documentElement.classList.toggle('dark', next === 'dark')
    void setThemeServerFn({ data: next }).then(() => router.invalidate())
  }

  return { theme, toggleTheme }
}

/** Binds the D key to the theme toggle. */
export function ThemeHotkey() {
  const { toggleTheme } = useTheme()

  useHotkey({ key: 'D', shift: false, ctrl: false, alt: false, meta: false }, toggleTheme, {
    conflictBehavior: 'replace',
    meta: {
      name: 'Toggle theme',
      description: 'Switch between light and dark appearance',
    },
  })

  return null
}
