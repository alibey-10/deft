import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons'

import { Button } from '#/components/ui/button.tsx'
import { useCopyToClipboard } from '#/hooks/use-copy-to-clipboard.ts'

/** Multi-line code on the ink slab, with a file label and a copy button. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <div className="min-w-0 overflow-hidden rounded-lg bg-slab text-slab-foreground ring-1 ring-transparent ring-inset dark:ring-border">
      <div className="flex h-10 items-center justify-between gap-3 border-b border-slab-foreground/10 pr-1.5 pl-4">
        <span className="truncate font-mono text-xs text-slab-foreground/60">{label}</span>
        <Button
          variant="slab"
          size="icon-sm"
          onClick={() => copy(code)}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} aria-hidden />
        </Button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[0.8125rem] leading-relaxed [scrollbar-width:thin]">
        <code>{code}</code>
      </pre>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </div>
  )
}
