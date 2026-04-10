import type { QwenTtsRealtimeMode, QwenTtsRealtimeRegion } from '@proj-airi/stage-shared'
import type {
  QwenTtsRealtimeClientMessage,
  QwenTtsRealtimeServerMessage,
} from '@proj-airi/stage-shared/qwen-tts-realtime'

import { defineStreamInvoke } from '@moeru/eventa'
import { createContext as createElectronRendererContext } from '@moeru/eventa/adapters/electron/renderer'
import { toWav } from '@proj-airi/audio/encoding'
import {
  buildQwenTtsRealtimeServerUrl,
  createQwenTtsRealtimeAppendTextEvent,
  createQwenTtsRealtimeCommitEvent,
  createQwenTtsRealtimeFinishEvent,
  createQwenTtsRealtimeProxyStartMessage,
  decodeBase64ToUint8Array,
  electronQwenTtsRealtimeStream,
  isStageTamagotchi,
  QWEN_TTS_REALTIME_CHANNELS,
  QWEN_TTS_REALTIME_DEFAULT_LANGUAGE_TYPE,
  QWEN_TTS_REALTIME_SAMPLE_RATE,
} from '@proj-airi/stage-shared'

import { getAuthToken } from '../../../libs/auth'
import { SERVER_URL } from '../../../libs/server'

export interface QwenTtsRealtimeSpeechOptions {
  apiKey: string
  model: string
  voice: string
  region: QwenTtsRealtimeRegion
  mode: QwenTtsRealtimeMode
  input: string
  instructions?: string
  optimizeInstructions?: boolean
  languageType?: string
}

export interface QwenTtsRealtimeTransport {
  kind: 'browser' | 'electron'
  url: string
  ready: Promise<void>
  send: (message: QwenTtsRealtimeClientMessage) => void
  close: () => void
  messages: AsyncIterable<QwenTtsRealtimeServerMessage>
}

