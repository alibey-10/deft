import { Link } from '@tanstack/react-router'

import { CommandPalette } from '#/components/command-palette.tsx'

const nav = [
  { to: '/', label: 'Skills' },
  { to: '/topics', label: 'Topics' },
  { to: '/authors', label: 'Authors' },
] as const

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to="/" className="font-semibold tracking-tight">
          Skilly
        </Link>
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1 text-sm lg:hidden">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === '/' }}
                className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground data-[status=active]:text-foreground data-[status=active]:font-medium"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <CommandPalette />
        </div>
      </div>
    </header>
  )
}

export function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 pb-8">
      {eyebrow && <div className="text-sm text-muted-foreground">{eyebrow}</div>}
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {description && <p className="max-w-2xl text-pretty text-muted-foreground">{description}</p>}
      {children}
    </div>
  )
}
