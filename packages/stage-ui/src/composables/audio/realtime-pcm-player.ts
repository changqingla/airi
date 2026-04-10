import { QWEN_TTS_REALTIME_SAMPLE_RATE } from '@proj-airi/stage-shared'
import { computed, onBeforeUnmount, ref } from 'vue'

import { useAudioContext } from '../../stores/audio'

export interface RealtimePcmPlayerOptions {
  sampleRate?: number
  channelCount?: number
  leadTimeMs?: number
}

function toUint8Array(chunk: ArrayBufferLike | ArrayBufferView) {
  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk)
  }

  if (ArrayBuffer.isView(chunk)) {
    return new Uint8Array(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength))
  }

  throw new TypeError('Unsupported PCM chunk type')
}

function pcm16ToFloat32(buffer: Int16Array) {
  const output = new Float32Array(buffer.length)
  for (let i = 0; i < buffer.length; i++) {
    output[i] = Math.max(-1, buffer[i] / 0x8000)
  }
  return output
}

function createAudioBufferFromPcm16(
  audioContext: AudioContext,
  chunk: Uint8Array,
  sampleRate: number,
  channelCount: number,
) {
  const length = Math.floor(chunk.byteLength / 2)
  const pcm16 = new Int16Array(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + length * 2))
  const frames = Math.floor(pcm16.length / channelCount)

  const audioBuffer = audioContext.createBuffer(channelCount, frames, sampleRate)
  const floatSamples = pcm16ToFloat32(pcm16)

  if (channelCount === 1) {
    audioBuffer.getChannelData(0).set(floatSamples.subarray(0, frames))
    return audioBuffer
  }

  for (let channel = 0; channel < channelCount; channel++) {
    const channelData = audioBuffer.getChannelData(channel)
    for (let index = 0; index < frames; index++) {
      channelData[index] = floatSamples[index * channelCount + channel] ?? 0
    }
  }

  return audioBuffer
}

export function useRealtimePcmPlayer(options: RealtimePcmPlayerOptions = {}) {
  const { audioContext } = useAudioContext()

  const sampleRate = options.sampleRate || QWEN_TTS_REALTIME_SAMPLE_RATE
  const channelCount = options.channelCount || 1
  const leadTimeMs = options.leadTimeMs ?? 120

  const playing = ref(false)
  const chunksReceived = ref(0)
  const bufferedMs = ref(0)
  const firstAudioDelayMs = ref<number | null>(null)
  const startedAt = ref<number | null>(null)
  const nextPlaybackTime = ref(0)
  const scheduledSources = new Set<AudioBufferSourceNode>()

  const hasAudio = computed(() => chunksReceived.value > 0)

  function updateBufferedMs() {
    bufferedMs.value = Math.max(0, (nextPlaybackTime.value - audioContext.currentTime) * 1000)
  }

  function removeSource(source: AudioBufferSourceNode) {
    scheduledSources.delete(source)
    updateBufferedMs()
  }

  async function start() {
    if (playing.value) {
      return
    }

    await audioContext.resume()
    playing.value = true
    startedAt.value = performance.now()
    firstAudioDelayMs.value = null
    chunksReceived.value = 0
    nextPlaybackTime.value = 0
    bufferedMs.value = 0
  }

  async function push(chunk: ArrayBufferLike | ArrayBufferView) {
    if (!playing.value) {
      await start()
    }

    const data = toUint8Array(chunk)
    if (data.byteLength < 2) {
      return
    }

    const audioBuffer = createAudioBufferFromPcm16(audioContext, data, sampleRate, channelCount)
    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioContext.destination)

    const now = audioContext.currentTime
    const minimumStartTime = now + (leadTimeMs / 1000)
    if (nextPlaybackTime.value < minimumStartTime) {
      nextPlaybackTime.value = minimumStartTime
    }

    if (firstAudioDelayMs.value == null && startedAt.value != null) {
      firstAudioDelayMs.value = performance.now() - startedAt.value
    }

    const scheduledAt = nextPlaybackTime.value
    nextPlaybackTime.value += audioBuffer.duration

    chunksReceived.value += 1
    updateBufferedMs()

    scheduledSources.add(source)
    source.onended = () => {
      removeSource(source)
      source.disconnect()
    }
    source.start(scheduledAt)
  }

  async function stop() {
    for (const source of scheduledSources) {
      try {
        source.stop()
      }
      catch {
        // Ignore sources already ended or stopped.
      }
      source.disconnect()
    }
    scheduledSources.clear()
    playing.value = false
    chunksReceived.value = 0
    bufferedMs.value = 0
    firstAudioDelayMs.value = null
    startedAt.value = null
    nextPlaybackTime.value = 0
  }

  onBeforeUnmount(() => {
    void stop()
  })

  return {
    playing,
    hasAudio,
    chunksReceived,
    bufferedMs,
    firstAudioDelayMs,
    start,
    push,
    stop,
  }
}