function concatUint8Arrays(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

function pcm16ToWav(pcmBytes: Uint8Array) {
  const evenLength = pcmBytes.byteLength - (pcmBytes.byteLength % 2)
  const pcm16 = new Int16Array(pcmBytes.buffer.slice(pcmBytes.byteOffset, pcmBytes.byteOffset + evenLength))
  const floatSamples = new Float32Array(pcm16.length)

  for (let i = 0; i < pcm16.length; i++) {
    floatSamples[i] = Math.max(-1, pcm16[i] / 0x8000)
  }

  return toWav(floatSamples.buffer, QWEN_TTS_REALTIME_SAMPLE_RATE, QWEN_TTS_REALTIME_CHANNELS)
}

function createAsyncQueue<T>() {
  const queue: T[] = []
  const waiters: Array<(result: IteratorResult<T>) => void> = []
  let closed = false

  const stream: AsyncIterable<T> = {
    [Symbol.asyncIterator]() {
      return {
        next: async () => {
          if (queue.length > 0) {
            return { value: queue.shift()!, done: false }
          }

          if (closed) {
            return { value: undefined, done: true }
          }

          return await new Promise<IteratorResult<T>>((resolve) => {
            waiters.push(resolve)
          })
        },
      }
    },
  }

  function push(value: T) {
    if (closed) {
      return
    }

    const waiter = waiters.shift()
    if (waiter) {
      waiter({ value, done: false })
      return
    }

    queue.push(value)
  }

  function close() {
    if (closed) {
      return
    }

    closed = true
    while (waiters.length > 0) {
      waiters.shift()?.({ value: undefined, done: true })
    }
  }

  return {
    push,
    close,
    stream,
  }
}

let qwenTtsRealtimeTaskQueue: Promise<void> = Promise.resolve()

function runQwenTtsRealtimeTask<T>(task: () => Promise<T>) {
  const nextTask = qwenTtsRealtimeTaskQueue.then(task, task)
  qwenTtsRealtimeTaskQueue = nextTask.then(
    () => undefined,
    () => undefined,
  )
  return nextTask
}

function getElectronQwenTtsRealtimeContext() {
  if (!isStageTamagotchi()) {
    return null
  }

  const ipcRenderer = (globalThis as {
    window?: {
      electron?: {
        ipcRenderer?: unknown
      }
    }
  }).window?.electron?.ipcRenderer

  if (!ipcRenderer) {
    return null
  }

  return createElectronRendererContext(ipcRenderer as Parameters<typeof createElectronRendererContext>[0]).context
}

function createBrowserQwenTtsRealtimeTransport(): QwenTtsRealtimeTransport {
  const token = getAuthToken()
  const connectionUrl = buildQwenTtsRealtimeServerUrl(SERVER_URL, token)
  if (!token) {
    throw new Error(`Missing auth token for ${connectionUrl.origin}. Please sign in first.`)
  }

  const ws = new WebSocket(connectionUrl)
  const queue = createAsyncQueue<QwenTtsRealtimeServerMessage>()
  const pendingMessages: string[] = []
  let settled = false

  const ready = new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      resolve()
      while (pendingMessages.length > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(pendingMessages.shift()!)
      }
    }

    ws.onerror = () => {
      if (settled) {
        return
      }

      settled = true
      queue.push({
        type: 'proxy.error',
        payload: {
          message: `Qwen TTS realtime websocket failed to open ${connectionUrl.href}`,
        },
      })
      queue.close()
      reject(new Error(`Qwen TTS realtime websocket failed to open ${connectionUrl.href}`))
    }
  })

  ws.onmessage = (event) => {
    const raw = typeof event.data === 'string' ? event.data : String(event.data)
    try {
      const message = JSON.parse(raw) as QwenTtsRealtimeServerMessage
      queue.push(message)
    }
    catch {
      queue.push({
        type: 'proxy.error',
        payload: {
          message: 'Failed to parse websocket event',
          raw,
        },
      })
    }
  }

  ws.onclose = (event) => {
    if (!settled && event.code !== 1000) {
      queue.push({
        type: 'proxy.upstream.close',
        payload: {
          code: event.code,
          reason: event.reason || 'empty',
          url: connectionUrl.href,
        },
      })
    }
    queue.close()
  }

  return {
    kind: 'browser',
    url: connectionUrl.href,
    ready,
    send: (message) => {
      const raw = JSON.stringify(message)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw)
        return
      }
      pendingMessages.push(raw)
    },
    close: () => {
      settled = true
      if (ws.readyState < WebSocket.CLOSING) {
        ws.close(1000, 'client closed')
      }
    },
    messages: queue.stream,
  }
}

function createElectronQwenTtsRealtimeTransport() {
  const context = getElectronQwenTtsRealtimeContext()
  if (!context) {
    return null
  }

  const invokeStream = defineStreamInvoke(context, electronQwenTtsRealtimeStream)
  const queue = createAsyncQueue<QwenTtsRealtimeServerMessage>()
  const pendingMessages: QwenTtsRealtimeClientMessage[] = []
  let controller: ReadableStreamDefaultController<QwenTtsRealtimeClientMessage> | null = null
  let readyResolve: (() => void) | null = null
  let closed = false

  const ready = new Promise<void>((resolve) => {
    readyResolve = resolve
  })

  const input = new ReadableStream<QwenTtsRealtimeClientMessage>({
    start(streamController) {
      controller = streamController
      readyResolve?.()
      while (pendingMessages.length > 0) {
        controller.enqueue(pendingMessages.shift()!)
      }
    },
    cancel() {
      controller = null
    },
  })

  const output = invokeStream(input)

  void (async () => {
    try {
      for await (const message of output) {
        queue.push(message)
      }
      queue.close()
    }
    catch (error) {
      queue.push({
        type: 'proxy.error',
        payload: {
          message: error instanceof Error ? error.message : String(error),
        },
      })
      queue.close()
    }
  })()

  return {
    kind: 'electron' as const,
    url: 'electron://settings-window/qwen-tts-realtime',
    ready,
    send: (message: QwenTtsRealtimeClientMessage) => {
      if (closed) {
        return
      }

      if (controller) {
        controller.enqueue(message)
        return
      }

      pendingMessages.push(message)
    },
    close: () => {
      closed = true
      try {
        controller?.close()
      }
      catch {
        // Ignore close races.
      }
    },
    messages: queue.stream,
  } satisfies QwenTtsRealtimeTransport
}

