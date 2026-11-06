import { useEffect, useState } from 'react'

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

/** Copies text to the clipboard; `copied` stays true for two seconds after a successful copy. */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timeout)
  }, [copied])

  const copy = async (text: string) => {
    try {
      await copyText(text)
      setCopied(true)
    } catch {
      // Clipboard can be blocked by permissions; leave the text selectable.
    }
  }

  return { copied, copy }
}
