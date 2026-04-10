import type { createContext } from '@moeru/eventa/adapters/electron/main'
import type {
  QwenTtsRealtimeClientMessage,
  QwenTtsRealtimeProxyStartPayload,
  QwenTtsRealtimeServerMessage,
} from '@proj-airi/stage-shared/qwen-tts-realtime'
import type { BrowserWindow } from 'electron'
import type { RawData } from 'ws'

import { Buffer } from 'node:buffer'

import WebSocket from 'ws'

import { useLogg } from '@guiiai/logg'
import { defineStreamInvokeHandler, isAsyncIterable, isReadableStream, toStreamHandler } from '@moeru/eventa'
import { errorMessageFrom } from '@moeru/std'
import {
  buildQwenTtsRealtimeUpstreamUrl,
  createQwenTtsRealtimeSessionUpdateEvent,
  electronQwenTtsRealtimeStream,
  isQwenTtsRealtimeTerminalEvent,
} from '@proj-airi/stage-shared/qwen-tts-realtime'

const log = useLogg('qwen-tts-realtime').useGlobalConfig()

let qwenTtsRealtimeSessionQueue: Promise<void> = Promise.resolve()

function runSerializedQwenTtsRealtimeSession<T>(task: () => Promise<T>) {
  const nextSession = qwenTtsRealtimeSessionQueue.then(task, task)
  qwenTtsRealtimeSessionQueue = nextSession.then(
    () => undefined,
    () => undefined,
  )
  return nextSession
}

function parseServerMessage(raw: string): QwenTtsRealtimeServerMessage {
  return JSON.parse(raw) as QwenTtsRealtimeServerMessage
}

function toText(data: unknown) {
  if (typeof data === 'string') {
    return data
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('utf8')
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)).toString('utf8')
  }

  return String(data)
}

function toPayloadError(error: unknown) {
  return errorMessageFrom(error) ?? 'Unknown realtime error'
}

function serializeErrorDetails(error: unknown) {
  if (!error || typeof error !== 'object') {
    return {
      message: toPayloadError(error),
    }
  }

  const typedError = error as Record<string, unknown>
  return {
    message: typeof typedError.message === 'string' ? typedError.message : toPayloadError(error),
    name: typeof typedError.name === 'string' ? typedError.name : undefined,
    code: typeof typedError.code === 'string' || typeof typedError.code === 'number' ? typedError.code : undefined,
    statusCode: typeof typedError.statusCode === 'string' || typeof typedError.statusCode === 'number' ? typedError.statusCode : undefined,
    stack: typeof typedError.stack === 'string' ? typedError.stack : undefined,
    reason: typeof typedError.reason === 'string' ? typedError.reason : undefined,
    response: typedError.response && typeof typedError.response === 'object'
      ? {
          status: typeof (typedError.response as Record<string, unknown>).status === 'number'
            ? (typedError.response as Record<string, unknown>).status
            : undefined,
          statusText: typeof (typedError.response as Record<string, unknown>).statusText === 'string'
            ? (typedError.response as Record<string, unknown>).statusText
            : undefined,
        }
      : undefined,
  }
}

