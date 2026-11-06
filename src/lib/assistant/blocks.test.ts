import { describe, expect, it } from 'vite-plus/test'
import type { UIMessage } from '@tanstack/ai-react'

import { toBlocks } from './blocks.ts'

const message = (parts: UIMessage['parts']): UIMessage => ({
  id: 'm1',
  role: 'assistant',
  parts,
})

const searchCall = (state: 'input-streaming' | 'input-complete' | 'complete', output?: unknown) =>
  ({
    type: 'tool-call',
    id: 'call-1',
    name: 'search_skills',
    arguments: '{"query":"motion"}',
    input: { query: 'motion' },
    state,
    output,
  }) as UIMessage['parts'][number]

const kinds = (blocks: ReturnType<typeof toBlocks>) =>
  blocks.map((b) => (b.kind === 'text' ? 'text' : b.steps.map((s) => s.kind).join('+')))

describe('toBlocks', () => {
  it('shows a pending "Thinking" row before anything streams', () => {
    expect(kinds(toBlocks(undefined, true))).toEqual(['pending'])
    expect(kinds(toBlocks(message([]), true))).toEqual(['pending'])
  })

  it('shows nothing extra once the reply is finished', () => {
    expect(toBlocks(message([]), false)).toEqual([])
  })

  it('groups thinking and tool calls into one trace before the answer', () => {
    const blocks = toBlocks(
      message([
        { type: 'thinking', content: 'Let me search.' },
        searchCall('complete', { results: [] }),
        { type: 'text', content: 'Here are some skills.' },
      ]),
      false,
    )
    expect(kinds(blocks)).toEqual(['thinking+tool', 'text'])
    const trace = blocks[0]
    expect(trace.kind === 'trace' && trace.steps.every((s) => s.kind !== 'pending')).toBe(true)
  })

  it('marks the streaming thinking step as running', () => {
    const [trace] = toBlocks(message([{ type: 'thinking', content: 'Hmm' }]), true)
    expect(trace.kind === 'trace' && trace.steps[0]).toMatchObject({
      kind: 'thinking',
      running: true,
    })
  })

  it('keeps a tool call running until its output arrives', () => {
    const [running] = toBlocks(message([searchCall('input-complete')]), true)
    expect(running.kind === 'trace' && running.steps[0]).toMatchObject({ running: true })
  })

  it('reads output from the matching tool-result part', () => {
    const [trace] = toBlocks(
      message([
        searchCall('input-complete'),
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          content: '{"results":[{"name":"Motion"}]}',
          state: 'complete',
        },
      ]),
      true,
    )
    expect(trace.kind === 'trace' && trace.steps[0]).toMatchObject({
      kind: 'tool',
      running: false,
      output: { results: [{ name: 'Motion' }] },
    })
    // The tool is done but the model hasn't answered yet.
    expect(kinds([trace])).toEqual(['tool+pending'])
  })

  it('marks only the last text block as streaming', () => {
    const blocks = toBlocks(
      message([
        { type: 'text', content: 'First.' },
        searchCall('complete', { results: [] }),
        { type: 'text', content: 'Second.' },
      ]),
      true,
    )
    expect(blocks.flatMap((b) => (b.kind === 'text' ? [b.streaming] : []))).toEqual([false, true])
  })
})
