<script setup lang="ts">
import type { QwenTtsRealtimeServerMessage } from '@proj-airi/stage-shared/qwen-tts-realtime'
import type { RemovableRef } from '@vueuse/core'

import {
  createQwenTtsRealtimeAppendTextEvent,
  createQwenTtsRealtimeCommitEvent,
  createQwenTtsRealtimeFinishEvent,
  createQwenTtsRealtimeInterruptEvent,
  createQwenTtsRealtimeProxyStartMessage,
  decodeBase64ToUint8Array,
  formatQwenTtsRealtimeModelLabel,
  formatQwenTtsRealtimeVoiceCompatibilityDescription,
  QWEN_TTS_REALTIME_DEFAULT_LANGUAGE_TYPE,
  QWEN_TTS_REALTIME_DEFAULT_MODEL,
  QWEN_TTS_REALTIME_DEFAULT_VOICE,
  QWEN_TTS_REALTIME_LANGUAGE_TYPES,
  QWEN_TTS_REALTIME_MODELS,
  QWEN_TTS_REALTIME_REGIONS,
  QWEN_TTS_REALTIME_VOICES,
} from '@proj-airi/stage-shared'
import {
  ProviderAdvancedSettings,
  ProviderApiKeyInput,
  ProviderBasicSettings,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
  ProviderValidationAlerts,
} from '@proj-airi/stage-ui/components'
import { useRealtimePcmPlayer } from '@proj-airi/stage-ui/composables/audio/realtime-pcm-player'
import { useProviderValidation } from '@proj-airi/stage-ui/composables/use-provider-validation'
import { createQwenTtsRealtimeTransport } from '@proj-airi/stage-ui/libs/providers/providers/qwen-tts-realtime'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { chunkTTSInput } from '@proj-airi/stage-ui/utils/tts'
import { FieldCheckbox, FieldCombobox } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'

const providerId = 'qwen-tts-realtime'
const router = useRouter()
const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore) as { providers: RemovableRef<Record<string, any>> }

const {
  t,
  providerMetadata,
  apiKey,
  isValidating,
  isValid,
  validationMessage,
  handleResetSettings,
  forceValid,
} = useProviderValidation(providerId)

const realtimePlayer = useRealtimePcmPlayer()
type QwenTtsRealtimeTransport = Awaited<ReturnType<typeof createQwenTtsRealtimeTransport>>

const transport = shallowRef<QwenTtsRealtimeTransport | null>(null)
const socketState = ref<'idle' | 'connecting' | 'connected' | 'streaming' | 'finished' | 'error'>('idle')
const sessionStatus = ref('Ready')
const logs = ref<Array<{ id: string, level: 'info' | 'error', text: string }>>([])
const logsContainer = ref<HTMLDivElement | null>(null)
const sampleText = ref('对吧~我就特别喜欢这种超市，尤其是过年的时候，去逛超市，就会觉得超级超级开心！想买好多好多的东西呢！')
const activeSessionGeneration = ref(0)

providersStore.initializeProvider(providerId)

const providerModels = computed(() => providersStore.getModelsForProvider(providerId))
const isLoadingModels = computed(() => providersStore.isLoadingModels[providerId] || false)

const model = computed({
  get: () => providers.value[providerId]?.model as string | undefined || QWEN_TTS_REALTIME_DEFAULT_MODEL,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].model = value
  },
})

const voice = computed({
  get: () => providers.value[providerId]?.voice as string | undefined || QWEN_TTS_REALTIME_DEFAULT_VOICE,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].voice = value
  },
})

const region = computed({
  get: () => providers.value[providerId]?.region as string | undefined || 'cn',
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].region = value
  },
})

const mode = computed({
  get: () => providers.value[providerId]?.mode as string | undefined || 'server_commit',
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].mode = value
  },
})

const languageType = computed({
  get: () => providers.value[providerId]?.languageType as string | undefined || QWEN_TTS_REALTIME_DEFAULT_LANGUAGE_TYPE,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].languageType = value
  },
})

