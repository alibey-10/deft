import { useRef, useState } from 'react'
import { cn } from 'cn'

import {
  useMessageScroller,
  useMessageScrollerVisibility,
} from '#/components/ui/message-scroller.tsx'

export type MinimapTurn = {
  /** The user message's id, as passed to `MessageScrollerItem`. */
  id: string
  question: string
  /** Plain-text start of the assistant's reply, if any. */
  answer?: string
}

/**
 * A rail of tick marks, one per question, beside the conversation. The current turn's tick is
 * longest; hovering or focusing a tick previews that turn, and clicking jumps to it.
 * Must render inside `MessageScrollerProvider`.
 */
export function ConversationMinimap({
  turns,
  className,
}: {
  turns: MinimapTurn[]
  className?: string
}) {
  const { scrollToMessage } = useMessageScroller()
  const { currentAnchorId } = useMessageScrollerVisibility()
  const [preview, setPreview] = useState<{ index: number; top: number }>()
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const frame = useRef<HTMLDivElement>(null)

  const show = (index: number, tick: HTMLElement) => {
    clearTimeout(hideTimer.current)
    const tickBox = tick.getBoundingClientRect()
    const frameTop = frame.current?.getBoundingClientRect().top ?? 0
    setPreview({ index, top: tickBox.top + tickBox.height / 2 - frameTop })
  }
  // A short delay lets the pointer cross the gaps between ticks without the card flickering.
  const hide = () => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setPreview(undefined), 120)
  }

  const current = turns.findIndex((turn) => turn.id === currentAnchorId)
  const active = current === -1 ? turns.length - 1 : current
  const previewed = preview ? turns[preview.index] : undefined

  return (
    <nav
      aria-label="Conversation"
      className={cn('pointer-events-none flex items-center', className)}
    >
      <div ref={frame} className="relative flex max-h-full">
        <ol className="pointer-events-auto relative flex max-h-full flex-col overflow-y-auto py-2 [scrollbar-width:none]">
          {turns.map((turn, index) => (
            <li key={turn.id} className="flex">
              <button
                type="button"
                aria-label={turn.question}
                aria-current={index === active ? 'location' : undefined}
                data-previewed={preview?.index === index || undefined}
                className="group/tick flex h-2.5 w-9 shrink-0 items-center rounded-sm pl-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onPointerEnter={(event) => show(index, event.currentTarget)}
                onPointerLeave={hide}
                onFocus={(event) => show(index, event.currentTarget)}
                onBlur={hide}
                onClick={() => scrollToMessage(turn.id, { align: 'start', behavior: 'smooth' })}
              >
                <span
                  className={cn(
                    'h-0.5 w-3 rounded-full bg-muted-foreground/40 transition-[width,background-color] duration-200 ease-out',
                    'group-aria-[current=location]/tick:w-5 group-aria-[current=location]/tick:bg-foreground',
                    'group-data-previewed/tick:w-7 group-data-previewed/tick:bg-foreground',
                  )}
                />
              </button>
            </li>
          ))}
        </ol>

        {previewed && preview && (
          <div
            aria-hidden
            style={{ top: preview.top }}
            className="pointer-events-none absolute left-10 z-20 w-72 -translate-y-1/2 animate-in rounded-xl border bg-popover px-4 py-3 text-popover-foreground shadow-lg duration-150 fade-in-0 zoom-in-95 motion-safe:transition-[top] motion-safe:duration-200 motion-safe:ease-out"
          >
            <p className="truncate text-sm font-medium">{previewed.question}</p>
            {previewed.answer && (
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{previewed.answer}</p>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

/** Rough markdown-to-text for previews: keeps link labels, drops syntax. */
export function toPlainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
