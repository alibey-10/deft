import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { NewTwitterIcon, SparklesIcon } from '@hugeicons/core-free-icons'

import { CommandPalette } from '#/components/command-palette.tsx'
import { SubmitSkillDialog } from '#/components/submit-skill-dialog.tsx'
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
    <header className="sticky top-0 z-20 border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to="/" aria-label="Deft, home" className="-mx-1 rounded-sm px-1 py-2">
          <DeftLogo />
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            to="/docs/mcp"
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'max-sm:hidden' })}
          >
            MCP
          </Link>
          <SubmitSkillDialog />
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
      {/* Below `lg` the sidebar is hidden, so the sections get a row of their own. */}
      <nav className="mx-auto flex h-10 max-w-7xl items-center gap-1 border-t px-2 text-sm lg:hidden">
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
    </header>
  )
}

/**
 * The wordmark, drawn rather than typeset: one stroke weight, and a single crossbar shared by
 * the f and the t. `public/logo.svg` is the same drawing as a standalone file.
 */
function DeftLogo() {
  return (
    <svg
      viewBox="0 2 48.5 20"
      aria-hidden
      className="h-[1.125rem] w-auto"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
    >
      <circle cx="7" cy="15" r="5" />
      <path d="M12 4v16M17.2 15H27a5 5 0 1 0-1.17 3.21M33.5 20V8a4 4 0 0 1 4-4h1M42.5 5.5V16a4 4 0 0 0 4 4h1.2M30.3 10h17" />
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
