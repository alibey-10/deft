import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { NewTwitterIcon, SparklesIcon } from '@hugeicons/core-free-icons'

import { CommandPalette } from '#/components/command-palette.tsx'
import { buttonVariants } from '#/components/ui/button.tsx'
import { ThemeToggle } from '#/components/ui/theme-toggle.tsx'
import { useTheme } from '#/hooks/use-theme.ts'

const nav = [
  { to: '/', label: 'Skills' },
  { to: '/topics', label: 'Topics' },
  { to: '/authors', label: 'Authors' },
] as const

export function SiteHeader() {
  const { theme, toggleTheme } = useTheme()
  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-[1.0625rem] font-semibold tracking-[-0.02em] [font-stretch:92%]"
        >
          <SkillyMark />
          Skilly
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <nav className="flex items-center text-sm lg:hidden">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === '/' }}
                className="rounded-md px-2 py-1.5 text-muted-foreground hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            to="/ask"
            aria-label="Ask AI"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <HugeiconsIcon icon={SparklesIcon} data-icon="inline-start" aria-hidden />
            <span className="max-sm:hidden">Ask AI</span>
          </Link>
          <CommandPalette />
          <a
            href="https://x.com/alibey_10"
            target="_blank"
            rel="noreferrer"
            aria-label="Ali on X"
            title="Ali on X"
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          >
            <HugeiconsIcon icon={NewTwitterIcon} aria-hidden />
          </a>
          <ThemeToggle
            aria-label={themeLabel}
            title={themeLabel}
            onClick={toggleTheme}
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          />
        </div>
      </div>
    </header>
  )
}

/** A spec dimension bracket: the logo's take on a designer's redline measurement. */
function SkillyMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="size-4 text-redline"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path d="M1.75 3v10M14.25 3v10M1.75 8h12.5" />
      <path d="M4.5 5.5 1.75 8l2.75 2.5M11.5 5.5 14.25 8l-2.75 2.5" strokeLinejoin="round" />
    </svg>
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
    <div className="flex flex-col gap-3 pb-10">
      {eyebrow && <div className="text-sm text-muted-foreground">{eyebrow}</div>}
      <h1 className="text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.025em] text-balance [font-stretch:90%] sm:text-[2.625rem]">
        {title}
      </h1>
      {description && (
        <p className="max-w-[62ch] text-[1.0625rem] leading-relaxed text-pretty text-muted-foreground">
          {description}
        </p>
      )}
      {children}
    </div>
  )
}
