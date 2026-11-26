/**
 * Models the assistant can run on, all through OpenRouter. Anyone can pick a preset; admins can
 * also type any OpenRouter model id (see `src/routes/api/chat.ts`).
 */

export const DEFAULT_MODEL = 'deepseek/deepseek-v4.1-flash-1017'

export type ModelPreset = { id: string; label: string; description: string }

export const MODEL_PRESETS: ModelPreset[] = [
  { id: DEFAULT_MODEL, label: 'DeepSeek V4.1 Flash', description: 'DeepSeek' },
  { id: 'qwen/qwen3.8-flash', label: 'Qwen3.8 Flash', description: 'Alibaba' },
  { id: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6', description: 'Moonshot AI' },
]

/** `provider/model`, optionally with an OpenRouter `:variant` suffix. */
export const MODEL_ID_PATTERN = /^[a-z0-9][\w.-]*\/[\w.-]+(?::[\w-]+)?$/i

export const isPresetModel = (id: string) => MODEL_PRESETS.some((m) => m.id === id)

export const modelLabel = (id: string) => MODEL_PRESETS.find((m) => m.id === id)?.label ?? id
