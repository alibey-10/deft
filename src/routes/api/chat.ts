import { createFileRoute } from '@tanstack/react-router'
import {
  chat,
  chatParamsFromRequest,
  maxIterations,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { createOpenRouterText } from '@tanstack/ai-openrouter'

import { topics } from '#/data/topics.ts'
import { isAdminRequest } from '#/lib/admin.server.ts'
import { DEFAULT_MODEL, isPresetModel, MODEL_ID_PATTERN } from '#/lib/assistant/models.ts'
import { assistantTools } from '#/lib/assistant/tools.server.ts'

/**
 * The model is chosen at runtime, often one newer than the adapter's bundled catalog. Type the
 * adapter as a model the catalog knows supports tools and reasoning; OpenRouter ignores
 * `reasoning` for a model without it.
 */
type AnyReasoningModel = 'deepseek/deepseek-v4.1-flash'

/** Keeps one conversation from growing without bound (it is resent on every turn). */
const MAX_MESSAGES = 40

const systemPrompt = `You are Deft's assistant. Deft is a directory of UI skills for coding agents: SKILL.md files that teach an agent about design, accessibility, motion, components and other UI work.

Answer questions about which skills exist, which to pick for a task, and what a skill covers.

- Always call search_skills before recommending or naming a skill. Never invent skills, authors or links.
- If the first search is thin, search again with different keywords (synonyms, a framework name, a topic).
- Call get_skill when the user asks what a specific skill contains or how to use it.
- Link every skill you mention with a Markdown link to its url, e.g. [Web Design Guidelines](/skills/vercel-labs/web-design-guidelines).
- Be concise. Prefer a short list of the best 2-5 matches with one line on why each fits.
- If nothing in the directory fits, say so plainly.

Topics in the directory: ${topics.map((t) => `${t.slug} (${t.label})`).join(', ')}.`

const json = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.OPENROUTER_API_KEY
        if (!apiKey) return json(500, 'The assistant is not configured (OPENROUTER_API_KEY).')

        const { messages, threadId, runId, forwardedProps } = await chatParamsFromRequest(request)
        if (messages.length > MAX_MESSAGES) {
          return json(413, 'This conversation is too long. Start a new chat to keep going.')
        }

        // Anyone may pick a preset; only admins may run any other model.
        const requested = typeof forwardedProps.model === 'string' ? forwardedProps.model : ''
        let model: string = DEFAULT_MODEL
        if (requested) {
          if (!isPresetModel(requested)) {
            if (!(await isAdminRequest())) return json(403, 'Only admins can use other models.')
            if (!MODEL_ID_PATTERN.test(requested)) return json(400, 'Invalid model id.')
          }
          model = requested
        }

        const abortController = new AbortController()
        request.signal.addEventListener('abort', () => abortController.abort())

        const stream = chat({
          adapter: createOpenRouterText(model as AnyReasoningModel, apiKey),
          messages,
          threadId,
          runId,
          systemPrompts: [systemPrompt],
          tools: assistantTools,
          reasoning: 'low',
          agentLoopStrategy: maxIterations(8),
          abortController,
        })

        return toServerSentEventsResponse(stream, { abortController })
      },
    },
  },
})
