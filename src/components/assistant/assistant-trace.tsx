import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AiBrain01Icon,
  Alert02Icon,
  BookOpen01Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'

import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '#/components/ui/trace.tsx'
import { SkillAvatar } from '#/components/assistant/skill-avatar.tsx'
import type { GetSkillOutput, SearchSkillsOutput } from '#/lib/assistant/tools.ts'

import {
  safeParse,
  type ActivityStep,
  type ThinkingPart,
  type ToolCallPart,
} from '#/lib/assistant/blocks.ts'

/** A run of activity rows between two pieces of answer text. */
export function AssistantTrace({ steps }: { steps: ActivityStep[] }) {
  return (
    <Trace>
      {steps.map((step) => {
        if (step.kind === 'pending') return <PendingRow key={step.key} />
        if (step.kind === 'thinking') {
          return <ThinkingRow key={step.key} part={step.part} running={step.running} />
        }
        return (
          <ToolRow key={step.key} part={step.part} output={step.output} running={step.running} />
        )
      })}
    </Trace>
  )
}

function PendingRow() {
  return (
    <TraceLine status="running">
      <TraceIcon>
        <HugeiconsIcon icon={AiBrain01Icon} />
      </TraceIcon>
      <TraceTitle>Thinking</TraceTitle>
    </TraceLine>
  )
}

function ThinkingRow({ part, running }: { part: ThinkingPart; running: boolean }) {
  // Open while the model thinks so the chain of thought streams in, then fold away.
  const [open, setOpen] = useState(running)
  const [wasRunning, setWasRunning] = useState(running)
  if (wasRunning !== running) {
    setWasRunning(running)
    setOpen(running)
  }

  const text = part.content.trim()
  const line = (
    <TraceLine status={running ? 'running' : undefined}>
      <TraceIcon>
        <HugeiconsIcon icon={AiBrain01Icon} />
      </TraceIcon>
      <TraceTitle>{running ? 'Thinking' : 'Thought'}</TraceTitle>
    </TraceLine>
  )
  if (!text) return line

  return (
    <TraceCollapsible open={open} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="max-h-56 overflow-y-auto whitespace-pre-wrap">
        {text}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}

const quoted = (text: string | undefined) => (text ? `“${text}”` : '')

function ToolRow({
  part,
  output,
  running,
}: {
  part: ToolCallPart
  output: unknown
  running: boolean
}) {
  const input = (part.input ?? safeParse(part.arguments)) as Record<string, unknown> | undefined
  const failed = part.state === 'error'
  const status = failed ? 'error' : running ? 'running' : undefined

  if (part.name === 'search_skills') {
    const query = typeof input?.query === 'string' ? input.query : undefined
    const results = (output as SearchSkillsOutput | undefined)?.results
    const title = failed
      ? `Failed to search ${quoted(query)}`
      : running
        ? `Searching skills for ${quoted(query)}`
        : `Searched ${quoted(query)}`
    const line = (
      <TraceLine status={status}>
        <TraceIcon>
          <HugeiconsIcon icon={failed ? Alert02Icon : Search01Icon} />
        </TraceIcon>
        <TraceTitle>{title}</TraceTitle>
        {results && (
          <TraceDescription>
            {results.length === 1 ? '1 result' : `${results.length} results`}
          </TraceDescription>
        )}
      </TraceLine>
    )
    if (!results?.length) return line
    return (
      <TraceCollapsible>
        <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Trace>
            {results.map((skill) => (
              <Link key={skill.pathSlug} to="/skills/$" params={{ _splat: skill.pathSlug }}>
                <TraceLine>
                  <TraceIcon>
                    <SkillAvatar
                      pathSlug={skill.pathSlug}
                      fallback={<HugeiconsIcon icon={BookOpen01Icon} />}
                    />
                  </TraceIcon>
                  <TraceTitle>{skill.name}</TraceTitle>
                  <TraceDescription>{skill.author}</TraceDescription>
                </TraceLine>
              </Link>
            ))}
          </Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    )
  }

  if (part.name === 'get_skill') {
    const pathSlug = typeof input?.pathSlug === 'string' ? input.pathSlug : undefined
    const result = output as GetSkillOutput | undefined
    const name = result?.name ?? pathSlug?.split('/').pop() ?? 'skill'
    const missing = result && !result.found
    const line = (
      <TraceLine status={missing ? 'error' : status}>
        <TraceIcon>
          {failed || missing || !pathSlug ? (
            <HugeiconsIcon icon={failed || missing ? Alert02Icon : BookOpen01Icon} />
          ) : (
            <SkillAvatar pathSlug={pathSlug} fallback={<HugeiconsIcon icon={BookOpen01Icon} />} />
          )}
        </TraceIcon>
        <TraceTitle>
          {failed || missing
            ? `Couldn't read ${name}`
            : running
              ? `Reading ${name}`
              : `Read ${name}`}
        </TraceTitle>
      </TraceLine>
    )
    if (!result?.found || !pathSlug) return line
    return (
      <Link to="/skills/$" params={{ _splat: pathSlug }}>
        {line}
      </Link>
    )
  }

  return (
    <TraceLine status={status}>
      <TraceIcon>
        <HugeiconsIcon icon={failed ? Alert02Icon : Search01Icon} />
      </TraceIcon>
      <TraceTitle>{running ? `Running ${part.name}` : `Ran ${part.name}`}</TraceTitle>
    </TraceLine>
  )
}

/** "1m 9s", "42s": how long a reply took. */
export function formatDuration(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`
}

/** A finished reply's work (thinking, tool calls, notes along the way) folded behind one toggle. */
export function AssistantWork({
  duration,
  children,
}: {
  duration?: number
  children: React.ReactNode
}) {
  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine>
          <TraceTitle>
            {duration === undefined ? 'Worked' : `Worked for ${formatDuration(duration)}`}
          </TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <div className="flex flex-col gap-4">{children}</div>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}
