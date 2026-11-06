import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie } from '@tanstack/react-start/server'
import { z } from 'zod'

const storageKey = 'app-theme'

const themeSchema = z.union([z.literal('light'), z.literal('dark')])
export type Theme = z.infer<typeof themeSchema>

function parseTheme(value: string | undefined): Theme {
  const result = themeSchema.safeParse(value)
  return result.success ? result.data : 'light'
}

export const getThemeServerFn = createServerFn({ method: 'GET' }).handler((): Theme =>
  parseTheme(getCookie(storageKey)),
)

export const setThemeServerFn = createServerFn({ method: 'POST' })
  .validator((data: Theme) => {
    const result = themeSchema.safeParse(data)
    if (!result.success) {
      throw new Error('Invalid theme')
    }
    return result.data
  })
  .handler(({ data }) => {
    setCookie(storageKey, data, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  })