const instructions = computed({
  get: () => providers.value[providerId]?.instructions as string | undefined || '',
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].instructions = value
  },
})

const optimizeInstructions = computed({
  get: () => providers.value[providerId]?.optimizeInstructions as boolean | undefined || false,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].optimizeInstructions = value
  },
})

const modelOptions = computed(() => {
  if (providerModels.value.length > 0) {
    return providerModels.value.map(model => ({
      label: model.name,
      value: model.id,
    }))
  }

  return QWEN_TTS_REALTIME_MODELS.map(model => ({
    label: formatQwenTtsRealtimeModelLabel(model),
    value: model,
  }))
})

const compatibleVoices = computed(() =>
  QWEN_TTS_REALTIME_VOICES.filter(voice => voice.compatibleModels.includes(model.value as typeof QWEN_TTS_REALTIME_MODELS[number])),
)

const voiceOptions = computed(() => compatibleVoices.value.map(voice => ({
  label: voice.name,
  value: voice.id,
  description: [
    voice.description,
    formatQwenTtsRealtimeVoiceCompatibilityDescription(voice),
  ].filter(Boolean).join(' · '),
})))

const selectedVoiceInfo = computed(() => compatibleVoices.value.find(candidate => candidate.id === voice.value))

const regionOptions = QWEN_TTS_REALTIME_REGIONS.map(region => ({
  label: region === 'cn' ? 'China Mainland' : 'International',
  value: region,
}))

const modeOptions = [
  { label: 'server_commit', value: 'server_commit' },
  { label: 'commit', value: 'commit' },
]

const languageTypeOptions = QWEN_TTS_REALTIME_LANGUAGE_TYPES.map(languageType => ({
  label: languageType,
  value: languageType,
}))

const isInstructModel = computed(() => model.value.includes('instruct'))
const canStream = computed(() => !!apiKey.value.trim() && !!model.value.trim() && !!voice.value.trim())
const bufferedMs = computed(() => Math.round(realtimePlayer.bufferedMs.value))
const firstAudioDelayMs = computed(() => realtimePlayer.firstAudioDelayMs.value == null ? '—' : `${Math.round(realtimePlayer.firstAudioDelayMs.value)} ms`)

function appendLog(level: 'info' | 'error', text: string) {
  logs.value.push({
    id: `${Date.now()}-${Math.random()}`,
    level,
    text,
  })

  nextTick(() => {
    if (logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight
    }
  })
}

function resetLogs() {
  logs.value = []
}

function ensureCompatibleVoice() {
  if (voiceOptions.value.some(option => option.value === voice.value)) {
    return
  }

  voice.value = compatibleVoices.value[0]?.id || QWEN_TTS_REALTIME_DEFAULT_VOICE
}

function invalidateTransportSession() {
  activeSessionGeneration.value += 1
}

function sendTransportMessage(message: unknown) {
  if (!transport.value) {
    appendLog('error', 'Transport is not open yet.')
    return
  }

  transport.value.send(message as Parameters<QwenTtsRealtimeTransport['send']>[0])
}

function closeTransport(reason: string) {
  transport.value?.close()
  transport.value = null
  appendLog('info', `Transport closed: ${reason}.`)
}

