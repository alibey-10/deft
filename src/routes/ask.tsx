import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  fetchServerSentEvents,
  localStoragePersistence,
  useChat,
  type ChatClientPersistence,
  type UIMessage,
} from '@tanstack/ai-react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  ArrowUp02Icon,
  Copy01Icon,
  PencilEdit02Icon,
  SparklesIcon,
  StopIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'

import {
  ConversationMinimap,
  toPlainText,
  type MinimapTurn,
} from '#/components/assistant/conversation-minimap.tsx'
import { AssistantMarkdown } from '#/components/assistant/assistant-markdown.tsx'
import { AssistantTrace, AssistantWork } from '#/components/assistant/assistant-trace.tsx'
import { ModelPicker } from '#/components/assistant/model-picker.tsx'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '#/components/ui/alert.tsx'
import { Bubble, BubbleContent } from '#/components/ui/bubble.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty.tsx'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '#/components/ui/input-group.tsx'
import { Message, MessageContent, MessageFooter } from '#/components/ui/message.tsx'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '#/components/ui/message-scroller.tsx'
import { useCopyToClipboard } from '#/hooks/use-copy-to-clipboard.ts'
import { getIsAdminServerFn } from '#/lib/admin.ts'
import { toBlocks, type MessageBlock } from '#/lib/assistant/blocks.ts'
import { DEFAULT_MODEL, isPresetModel, MODEL_ID_PATTERN } from '#/lib/assistant/models.ts'

export const Route = createFileRoute('/ask')({
  loader: async () => ({ isAdmin: await getIsAdminServerFn() }),
  head: () => ({
    meta: [
      { title: 'Ask · Deft' },
      { name: 'description', content: 'Ask an AI assistant which UI skills fit your task.' },
    ],
  }),
  component: AskPage,
})

const suggestions = [
  'What skills matter most for building beautiful landing pages?',
  'Add micro-animations only where they serve a purpose',
  'Help me build UI components using composition patterns',
  'What skills matter most for tasteful UI design?',
]

const MODEL_STORAGE_KEY = 'skilly-assistant-model'

/** The admin's chosen model, remembered in this browser. */
function useModel(isAdmin: boolean) {
  const [model, setModel] = useState(DEFAULT_MODEL as string)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY)
      if (saved && MODEL_ID_PATTERN.test(saved)) setModel(saved)
    } catch {
      // Storage unavailable (private mode, blocked site data): keep the default.
    }
  }, [])
  const update = (next: string) => {
    setModel(next)
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, next)
    } catch {
      // Not remembered; still used for this session.
    }
  }
  // A custom id saved while signed in as admin falls back to the default once signed out.
  return [isAdmin || isPresetModel(model) ? model : DEFAULT_MODEL, update] as const
}

const CHAT_STORAGE_KEY = 'skilly-assistant-chat'

/**
 * Only one chat is kept in this browser: every thread reads and writes the same key, so a new
 * chat (whose `clear()` removes the stored one) overwrites the last. Only the transcript is
 * stored: a run cut off by a reload can't be rejoined over plain SSE, so no resume pointer.
 */
const chatStorage = localStoragePersistence({ keyPrefix: '' })
const chatPersistence: ChatClientPersistence = {
  getItem: () => chatStorage.getItem(CHAT_STORAGE_KEY),
  setItem: (_id, state) => chatStorage.setItem(CHAT_STORAGE_KEY, { messages: state.messages }),
  removeItem: () => chatStorage.removeItem(CHAT_STORAGE_KEY),
}

