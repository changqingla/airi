import { describe, expect, it } from 'vitest'

import { resolveCompatibleVoiceId, toSignedPercent } from './speech'

describe('speech store helpers', () => {
  it('formats positive percentages with a plus sign', () => {
    expect(toSignedPercent(25)).toBe('+25%')
  })

  it('formats negative percentages without a double minus', () => {
    expect(toSignedPercent(-20)).toBe('-20%')
    expect(toSignedPercent(-20)).not.toContain('--')
  })

  it('formats zero as 0%', () => {
    expect(toSignedPercent(0)).toBe('0%')
  })

  it('resolves a compatible voice when the selected model changes', () => {
    const voices = [
      {
        id: 'Cherry',
        name: '芊悦',
        provider: 'alibaba-cloud-model-studio',
        compatibleModels: ['qwen3-tts-instruct-flash-realtime'],
        languages: [{ code: 'zh', title: 'Chinese' }],
      },
      {
        id: 'CosyVoice',
        name: 'CosyVoice',
        provider: 'alibaba-cloud-model-studio',
        compatibleModels: ['cosyvoice-v1'],
        languages: [{ code: 'zh', title: 'Chinese' }],
      },
    ]

    expect(resolveCompatibleVoiceId(voices, 'cosyvoice-v1', 'Cherry')).toBe('CosyVoice')
    expect(resolveCompatibleVoiceId(voices, 'qwen3-tts-instruct-flash-realtime', 'Cherry')).toBe('Cherry')
  })

  it('falls back to a compatible voice when no voice is selected yet', () => {
    const voices = [
      {
        id: 'CosyVoice',
        name: 'CosyVoice',
        provider: 'alibaba-cloud-model-studio',
        compatibleModels: ['cosyvoice-v1'],
        languages: [{ code: 'zh', title: 'Chinese' }],
      },
      {
        id: 'Cherry',
        name: '芊悦',
        provider: 'alibaba-cloud-model-studio',
        compatibleModels: ['qwen3-tts-instruct-flash-realtime'],
        languages: [{ code: 'zh', title: 'Chinese' }],
      },
    ]

    expect(resolveCompatibleVoiceId(voices, 'qwen3-tts-instruct-flash-realtime', '')).toBe('Cherry')
    expect(resolveCompatibleVoiceId(voices, 'cosyvoice-v1', '')).toBe('CosyVoice')
  })
})
