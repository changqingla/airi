import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { normalizeAlibabaCloudVoiceCompatibleModels, useProvidersStore } from './providers'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

function createLocalStorageMock() {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key) ?? null : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

describe('providers store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createLocalStorageMock(),
    })
  })

  it('includes qwen realtime models in the alibaba cloud model studio provider', async () => {
    const store = useProvidersStore()
    const provider = store.getProviderMetadata('alibaba-cloud-model-studio')
    const models = await provider.capabilities.listModels?.({})

    expect(models?.some(model => model.id === 'qwen3-tts-instruct-flash-realtime')).toBe(true)
    expect(models?.some(model => model.id === 'qwen3-tts-flash-realtime-2025-09-18')).toBe(true)
  })

  it('defaults alibaba cloud legacy voices to cosyvoice-compatible models', () => {
    expect(normalizeAlibabaCloudVoiceCompatibleModels()).toEqual(['cosyvoice-v1', 'cosyvoice-v2'])
    expect(normalizeAlibabaCloudVoiceCompatibleModels(['qwen3-tts-instruct-flash-realtime'])).toEqual(['qwen3-tts-instruct-flash-realtime'])
  })
})
