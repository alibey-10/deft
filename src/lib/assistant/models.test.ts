import { describe, expect, it } from 'vite-plus/test'

import {
  DEFAULT_MODEL,
  MODEL_ID_PATTERN,
  MODEL_PRESETS,
  isPresetModel,
  modelLabel,
} from './models.ts'

describe('assistant models', () => {
  it('keeps the default model as a preset', () => {
    expect(isPresetModel(DEFAULT_MODEL)).toBe(true)
    expect(MODEL_ID_PATTERN.test(DEFAULT_MODEL)).toBe(true)
    expect(MODEL_PRESETS.find((m) => m.id === DEFAULT_MODEL)).toMatchObject({
      id: DEFAULT_MODEL,
      label: 'DeepSeek V4.1 Flash',
      description: 'DeepSeek',
    })
  })

  it('offers Qwen3.8 Flash in place of the removed GPT preset', () => {
    expect(isPresetModel('qwen/qwen3.8-flash')).toBe(true)
    expect(modelLabel('qwen/qwen3.8-flash')).toBe('Qwen3.8 Flash')
    expect(MODEL_ID_PATTERN.test('qwen/qwen3.8-flash')).toBe(true)
    expect(MODEL_PRESETS.find((m) => m.id === 'qwen/qwen3.8-flash')).toMatchObject({
      id: 'qwen/qwen3.8-flash',
      label: 'Qwen3.8 Flash',
      description: 'Alibaba',
    })

    expect(isPresetModel('openai/gpt-6.1-terra')).toBe(false)
  })
})