function handleTransportMessage(message: QwenTtsRealtimeServerMessage, generation: number) {
  if (generation !== activeSessionGeneration.value) {
    return
  }

  switch (message.type) {
    case 'proxy.ready':
      appendLog('info', 'Proxy ready.')
      break
    case 'proxy.upstream.open':
      {
        const payload = message.payload as Record<string, unknown> | undefined
        appendLog('info', `Upstream connected for ${String(payload?.model ?? model.value)}.`)
      }
      break
    case 'session.created':
      appendLog('info', 'Realtime session created.')
      break
    case 'session.updated':
      appendLog('info', 'Realtime session updated.')
      break
    case 'response.audio.delta':
      socketState.value = 'streaming'
      sessionStatus.value = 'Streaming audio'
      if (typeof message.delta === 'string') {
        void realtimePlayer.push(decodeBase64ToUint8Array(message.delta))
      }
      break
    case 'response.done':
      appendLog('info', 'Response done.')
      break
    case 'session.finished':
      socketState.value = 'finished'
      sessionStatus.value = 'Finished'
      appendLog('info', 'Session finished.')
      void realtimePlayer.stop()
      break
    case 'session.closed':
      appendLog('info', 'Session closed.')
      void realtimePlayer.stop()
      break
    case 'proxy.upstream.close':
      {
        const payload = message.payload as Record<string, unknown> | undefined
        appendLog('error', `Upstream closed: ${String(payload?.code ?? '')} ${String(payload?.reason ?? '')}`.trim())
      }
      break
    case 'proxy.error': {
      socketState.value = 'error'
      sessionStatus.value = 'Error'
      const payload = message.payload as Record<string, unknown> | undefined
      const proxyErrorDetail = [
        typeof payload?.message === 'string' ? payload.message : 'Unknown proxy error',
        typeof payload?.code === 'string' || typeof payload?.code === 'number' ? `code=${String(payload.code)}` : null,
        typeof payload?.statusCode === 'string' || typeof payload?.statusCode === 'number' ? `status=${String(payload.statusCode)}` : null,
        typeof payload?.reason === 'string' ? `reason=${String(payload.reason)}` : null,
        payload?.details && typeof payload.details === 'object' ? `details=${JSON.stringify(payload.details)}` : null,
      ].filter(Boolean).join(', ')
      appendLog('error', `Proxy error: ${proxyErrorDetail}`)
      void realtimePlayer.stop()
      break
    }
    default:
      if (message.type) {
        appendLog('info', `Event: ${message.type}`)
      }
      break
  }
}

async function consumeTransportMessages(currentTransport: QwenTtsRealtimeTransport, generation: number) {
  try {
    for await (const message of currentTransport.messages) {
      handleTransportMessage(message, generation)
    }
  }
  finally {
    if (generation === activeSessionGeneration.value && transport.value === currentTransport) {
      if (socketState.value !== 'finished' && socketState.value !== 'error') {
        socketState.value = 'idle'
        sessionStatus.value = 'Closed'
      }
      transport.value = null
    }
  }
}

async function openTransport() {
  if (transport.value) {
    return transport.value
  }

  if (!apiKey.value.trim()) {
    throw new Error('Missing DashScope API key.')
  }

  invalidateTransportSession()
  const generation = activeSessionGeneration.value

  socketState.value = 'connecting'
  sessionStatus.value = 'Connecting'

  const currentTransport = await createQwenTtsRealtimeTransport()

  try {
    await currentTransport.ready
  }
  catch (error) {
    currentTransport.close()
    throw error
  }

  if (generation !== activeSessionGeneration.value) {
    currentTransport.close()
    throw new Error('The current realtime session was replaced before it could finish connecting.')
  }

  transport.value = currentTransport
  appendLog('info', `Transport ready: ${currentTransport.kind} (${currentTransport.url})`)
  console.info('[qwen-tts-realtime] transport ready', {
    kind: currentTransport.kind,
    url: currentTransport.url,
    model: model.value,
    voice: voice.value,
    region: region.value,
    mode: mode.value,
  })

  socketState.value = 'connected'
  sessionStatus.value = 'Connected'
  appendLog('info', `Connected to realtime transport: ${currentTransport.url}`)
  void consumeTransportMessages(currentTransport, generation)

  currentTransport.send(createQwenTtsRealtimeProxyStartMessage({
    apiKey: apiKey.value.trim(),
    model: model.value,
    region: region.value as 'cn' | 'intl',
    session: {
      model: model.value,
      voice: voice.value,
      region: region.value as 'cn' | 'intl',
      mode: mode.value as 'server_commit' | 'commit',
      instructions: isInstructModel.value ? instructions.value : undefined,
      optimizeInstructions: optimizeInstructions.value,
      languageType: languageType.value,
    },
  }))

  return currentTransport
}

