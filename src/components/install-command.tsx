import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons'

import { Button } from '#/components/ui/button.tsx'

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  // Fallback for non-secure contexts where the async clipboard API is missing.
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

/** Single-line shell command with a copy button. */
export function InstallCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timeout)
  }, [copied])

  const copy = async () => {
    try {
      await copyText(command)
      setCopied(true)
    } catch {
      // Clipboard can be blocked by permissions; leave the command selectable.
    }
  }

  return (
    <div className="flex h-12 min-w-0 items-center gap-3 rounded-lg bg-slab pr-1.5 pl-4 text-slab-foreground ring-1 ring-transparent ring-inset dark:ring-border">
      <span aria-hidden className="shrink-0 font-mono text-sm text-redline select-none">
        $
      </span>
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[0.8125rem] whitespace-nowrap [scrollbar-width:none]">
        {command}
      </code>
      <Button
        variant="slab"
        size="icon-sm"
        onClick={copy}
        aria-label={copied ? 'Command copied' : 'Copy command'}
      >
        <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} aria-hidden />
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </div>
  )
}
