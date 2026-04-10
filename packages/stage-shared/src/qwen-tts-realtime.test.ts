import { describe, expect, it } from 'vitest'

import {
  buildQwenTtsRealtimeServerUrl,
  createQwenTtsRealtimeAppendTextEvent,
  createQwenTtsRealtimeCommitEvent,
  createQwenTtsRealtimeFinishEvent,
  createQwenTtsRealtimeSessionUpdateEvent,
  decodeBase64ToUint8Array,
  formatQwenTtsRealtimeModelLabel,
  formatQwenTtsRealtimeVoiceCompatibilityDescription,
  normalizeQwenTtsRealtimeLanguageType,
  QWEN_TTS_REALTIME_DEFAULT_MODEL,
  QWEN_TTS_REALTIME_DEFAULT_VOICE,
  QWEN_TTS_REALTIME_LANGUAGE_TYPES,
  QWEN_TTS_REALTIME_SAMPLE_RATE,
  QWEN_TTS_REALTIME_VOICES,
} from './qwen-tts-realtime'

describe('qwen tts realtime helpers', () => {
  it('builds the server websocket url', () => {
    const url = buildQwenTtsRealtimeServerUrl('https://api.airi.build', 'token-123')

    expect(url.toString()).toBe('https://api.airi.build/ws/qwen-tts-realtime?token=token-123')
  })

  it('creates a session update payload', () => {
    const event = createQwenTtsRealtimeSessionUpdateEvent({
      model: QWEN_TTS_REALTIME_DEFAULT_MODEL,
      voice: QWEN_TTS_REALTIME_DEFAULT_VOICE,
      region: 'cn',
      mode: 'server_commit',
      instructions: 'Speak gently.',
      optimizeInstructions: true,
      languageType: 'Chinese',
    })

    expect(event).toEqual(
      expect.objectContaining({
        event_id: expect.stringMatching(/^event_/),
        type: 'session.update',
        session: {
          model: QWEN_TTS_REALTIME_DEFAULT_MODEL,
          voice: QWEN_TTS_REALTIME_DEFAULT_VOICE,
          mode: 'server_commit',
          response_format: 'pcm',
          sample_rate: QWEN_TTS_REALTIME_SAMPLE_RATE,
          language_type: 'Chinese',
          instructions: 'Speak gently.',
          optimize_instructions: true,
        },
      }),
    )
  })

  it('creates realtime client events with event ids', () => {
    expect(createQwenTtsRealtimeAppendTextEvent('hello')).toEqual(
      expect.objectContaining({
        event_id: expect.stringMatching(/^event_/),
        type: 'input_text_buffer.append',
        text: 'hello',
      }),
    )
    expect(createQwenTtsRealtimeCommitEvent()).toEqual(
      expect.objectContaining({
        event_id: expect.stringMatching(/^event_/),
        type: 'input_text_buffer.commit',
      }),
    )
    expect(createQwenTtsRealtimeFinishEvent()).toEqual(
      expect.objectContaining({
        event_id: expect.stringMatching(/^event_/),
        type: 'session.finish',
      }),
    )
  })

  it('decodes base64 audio bytes', () => {
    const bytes = decodeBase64ToUint8Array('AQID')

    expect(Array.from(bytes)).toEqual([1, 2, 3])
  })

  it('keeps the realtime sample rate stable', () => {
    expect(QWEN_TTS_REALTIME_SAMPLE_RATE).toBe(24000)
  })

  it('includes the official language hint whitelist', () => {
    expect(QWEN_TTS_REALTIME_LANGUAGE_TYPES).toContain('Auto')
    expect(QWEN_TTS_REALTIME_LANGUAGE_TYPES).toContain('Chinese')
    expect(QWEN_TTS_REALTIME_LANGUAGE_TYPES).toContain('English')
  })

  it('falls back to Auto for unsupported language hints', () => {
    expect(normalizeQwenTtsRealtimeLanguageType('Mandarin')).toBe('Auto')
  })

  it('keeps flash snapshot voice compatibility aligned with docs', () => {
    const cherry = QWEN_TTS_REALTIME_VOICES.find(voice => voice.id === 'Cherry')
    const serena = QWEN_TTS_REALTIME_VOICES.find(voice => voice.id === 'Serena')
    const aiden = QWEN_TTS_REALTIME_VOICES.find(voice => voice.id === 'Aiden')
    const jennifer = QWEN_TTS_REALTIME_VOICES.find(voice => voice.id === 'Jennifer')

    expect(cherry?.compatibleModels).toContain('qwen3-tts-instruct-flash-realtime')
    expect(serena?.compatibleModels).toContain('qwen3-tts-instruct-flash-realtime')
    expect(aiden?.compatibleModels).not.toContain('qwen3-tts-instruct-flash-realtime')
    expect(jennifer?.compatibleModels).not.toContain('qwen3-tts-instruct-flash-realtime')
    expect(cherry?.compatibleModels).toContain('qwen3-tts-flash-realtime-2025-09-18')
    expect(serena?.compatibleModels).not.toContain('qwen3-tts-flash-realtime-2025-09-18')
    expect(aiden?.compatibleModels).not.toContain('qwen3-tts-flash-realtime-2025-09-18')
  })

  it('formats model and voice compatibility labels for the UI', () => {
    const cherry = QWEN_TTS_REALTIME_VOICES.find(voice => voice.id === 'Cherry')

    expect(formatQwenTtsRealtimeModelLabel('qwen3-tts-flash-realtime-2025-09-18'))
      .toBe('Qwen 3 TTS Flash Realtime (2025-09-18)')
    expect(formatQwenTtsRealtimeModelLabel('qwen3-tts-instruct-flash-realtime'))
      .toBe('Qwen 3 TTS Instruct Flash Realtime')
    expect(cherry).toBeDefined()
    expect(formatQwenTtsRealtimeVoiceCompatibilityDescription(cherry!))
      .toContain('Qwen 3 TTS Flash Realtime (2025-09-18)')
  })
})