async function streamSample() {
  resetLogs()

  if (!canStream.value) {
    appendLog('error', 'API key, model, and voice are required.')
    return
  }

  try {
    await realtimePlayer.start()
    await openTransport()

    appendLog('info', 'Streaming sample text in small chunks...')

    for await (const chunk of chunkTTSInput(sampleText.value, { boost: 2, minimumWords: 4, maximumWords: 12 })) {
      if (!chunk.text.trim()) {
        continue
      }
      sendTransportMessage(createQwenTtsRealtimeAppendTextEvent(chunk.text))
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (mode.value === 'commit') {
      sendTransportMessage(createQwenTtsRealtimeCommitEvent())
    }

    sendTransportMessage(createQwenTtsRealtimeFinishEvent())
  }
  catch (error) {
    appendLog('error', error instanceof Error ? error.message : String(error))
    socketState.value = 'error'
    sessionStatus.value = 'Error'
    void realtimePlayer.stop()
  }
}

async function stopSession() {
  if (transport.value) {
    invalidateTransportSession()
    sendTransportMessage(createQwenTtsRealtimeFinishEvent())
    closeTransport('stop')
  }
  await realtimePlayer.stop()
  sessionStatus.value = 'Stopped'
  socketState.value = 'idle'
}

async function interruptSession() {
  if (transport.value) {
    invalidateTransportSession()
    sendTransportMessage(createQwenTtsRealtimeInterruptEvent())
    closeTransport('interrupt')
  }
  await realtimePlayer.stop()
  sessionStatus.value = 'Interrupted'
  socketState.value = 'idle'
}

function clearSession() {
  invalidateTransportSession()
  resetLogs()
  sessionStatus.value = 'Ready'
  socketState.value = 'idle'
  void realtimePlayer.stop()
  if (transport.value) {
    closeTransport('reset')
  }
}

onMounted(async () => {
  await providersStore.fetchModelsForProvider(providerId)
})

watch(model, async () => {
  await providersStore.fetchModelsForProvider(providerId)
  ensureCompatibleVoice()
})

watch(voiceOptions, () => {
  ensureCompatibleVoice()
}, { immediate: true })

onBeforeUnmount(() => {
  invalidateTransportSession()
  void realtimePlayer.stop()
  if (transport.value) {
    closeTransport('unmounted')
  }
})

const socketStateLabel = computed(() => {
  switch (socketState.value) {
    case 'connecting':
      return 'Connecting'
    case 'connected':
      return 'Connected'
    case 'streaming':
      return 'Streaming'
    case 'finished':
      return 'Finished'
    case 'error':
      return 'Error'
    default:
      return 'Idle'
  }
})
</script>

<template>
  <ProviderSettingsLayout
    :provider-name="providerMetadata?.localizedName"
    :provider-icon="providerMetadata?.icon"
    :provider-icon-color="providerMetadata?.iconColor"
    :on-back="() => router.back()"
  >
    <div class="grid gap-6 lg:grid-cols-[minmax(360px,1fr)_minmax(420px,1.15fr)]">
      <ProviderSettingsContainer class="space-y-6">
        <ProviderValidationAlerts
          :is-valid="isValid"
          :is-validating="isValidating"
          :validation-message="validationMessage"
          :has-manual-validators="false"
          :is-manual-testing="false"
          :manual-test-passed="false"
          manual-test-message=""
          :on-run-test="() => {}"
          :on-force-valid="forceValid"
          :on-go-to-model-selection="() => {}"
        />

        <ProviderBasicSettings
          :title="t('settings.pages.providers.common.section.basic.title')"
          :description="t('settings.pages.providers.common.section.basic.description')"
          :on-reset="handleResetSettings"
        >
          <ProviderApiKeyInput
            v-model="apiKey"
            :provider-name="providerMetadata?.localizedName"
            placeholder="DashScope API Key"
          />

          <FieldCombobox
            v-model="model"
            label="Model"
            description="Select the realtime TTS model."
            :options="modelOptions"
            :disabled="isLoadingModels || providerModels.length === 0"
            placeholder="Select a model..."
          />

          <FieldCombobox
            v-model="voice"
            label="Voice"
            description="Select the synthesis voice."
            :options="voiceOptions"
            placeholder="Select a voice..."
          />

          <div
            v-if="selectedVoiceInfo"
            class="border border-neutral-200 rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
          >
            <div class="text-neutral-700 font-medium dark:text-neutral-200">
              {{ selectedVoiceInfo.name }}
            </div>
            <div class="mt-1">
              {{ selectedVoiceInfo.description }}
            </div>
            <div class="mt-1 text-neutral-500 dark:text-neutral-400">
              {{ formatQwenTtsRealtimeVoiceCompatibilityDescription(selectedVoiceInfo) }}
            </div>
          </div>

          <FieldCombobox
            v-model="region"
            label="Region"
            description="Choose the DashScope region."
            :options="regionOptions"
            placeholder="Select a region..."
          />

          <FieldCombobox
            v-model="mode"
            label="Mode"
            description="server_commit matches the SDK example and works best for realtime playback."
            :options="modeOptions"
            placeholder="Select a mode..."
          />

          <FieldCombobox
            v-model="languageType"
            label="Language Type"
            description="Pass the synthesis language hint to DashScope."
            :options="languageTypeOptions"
            placeholder="Select a language type..."
          />
        </ProviderBasicSettings>

        <ProviderAdvancedSettings
          title="Voice Instructions"
          :initial-visible="isInstructModel"
        >
          <div class="space-y-3">
            <textarea
              v-if="isInstructModel"
              v-model="instructions"
              class="w-full border border-neutral-200 rounded-xl bg-neutral-50 px-4 py-3 text-sm outline-none transition-colors dark:border-neutral-700 focus:border-primary-400 dark:bg-neutral-900 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              rows="6"
              placeholder="Describe the speaking style, tone, pace, or persona..."
            />
            <div v-else class="border border-neutral-300 rounded-xl border-dashed px-4 py-3 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              Instructions are only shown for instruct models.
            </div>

            <FieldCheckbox
              v-model="optimizeInstructions"
              label="Optimize instructions"
              description="Ask the provider to auto-optimize the instructions if supported."
            />
          </div>
        </ProviderAdvancedSettings>
      </ProviderSettingsContainer>

      <div class="space-y-6">
        <div class="border border-neutral-200 rounded-2xl from-neutral-50 via-white to-cyan-50/60 bg-gradient-to-br p-5 shadow-sm dark:border-neutral-800 dark:from-neutral-900 dark:via-neutral-950 dark:to-cyan-950/20">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-xs text-neutral-500 tracking-[0.24em] uppercase dark:text-neutral-400">
                Realtime Session
              </div>
              <div class="mt-1 text-lg text-neutral-900 font-semibold dark:text-neutral-100">
                {{ sessionStatus }}
              </div>
            </div>
            <div class="border border-neutral-200 rounded-full bg-white/70 px-3 py-1 text-xs text-neutral-600 font-medium dark:border-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-300">
              {{ socketStateLabel }}
            </div>
          </div>

          <div class="grid mt-4 gap-3 sm:grid-cols-2">
            <div class="border border-neutral-200 rounded-xl bg-white/80 p-3 dark:border-neutral-800 dark:bg-neutral-950/80">
              <div class="text-xs text-neutral-500 tracking-wider uppercase dark:text-neutral-400">
                First audio delay
              </div>
              <div class="mt-1 text-lg font-semibold">
                {{ firstAudioDelayMs }}
              </div>
            </div>
            <div class="border border-neutral-200 rounded-xl bg-white/80 p-3 dark:border-neutral-800 dark:bg-neutral-950/80">
              <div class="text-xs text-neutral-500 tracking-wider uppercase dark:text-neutral-400">
                Buffered
              </div>
              <div class="mt-1 text-lg font-semibold">
                {{ bufferedMs }} ms
              </div>
            </div>
            <div class="border border-neutral-200 rounded-xl bg-white/80 p-3 dark:border-neutral-800 dark:bg-neutral-950/80">
              <div class="text-xs text-neutral-500 tracking-wider uppercase dark:text-neutral-400">
                Audio chunks
              </div>
              <div class="mt-1 text-lg font-semibold">
                {{ realtimePlayer.chunksReceived }}
              </div>
            </div>
            <div class="border border-neutral-200 rounded-xl bg-white/80 p-3 dark:border-neutral-800 dark:bg-neutral-950/80">
              <div class="text-xs text-neutral-500 tracking-wider uppercase dark:text-neutral-400">
                Voice model
              </div>
              <div class="mt-1 text-lg font-semibold">
                {{ model }}
              </div>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              class="rounded-full bg-cyan-600 px-4 py-2 text-sm text-white font-semibold transition-transform active:scale-95 disabled:cursor-not-allowed hover:bg-cyan-500 disabled:opacity-50"
              :disabled="!canStream || socketState === 'connecting'"
              @click="streamSample"
            >
              Start demo
            </button>
            <button
              type="button"
              class="border border-neutral-300 rounded-full px-4 py-2 text-sm text-neutral-700 font-semibold transition-colors dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900"
              :disabled="socketState === 'idle'"
              @click="stopSession"
            >
              Stop
            </button>
            <button
              type="button"
              class="border border-amber-300 rounded-full px-4 py-2 text-sm text-amber-700 font-semibold transition-colors dark:border-amber-800 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
              :disabled="socketState === 'idle'"
              @click="interruptSession"
            >
              Interrupt
            </button>
            <button
              type="button"
              class="border border-neutral-300 rounded-full px-4 py-2 text-sm text-neutral-700 font-semibold transition-colors dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900"
              @click="clearSession"
            >
              Clear
            </button>
          </div>
        </div>

        <div class="border border-neutral-200 rounded-2xl bg-white/80 p-5 shadow-sm space-y-4 dark:border-neutral-800 dark:bg-neutral-950/70">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-xs text-neutral-500 tracking-[0.24em] uppercase dark:text-neutral-400">
                Live Input
              </div>
              <div class="mt-1 text-base text-neutral-900 font-semibold dark:text-neutral-100">
                Chunked text will stream as soon as the websocket opens.
              </div>
            </div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400">
              {{ canStream ? 'Ready' : 'Missing required config' }}
            </div>
          </div>

          <textarea
            v-model="sampleText"
            class="min-h-36 w-full border border-neutral-200 rounded-xl bg-neutral-50 px-4 py-3 text-sm outline-none transition-colors dark:border-neutral-700 focus:border-cyan-400 dark:bg-neutral-900 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            rows="6"
            placeholder="Type the text you want to stream..."
          />

          <div class="border border-neutral-200 rounded-xl bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div class="mb-3 text-xs text-neutral-500 tracking-[0.24em] uppercase dark:text-neutral-400">
              Event Log
            </div>
            <div
              ref="logsContainer"
              class="max-h-72 overflow-y-auto text-sm space-y-2"
            >
              <div
                v-for="entry in logs"
                :key="entry.id"
                :class="[
                  'rounded-lg px-3 py-2',
                  entry.level === 'error'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                    : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
                ]"
              >
                {{ entry.text }}
              </div>
              <div v-if="logs.length === 0" class="border border-neutral-300 rounded-lg border-dashed px-3 py-4 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                No events yet. Start a demo stream to see the session lifecycle here.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </ProviderSettingsLayout>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
