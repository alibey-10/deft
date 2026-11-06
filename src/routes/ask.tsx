import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { fetchServerSentEvents, useChat, type UIMessage } from '@tanstack/ai-react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  ArrowUp02Icon,
  PencilEdit02Icon,
  SparklesIcon,
  StopIcon,
} from '@hugeicons/core-free-icons'

import { AssistantMarkdown } from '#/components/assistant/assistant-markdown.tsx'
import { AssistantTrace } from '#/components/assistant/assistant-trace.tsx'
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
import { Message, MessageContent } from '#/components/ui/message.tsx'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '#/components/ui/message-scroller.tsx'
import { getIsAdminServerFn } from '#/lib/admin.ts'
import { toBlocks } from '#/lib/assistant/blocks.ts'
import { DEFAULT_MODEL, isPresetModel, MODEL_ID_PATTERN } from '#/lib/assistant/models.ts'

export const Route = createFileRoute('/ask')({
  loader: async () => ({ isAdmin: await getIsAdminServerFn() }),
  head: () => ({
    meta: [
      { title: 'Ask · Skilly' },
      { name: 'description', content: 'Ask an AI assistant which UI skills fit your task.' },
    ],
  }),
  component: AskPage,
})

const suggestions = [
  'Which skills help with accessibility audits?',
  'I want smoother animations in my React app',
  'What skills cover design systems and tokens?',
  'Compare skills for building with shadcn/ui',
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

function AskPage() {
  const { isAdmin } = Route.useLoaderData()
  const [model, setModel] = useModel(isAdmin)
  const [threadId, setThreadId] = useState(() => crypto.randomUUID())
  // The SSE adapter only reports "HTTP error! status: …", so keep the route's own message.
  const [serverError, setServerError] = useState<string>()

  const { messages, sendMessage, isLoading, error, stop, reload, clear } = useChat({
    connection: fetchServerSentEvents('/api/chat', {
      fetchClient: async (input, init) => {
        setServerError(undefined)
        const response = await fetch(input, init)
        if (!response.ok) setServerError(await readErrorMessage(response))
        return response
      },
    }),
    threadId,
    // The server ignores anything but the default model unless the admin cookie is valid.
    forwardedProps: { model },
  })

  const newChat = () => {
    stop()
    clear()
    setThreadId(crypto.randomUUID())
  }

  const lastMessage = messages.at(-1)
  // The reply hasn't produced a message yet: show the waiting state in its place.
  const awaitingReply = isLoading && lastMessage?.role !== 'assistant'

  return (
    <div className="flex h-[calc(100svh-3.5rem-5rem)] min-h-96 flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ask Skilly</h1>
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

      {messages.length === 0 ? (
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
              <Button key={text} variant="outline" size="sm" onClick={() => sendMessage(text)}>
                {text}
              </Button>
            ))}
          </EmptyContent>
        </Empty>
      ) : (
        <MessageScrollerProvider autoScroll>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport>
              <MessageScrollerContent>
                {messages.map((message) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === 'user'}
                  >
                    <ChatMessage
                      message={message}
                      live={isLoading && message.id === lastMessage?.id}
                    />
                  </MessageScrollerItem>
                ))}
                {awaitingReply && (
                  <MessageScrollerItem messageId="pending-reply">
                    <ChatMessage live />
                  </MessageScrollerItem>
                )}
                {error && !isLoading && (
                  <MessageScrollerItem messageId="error">
                    <Alert variant="destructive">
                      <HugeiconsIcon icon={Alert02Icon} />
                      <AlertTitle>The assistant couldn't answer</AlertTitle>
                      <AlertDescription>{serverError ?? error.message}</AlertDescription>
                      <AlertAction>
                        <Button variant="outline" size="xs" onClick={() => reload()}>
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
        onSubmit={(text) => sendMessage(text)}
        onStop={stop}
        footer={<ModelPicker value={model} onValueChange={setModel} isAdmin={isAdmin} />}
      />
    </div>
  )
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

/** One turn. With no `message`, the assistant's reply before anything has streamed. */
function ChatMessage({ message, live }: { message?: UIMessage; live: boolean }) {
  if (message?.role === 'user') {
    const text = message.parts.flatMap((p) => (p.type === 'text' ? [p.content] : [])).join('\n')
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end" variant="secondary">
            <BubbleContent className="whitespace-pre-wrap">{text}</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    )
  }

  return (
    <Message align="start">
      <MessageContent>
        {toBlocks(message, live).map((block) =>
          block.kind === 'trace' ? (
            <AssistantTrace key={block.key} steps={block.steps} />
          ) : (
            <AssistantMarkdown key={block.key} text={block.text} streaming={block.streaming} />
          ),
        )}
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
