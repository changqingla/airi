import type { QwenTtsRealtimeClientMessage, QwenTtsRealtimeProxyStartPayload, QwenTtsRealtimeServerMessage } from '@proj-airi/stage-shared/qwen-tts-realtime'
import type { WSEvents } from 'hono/ws'
import type { RawData } from 'ws'

import { Buffer } from 'node:buffer'

import WebSocket from 'ws'

import { useLogger } from '@guiiai/logg'
import { errorMessageFrom } from '@moeru/std'
import { buildQwenTtsRealtimeUpstreamUrl, createQwenTtsRealtimeSessionUpdateEvent, isQwenTtsRealtimeTerminalEvent } from '@proj-airi/stage-shared/qwen-tts-realtime'

const log = useLogger('qwen-tts-realtime').useGlobalConfig()

function parseClientMessage(raw: string): QwenTtsRealtimeClientMessage {
  return JSON.parse(raw) as QwenTtsRealtimeClientMessage
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

export function createQwenTtsRealtimeWsHandlers(userId: string): WSEvents {
  let browserWs: {
    send: (data: string) => void
    close: (code?: number, reason?: string) => void
    readyState?: number
  } | undefined
  let upstreamWs: WebSocket | undefined
  let started = false
  let closing = false
  const pendingMessages: string[] = []

  function sendToBrowser(payload: Record<string, unknown>) {
    if (!browserWs || (typeof browserWs.readyState === 'number' && browserWs.readyState >= WebSocket.CLOSING)) {
      return
    }

    browserWs.send(JSON.stringify(payload))
  }

  function closeBrowser(code = 1000, reason = 'closed') {
    if (!browserWs || (typeof browserWs.readyState === 'number' && browserWs.readyState >= WebSocket.CLOSING)) {
      return
    }

    browserWs.close(code, reason)
  }

  function clearUpstream() {
    if (upstreamWs && upstreamWs.readyState < WebSocket.CLOSING) {
      upstreamWs.close(1000, 'client closed')
    }
    upstreamWs = undefined
    started = false
    pendingMessages.length = 0
  }

  function startUpstream(payload: QwenTtsRealtimeProxyStartPayload) {
    upstreamWs = new WebSocket(buildQwenTtsRealtimeUpstreamUrl(payload.model, payload.region), {
      headers: {
        Authorization: `Bearer ${payload.apiKey}`,
      },
    })

    upstreamWs.on('open', () => {
      log.withFields({ userId, model: payload.model, region: payload.region }).log('Qwen TTS realtime upstream connected')
      sendToBrowser({
        type: 'proxy.upstream.open',
        payload: {
          model: payload.model,
          region: payload.region,
        },
      })

      const sessionUpdate = createQwenTtsRealtimeSessionUpdateEvent(payload.session)
      upstreamWs?.send(JSON.stringify(sessionUpdate))

      while (pendingMessages.length > 0 && upstreamWs?.readyState === WebSocket.OPEN) {
        upstreamWs.send(pendingMessages.shift()!)
      }
    })

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
        return
      }

      sendToBrowser(parsed)

      if (isQwenTtsRealtimeTerminalEvent(parsed)) {
        closing = true
        setTimeout(closeBrowser, 25, 1000, 'session finished')
      }
    })

    upstreamWs.on('error', (error: Error) => {
      log.withFields({
        userId,
        model: payload.model,
        region: payload.region,
        error: serializeErrorDetails(error),
      }).error('Qwen TTS realtime upstream error')
      sendToBrowser({
        type: 'proxy.error',
        payload: {
          message: toPayloadError(error),
          details: serializeErrorDetails(error),
          model: payload.model,
          region: payload.region,
        },
      })
      closing = true
      closeBrowser(1011, 'upstream error')
    })

    upstreamWs.on('close', (code: number, reason: Buffer) => {
      upstreamWs = undefined
      log.withFields({ userId, code, reason: reason.toString() }).log('Qwen TTS realtime upstream closed')

      if (!closing) {
        sendToBrowser({
          type: 'proxy.upstream.close',
          payload: {
            code,
            reason: reason.toString(),
          },
        })
        closeBrowser(code === 1000 ? 1000 : 1011, reason.toString() || 'upstream closed')
      }
    })
  }

  return {
    onOpen(_event, ws) {
      browserWs = ws
      sendToBrowser({
        type: 'proxy.ready',
        payload: {
          userId,
        },
      })
    },

    onMessage(message) {
      if (!browserWs) {
        return
      }

      let parsed: QwenTtsRealtimeClientMessage

      try {
        parsed = parseClientMessage(toText(message.data))
      }
      catch (error) {
        sendToBrowser({
          type: 'proxy.error',
          payload: {
            message: `Invalid client payload: ${errorMessageFrom(error) ?? String(error)}`,
          },
        })
        return
      }

      if (parsed.type === 'proxy.start') {
        if (started) {
          sendToBrowser({
            type: 'proxy.error',
            payload: {
              message: 'Realtime session already started.',
            },
          })
          return
        }

        started = true
        log.withFields({
          userId,
          model: parsed.payload.model,
          region: parsed.payload.region,
        }).log('Qwen TTS realtime browser session starting')
        startUpstream(parsed.payload)
        return
      }

      if (parsed.type === 'proxy.interrupt') {
        closing = true
        clearUpstream()
        closeBrowser(1000, 'interrupted')
        return
      }

      const raw = JSON.stringify(parsed)
      if (!upstreamWs || upstreamWs.readyState !== WebSocket.OPEN) {
        pendingMessages.push(raw)
        return
      }

      upstreamWs.send(raw)
    },

    onClose() {
      closing = true
      browserWs = undefined
      clearUpstream()
    },

    onError(event) {
      log.withError(event).error('Qwen TTS realtime browser websocket error')
      closing = true
      clearUpstream()
    },
  }
}
