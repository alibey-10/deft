import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from '@tanstack/react-router'
import { cn } from 'cn'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { DirectorySidebar } from '#/components/directory-sidebar.tsx'
import { SiteHeader } from '#/components/site-header.tsx'
import { ThemeHotkey } from '#/hooks/use-theme.ts'
import { directoryQuery } from '#/lib/directory.ts'
import { getThemeServerFn, type Theme } from '#/lib/theme.ts'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  beforeLoad: async (): Promise<{ theme: Theme }> => {
    return { theme: await getThemeServerFn() }
  },
  // Every page and the sidebar read the directory, so load it once here (also during SSR).
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(directoryQuery)
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Skilly · UI skills directory',
      },
      {
        name: 'description',
        content: 'Browse UI skills for coding agents by topic or by author.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-muted-foreground">That topic, author, or page doesn't exist.</p>
      <Link to="/" className="text-sm underline underline-offset-4">
        Back to all skills
      </Link>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { theme } = useRouteContext({ from: '__root__' })

  return (
    <html
      lang="en"
      className={cn(theme === 'dark' && 'dark', 'scroll-smooth antialiased')}
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeHotkey />
        <SiteHeader />
        <div className="mx-auto flex max-w-7xl gap-8 px-4">
          <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-64 shrink-0 py-6 lg:block">
            <DirectorySidebar />
          </aside>
          <main className="min-w-0 flex-1 py-10">{children}</main>
        </div>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
