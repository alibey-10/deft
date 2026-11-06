import type { UIMessage } from '@tanstack/ai-react'

export type Part = UIMessage['parts'][number]
export type ToolCallPart = Extract<Part, { type: 'tool-call' }>
export type ThinkingPart = Extract<Part, { type: 'thinking' }>

/** One row of assistant activity. */
export type ActivityStep =
  | { kind: 'thinking'; key: string; part: ThinkingPart; running: boolean }
  | { kind: 'tool'; key: string; part: ToolCallPart; output: unknown; running: boolean }
  /** Placeholder while the model works with nothing to show yet. */
  | { kind: 'pending'; key: string }

export function safeParse(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return undefined
  }
}

/** Tool output from the call itself, or from its matching result part. */
function toolOutput(part: ToolCallPart, parts: Part[]): unknown {
  if (part.output !== undefined) return part.output
  const result = parts.find((p) => p.type === 'tool-result' && p.toolCallId === part.id)
  if (result?.type !== 'tool-result' || result.state !== 'complete') return undefined
  return typeof result.content === 'string' ? safeParse(result.content) : undefined
}

export type MessageBlock =
  | { kind: 'trace'; key: string; steps: ActivityStep[] }
  | { kind: 'text'; key: string; text: string; streaming: boolean }

/**
 * Splits an assistant message into answer text and runs of activity, one `Trace` per run.
 * While `live`, the newest step shows as running and a "Thinking" row fills any gap.
 */
export function toBlocks(message: UIMessage | undefined, live: boolean): MessageBlock[] {
  const parts = message?.parts ?? []
  const blocks: MessageBlock[] = []
  let run: ActivityStep[] = []
  const flush = () => {
    if (run.length) blocks.push({ kind: 'trace', key: run[0].key, steps: run })
    run = []
  }

  // Index of the last part that renders something, to decide what is still in progress.
  const visible = parts.flatMap((p, i) =>
    (p.type === 'text' && p.content.trim()) || p.type === 'thinking' || p.type === 'tool-call'
      ? [i]
      : [],
  )
  const lastIndex = visible.at(-1) ?? -1

  parts.forEach((part, i) => {
    const isLast = live && i === lastIndex
    if (part.type === 'text') {
      if (!part.content.trim()) return
      flush()
      blocks.push({ kind: 'text', key: `text-${i}`, text: part.content, streaming: isLast })
    } else if (part.type === 'thinking') {
      run.push({ kind: 'thinking', key: `thinking-${i}`, part, running: isLast })
    } else if (part.type === 'tool-call') {
      const output = toolOutput(part, parts)
      const done = output !== undefined || part.state === 'error'
      run.push({ kind: 'tool', key: part.id, part, output, running: live && !done })
    }
  })

  // Something is still coming but the last visible step is finished: show that work goes on.
  const tail = run.at(-1)
  const idle = live && (tail ? tail.kind === 'tool' && !tail.running : blocks.length === 0)
  if (idle) run.push({ kind: 'pending', key: `pending-${parts.length}` })
  flush()
  return blocks
}