function AskPage() {
  const { isAdmin } = Route.useLoaderData()
  const [model, setModel] = useModel(isAdmin)
  const [threadId, setThreadId] = useState(() => crypto.randomUUID())
  // The SSE adapter only reports "HTTP error! status: …", so keep the route's own message.
  const [serverError, setServerError] = useState<string>()
  // How long each finished reply took, by its last message's id (kept for this session only).
  // Timed from the question, since one reply can span several requests (one per tool round).
  const [durations, setDurations] = useState<Record<string, number>>({})
  const turnStart = useRef(0)

  const { messages, sendMessage, isLoading, isHydrating, error, stop, reload, clear } = useChat({
    connection: fetchServerSentEvents('/api/chat', {
      fetchClient: async (input, init) => {
        setServerError(undefined)
        const response = await fetch(input, init)
        if (!response.ok) setServerError(await readErrorMessage(response))
        return response
      },
    }),
    threadId,
    persistence: chatPersistence,
    onFinish: (message) => {
      const elapsed = Date.now() - turnStart.current
      setDurations((current) => ({ ...current, [message.id]: elapsed }))
    },
    // The server ignores anything but the default model unless the admin cookie is valid.
    forwardedProps: { model },
  })

  const ask = (text: string) => {
    turnStart.current = Date.now()
    void sendMessage(text)
  }
  const retry = () => {
    turnStart.current = Date.now()
    void reload()
  }

  const newChat = () => {
    stop()
    clear()
    setThreadId(crypto.randomUUID())
  }

  const lastMessage = messages.at(-1)
  // The reply hasn't produced a message yet: show the waiting state in its place.
  const awaitingReply = isLoading && lastMessage?.role !== 'assistant'
  const groups = groupMessages(messages)
  const turns = toTurns(groups)

  return (
    <div className="flex h-[calc(100svh-3.5rem-5rem)] min-h-96 flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] [font-stretch:90%]">
            Ask Deft
          </h1>
          <p className="text-sm text-muted-foreground">
            Describe what you're building and get matching UI skills from the directory.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={newChat}>
            <HugeiconsIcon icon={PencilEdit02Icon} data-icon="inline-start" />
            New chat
          </Button>
        )}
      </div>

      {isHydrating ? (
        // Restoring the saved chat: hold the space rather than flash the empty state.
        <div className="flex-1" />
      ) : messages.length === 0 ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={SparklesIcon} />
            </EmptyMedia>
            <EmptyTitle>What are you working on?</EmptyTitle>
            <EmptyDescription>
              The assistant searches the skills directory, reads skills when it needs details, and
              links what fits.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row flex-wrap justify-center">
            {suggestions.map((text) => (
              <Button key={text} variant="outline" size="sm" onClick={() => ask(text)}>
                {text}
              </Button>
            ))}
          </EmptyContent>
        </Empty>
      ) : (
        // Follow the bottom only while a reply streams in: once it's done, opening or closing its
        // "Worked for" section must not yank the view to the end.
        <MessageScrollerProvider autoScroll={isLoading}>
          <MessageScroller className="flex-1">
            {turns.length > 1 && (
              <ConversationMinimap
                turns={turns}
                className="absolute inset-y-0 left-0 z-10 hidden md:flex"
              />
            )}
            <MessageScrollerViewport onClickCapture={releaseScrollOnToggle}>
              <MessageScrollerContent className={turns.length > 1 ? 'md:ml-12' : undefined}>
                {groups.map((group) =>
                  group.role === 'user' ? (
                    <MessageScrollerItem key={group.id} messageId={group.id} scrollAnchor>
                      <UserMessage message={group.messages[0]} />
                    </MessageScrollerItem>
                  ) : (
                    <MessageScrollerItem key={group.id} messageId={group.id}>
                      <AssistantReply
                        messages={group.messages}
                        live={isLoading && group.messages.at(-1)?.id === lastMessage?.id}
                        duration={durations[group.messages.at(-1)?.id ?? '']}
                      />
                    </MessageScrollerItem>
                  ),
                )}
                {awaitingReply && (
                  <MessageScrollerItem messageId="pending-reply">
                    <AssistantReply messages={[]} live />
                  </MessageScrollerItem>
                )}
                {error && !isLoading && (
                  <MessageScrollerItem messageId="error">
                    <Alert variant="destructive">
                      <HugeiconsIcon icon={Alert02Icon} />
                      <AlertTitle>The assistant couldn't answer</AlertTitle>
                      <AlertDescription>{serverError ?? error.message}</AlertDescription>
                      <AlertAction>
                        <Button variant="outline" size="xs" onClick={retry}>
                          Try again
                        </Button>
                      </AlertAction>
                    </Alert>
                  </MessageScrollerItem>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      )}

      <PromptForm
        isLoading={isLoading}
        onSubmit={ask}
        onStop={stop}
        footer={<ModelPicker value={model} onValueChange={setModel} isAdmin={isAdmin} />}
      />
    </div>
  )
}

function textOf(message: UIMessage) {
  return message.parts.flatMap((p) => (p.type === 'text' ? [p.content] : [])).join('\n')
}

/**
 * Opening or closing a collapsible step changes the conversation's height. The scroller treats
 * that like streamed content and snaps back to the bottom or to the latest question, hiding what
 * the reader just opened. It lets go only on wheel, touch or keyboard scrolling, so a click on a
 * toggle stands in for one (a zero-distance wheel event) before the toggle changes height.
 */
function releaseScrollOnToggle(event: React.MouseEvent<HTMLElement>) {
  if (!(event.target instanceof Element)) return
  if (!event.target.closest('[data-slot=trace-collapsible-trigger]')) return
  event.currentTarget.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
}

