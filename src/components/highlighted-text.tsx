import { Fragment } from 'react'

import { highlightDescription } from '#/lib/highlight-text.ts'

export function HighlightedText({
  text,
  query,
  windowAfter,
  leadChars,
}: {
  text: string
  query?: string
  windowAfter?: number
  leadChars?: number
}) {
  if (!query?.trim()) return text

  return highlightDescription(text, query, { windowAfter, leadChars }).map((segment, index) =>
    segment.match ? (
      <mark
        key={index}
        className="rounded-xs bg-redline/15 font-medium text-foreground dark:bg-redline/20"
      >
        {segment.text}
      </mark>
    ) : (
      <Fragment key={index}>{segment.text}</Fragment>
    ),
  )
}