export function createQwenTtsRealtimeService(params: {
  context: ReturnType<typeof createContext>['context']
  window: BrowserWindow
}) {
  defineStreamInvokeHandler(
    params.context,
    electronQwenTtsRealtimeStream,
    toStreamHandler(async ({ payload, emit }) => runSerializedQwenTtsRealtimeSession(async () => {
      emit({
        type: 'proxy.ready',
        payload: {
          windowId: params.window.webContents.id,
        },
      })

      const incomingMessages: AsyncIterable<QwenTtsRealtimeClientMessage> = isReadableStream(payload) || isAsyncIterable(payload)
        ? payload
        : (async function* empty() {})()

      let upstreamWs: WebSocket | undefined
      let started = false
      let closing = false
      let settled = false
      let resolveSettled: (() => void) | undefined
      const pendingMessages: string[] = []

      const settledPromise = new Promise<void>((resolve) => {
        resolveSettled = resolve
      })

      const finalize = () => {
        if (settled) {
          return
        }

        settled = true
        resolveSettled?.()
      }

      const closeUpstream = () => {
        if (upstreamWs && upstreamWs.readyState < WebSocket.CLOSING) {
          upstreamWs.close(1000, 'client closed')
        }
        upstreamWs = undefined
      }

      const sendToBrowser = (payload: Record<string, unknown>) => {
        emit(payload)
      }

      const startUpstream = (startPayload: QwenTtsRealtimeProxyStartPayload) => {
        upstreamWs = new WebSocket(buildQwenTtsRealtimeUpstreamUrl(startPayload.model, startPayload.region), {
          headers: {
            Authorization: `Bearer ${startPayload.apiKey}`,
          },
        })

        upstreamWs.onopen = () => {
          log.withFields({ windowId: params.window.webContents.id, model: startPayload.model, region: startPayload.region }).log('Qwen TTS realtime upstream connected')
          sendToBrowser({
            type: 'proxy.upstream.open',
            payload: {
              model: startPayload.model,
              region: startPayload.region,
            },
          })

          const sessionUpdate = createQwenTtsRealtimeSessionUpdateEvent(startPayload.session)
          upstreamWs?.send(JSON.stringify(sessionUpdate))

          while (pendingMessages.length > 0 && upstreamWs?.readyState === WebSocket.OPEN) {
            upstreamWs.send(pendingMessages.shift()!)
          }
        }

        upstreamWs.on('message', (data: RawData) => {
          const raw = toText(data)
          let parsed: QwenTtsRealtimeServerMessage

          try {
            parsed = parseServerMessage(raw)
          }
          catch (error) {
            log.withError(error).error('Failed to parse Qwen TTS realtime upstream message')
            sendToBrowser({
              type: 'proxy.error',
              payload: {
                message: 'Failed to parse upstream message',
                raw,
              },
            })
            closing = true
            closeUpstream()
            finalize()
            return
          }

          sendToBrowser(parsed)

          if (isQwenTtsRealtimeTerminalEvent(parsed)) {
            closing = true
            closeUpstream()
            finalize()
          }
        })

        upstreamWs.on('error', (error: Error) => {
          log.withFields({
            windowId: params.window.webContents.id,
            model: startPayload.model,
            region: startPayload.region,
            error: serializeErrorDetails(error),
          }).error('Qwen TTS realtime upstream error')
          sendToBrowser({
            type: 'proxy.error',
            payload: {
              message: toPayloadError(error),
              details: serializeErrorDetails(error),
              model: startPayload.model,
              region: startPayload.region,
            },
          })
          closing = true
          closeUpstream()
          finalize()
        })

        upstreamWs.on('close', (code: number, reason: Buffer) => {
          upstreamWs = undefined
          log.withFields({ windowId: params.window.webContents.id, code, reason: reason.toString() }).log('Qwen TTS realtime upstream closed')

          if (!closing) {
            sendToBrowser({
              type: 'proxy.upstream.close',
              payload: {
                code,
                reason: reason.toString(),
              },
            })
          }

          finalize()
        })
      }

      for await (const message of incomingMessages) {
        if (message.type === 'proxy.start') {
          if (started) {
            sendToBrowser({
              type: 'proxy.error',
              payload: {
                message: 'Realtime session already started.',
              },
            })
            continue
          }

          started = true
          log.withFields({
            windowId: params.window.webContents.id,
            model: message.payload.model,
            region: message.payload.region,
          }).log('Qwen TTS realtime browser session starting')
          startUpstream(message.payload)
          continue
        }

        if (message.type === 'proxy.interrupt') {
          closing = true
          closeUpstream()
          sendToBrowser({
            type: 'session.closed',
          })
          finalize()
          break
        }

        const raw = JSON.stringify(message)
        if (!upstreamWs || upstreamWs.readyState !== WebSocket.OPEN) {
          pendingMessages.push(raw)
          continue
        }

        upstreamWs.send(raw)
      }

      if (!started) {
        sendToBrowser({
          type: 'proxy.error',
          payload: {
            message: 'Realtime session never started.',
          },
        })
        finalize()
        return
      }

      await settledPromise
    })),
  )
}
