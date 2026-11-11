/**
 * The UI-skill classifier's model call, shared by skills.sh discovery and submissions. No Convex
 * functions here, so both the Node and default runtimes can import it. Needs OPENROUTER_API_KEY.
 */
import { describe } from './github'
import {
  CLASSIFIER_MODEL,
  CLASSIFIER_SCHEMA,
  CLASSIFIER_SYSTEM,
  classifierUserMessage,
  parseVerdicts,
  type ClassifyInput,
  type Verdict,
} from './skillDiscoveryRules'

const OPENROUTER_CHAT = 'https://openrouter.ai/api/v1/chat/completions'

/** One model request for a batch of skills. Throws on HTTP or shape errors so the caller can retry. */
export async function classify(
  items: ClassifyInput[],
  apiKey: string,
): Promise<Map<string, Verdict>> {
  const response = await fetch(OPENROUTER_CHAT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Deft skill discovery',
    },
    body: JSON.stringify({
      model: CLASSIFIER_MODEL,
      temperature: 0,
      reasoning: { enabled: false },
      messages: [
        { role: 'system', content: CLASSIFIER_SYSTEM },
        { role: 'user', content: classifierUserMessage(items) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'skill_verdicts', strict: true, schema: CLASSIFIER_SCHEMA },
      },
      // Only route to providers that honour the schema.
      provider: { require_parameters: true },
    }),
  })
  if (!response.ok) throw new Error(`OpenRouter: ${await describe(response)}`)
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new Error(`OpenRouter: ${body.error?.message ?? 'empty answer'}`)
  const verdicts = parseVerdicts(
    content,
    items.map((i) => i.id),
  )
  if (!verdicts.size) throw new Error('OpenRouter: answer had no usable verdicts')
  return verdicts
}