type MessageGroup = { id: string; role: 'user' | 'assistant'; messages: UIMessage[] }

/**
 * Each question on its own, and the assistant messages after it as one reply: a reply that
 * calls tools arrives as several messages, one per round.
 */
function groupMessages(messages: readonly UIMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue
    const last = groups.at(-1)
    if (message.role === 'assistant' && last?.role === 'assistant') last.messages.push(message)
    else groups.push({ id: message.id, role: message.role, messages: [message] })
  }
  return groups
}

/** One minimap entry per question, with the start of the reply that follows it. */
function toTurns(groups: MessageGroup[]): MinimapTurn[] {
  return groups.flatMap((group, index) => {
    if (group.role !== 'user') return []
    const reply = groups[index + 1]
    const answer =
      reply?.role === 'assistant'
        ? toPlainText(reply.messages.map(textOf).join('\n')).slice(0, 280)
        : ''
    return [{ id: group.id, question: textOf(group.messages[0]), answer: answer || undefined }]
  })
}

/** The `{ error }` message `/api/chat` sends with a failed response, if any. */
async function readErrorMessage(response: Response) {
  try {
    const body: unknown = await response.clone().json()
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      return body.error
    }
  } catch {
    // Not JSON (e.g. a proxy error page): fall back to the adapter's message.
  }
  return undefined
}

function UserMessage({ message }: { message: UIMessage }) {
  const text = textOf(message)
  const { copied, copy } = useCopyToClipboard()
  return (
    <Message align="end">
      <MessageContent>
        <Bubble align="end" variant="secondary">
          <BubbleContent className="whitespace-pre-wrap">{text}</BubbleContent>
        </Bubble>
        <MessageFooter reveal data-pinned={copied || undefined}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => copy(text)}
            aria-label={copied ? 'Message copied' : 'Copy message'}
          >
            <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} aria-hidden />
          </Button>
          <span className="sr-only" aria-live="polite">
            {copied ? 'Copied to clipboard' : ''}
          </span>
        </MessageFooter>
      </MessageContent>
    </Message>
  )
}

/**
 * The assistant's reply to one question, across all its messages. With none yet, the waiting
 * state. Once done, everything through its last activity folds behind one "Worked for" toggle,
 * leaving the answer.
 */
function AssistantReply({
  messages,
  live,
  duration,
}: {
  messages: UIMessage[]
  live: boolean
  duration?: number
}) {
  const blocks: MessageBlock[] = messages.length
    ? messages.flatMap((message, index) =>
        toBlocks(message, live && index === messages.length - 1).map((block) => ({
          ...block,
          key: `${message.id}-${block.key}`,
        })),
      )
    : toBlocks(undefined, live)
  const renderBlock = (block: MessageBlock) =>
    block.kind === 'trace' ? (
      <AssistantTrace key={block.key} steps={block.steps} />
    ) : (
      <AssistantMarkdown key={block.key} text={block.text} streaming={block.streaming} />
    )
  // Everything through the last activity block is "work"; the text after it is the answer.
  const lastTrace = blocks.map((block) => block.kind).lastIndexOf('trace')
  const workEnd = live ? 0 : lastTrace + 1

  return (
    <Message align="start">
      <MessageContent>
        {workEnd > 0 && (
          <AssistantWork duration={duration}>
            {blocks.slice(0, workEnd).map(renderBlock)}
          </AssistantWork>
        )}
        {blocks.slice(workEnd).map(renderBlock)}
      </MessageContent>
    </Message>
  )
}

function PromptForm({
  isLoading,
  onSubmit,
  onStop,
  footer,
}: {
  isLoading: boolean
  onSubmit: (text: string) => void
  onStop: () => void
  footer?: React.ReactNode
}) {
  const [input, setInput] = useState('')
  const text = input.trim()

  const submit = () => {
    if (!text || isLoading) return
    onSubmit(text)
    setInput('')
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <InputGroup>
        <InputGroupTextarea
          aria-label="Ask about UI skills"
          placeholder="Ask about UI skills…"
          value={input}
          rows={1}
          className="max-h-48"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              submit()
            }
          }}
        />
        <InputGroupAddon align="block-end" className="justify-between">
          <div className="flex items-center gap-1">{footer}</div>
          {isLoading ? (
            <InputGroupButton
              size="icon-sm"
              variant="default"
              aria-label="Stop generating"
              onClick={onStop}
            >
              <HugeiconsIcon icon={StopIcon} strokeWidth={2} />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="submit"
              size="icon-sm"
              variant="default"
              aria-label="Send"
              disabled={!text}
            >
              <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