export async function createQwenTtsRealtimeTransport(): Promise<QwenTtsRealtimeTransport> {
  const electronTransport = createElectronQwenTtsRealtimeTransport()
  if (electronTransport) {
    return electronTransport
  }

  return createBrowserQwenTtsRealtimeTransport()
}

export async function generateQwenTtsRealtimeSpeech(options: QwenTtsRealtimeSpeechOptions): Promise<ArrayBuffer> {
  if (typeof WebSocket === 'undefined') {
    throw new TypeError('WebSocket is not available in this environment.')
  }

  return runQwenTtsRealtimeTask(async () => {
    const transport = await createQwenTtsRealtimeTransport()
    const audioChunks: Uint8Array[] = []
    let proxyErrorDetail: string | null = null
    let upstreamCloseDetail: string | null = null

    const consume = (async () => {
      for await (const message of transport.messages) {
        if (message.type === 'proxy.error') {
          const payload = message.payload as Record<string, unknown> | undefined
          proxyErrorDetail = [
            typeof payload?.message === 'string' ? payload.message : 'Qwen TTS realtime proxy failed',
            typeof payload?.code === 'string' || typeof payload?.code === 'number' ? `code=${String(payload.code)}` : null,
            typeof payload?.statusCode === 'string' || typeof payload?.statusCode === 'number' ? `status=${String(payload.statusCode)}` : null,
            typeof payload?.reason === 'string' ? `reason=${String(payload.reason)}` : null,
            payload?.details && typeof payload.details === 'object' ? `details=${JSON.stringify(payload.details)}` : null,
          ].filter(Boolean).join(', ')
          continue
        }

        if (message.type === 'proxy.upstream.close') {
          const payload = message.payload as Record<string, unknown> | undefined
          upstreamCloseDetail = [
            typeof payload?.code === 'string' || typeof payload?.code === 'number' ? `code=${String(payload.code)}` : null,
            typeof payload?.reason === 'string' ? `reason=${String(payload.reason)}` : null,
            typeof payload?.url === 'string' ? `url=${String(payload.url)}` : null,
          ].filter(Boolean).join(', ')
          continue
        }

        if (message.type === 'response.audio.delta' && typeof message.delta === 'string') {
          audioChunks.push(decodeBase64ToUint8Array(message.delta))
        }

        if (message.type === 'session.finished' || message.type === 'response.done') {
          break
        }
      }
    })()

    await transport.ready

    transport.send(createQwenTtsRealtimeProxyStartMessage({
      apiKey: options.apiKey,
      model: options.model,
      region: options.region,
      session: {
        model: options.model,
        voice: options.voice,
        region: options.region,
        mode: options.mode,
        instructions: options.instructions,
        optimizeInstructions: options.optimizeInstructions,
        languageType: options.languageType || QWEN_TTS_REALTIME_DEFAULT_LANGUAGE_TYPE,
      },
    }))

    transport.send(createQwenTtsRealtimeAppendTextEvent(options.input))
    if (options.mode === 'commit') {
      transport.send(createQwenTtsRealtimeCommitEvent())
    }
    transport.send(createQwenTtsRealtimeFinishEvent())

    await consume
    transport.close()

    if (proxyErrorDetail) {
      throw new Error(`Qwen TTS realtime proxy failed: ${proxyErrorDetail}`)
    }

    if (upstreamCloseDetail) {
      throw new Error(`Qwen TTS realtime upstream closed unexpectedly: ${upstreamCloseDetail}`)
    }

    if (audioChunks.length === 0) {
      throw new Error('Qwen TTS realtime returned no audio.')
    }

    return pcm16ToWav(concatUint8Arrays(audioChunks))
  })
}
