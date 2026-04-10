import { defineInvokeEventa } from '@moeru/eventa'

export const QWEN_TTS_REALTIME_SERVER_PATH = '/ws/qwen-tts-realtime'

export const QWEN_TTS_REALTIME_INSTRUCT_MODELS = [
  'qwen3-tts-instruct-flash-realtime',
  'qwen3-tts-instruct-flash-realtime-2026-01-22',
] as const

export const QWEN_TTS_REALTIME_FLASH_MODELS = [
  'qwen3-tts-flash-realtime',
  'qwen3-tts-flash-realtime-2025-11-27',
  'qwen3-tts-flash-realtime-2025-09-18',
] as const

export const QWEN_TTS_REALTIME_FLASH_MODELS_BASE = [
  'qwen3-tts-flash-realtime',
  'qwen3-tts-flash-realtime-2025-11-27',
] as const

export const QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED = [
  ...QWEN_TTS_REALTIME_FLASH_MODELS_BASE,
  'qwen3-tts-flash-realtime-2025-09-18',
] as const

export const QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE = [
  ...QWEN_TTS_REALTIME_INSTRUCT_MODELS,
  ...QWEN_TTS_REALTIME_FLASH_MODELS_BASE,
] as const

export const QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_EXTENDED = [
  ...QWEN_TTS_REALTIME_INSTRUCT_MODELS,
  ...QWEN_TTS_REALTIME_FLASH_MODELS,
] as const

const QWEN_TTS_REALTIME_MODEL_DISPLAY_NAMES: Record<QwenTtsRealtimeModel, string> = {
  'qwen3-tts-instruct-flash-realtime': 'Qwen 3 TTS Instruct Flash Realtime',
  'qwen3-tts-instruct-flash-realtime-2026-01-22': 'Qwen 3 TTS Instruct Flash Realtime (2026-01-22)',
  'qwen3-tts-flash-realtime': 'Qwen 3 TTS Flash Realtime',
  'qwen3-tts-flash-realtime-2025-11-27': 'Qwen 3 TTS Flash Realtime (2025-11-27)',
  'qwen3-tts-flash-realtime-2025-09-18': 'Qwen 3 TTS Flash Realtime (2025-09-18)',
}

export const QWEN_TTS_REALTIME_MODELS = [
  ...QWEN_TTS_REALTIME_INSTRUCT_MODELS,
  ...QWEN_TTS_REALTIME_FLASH_MODELS,
] as const

export type QwenTtsRealtimeModel = typeof QWEN_TTS_REALTIME_MODELS[number]

export const QWEN_TTS_REALTIME_DEFAULT_MODEL: QwenTtsRealtimeModel = 'qwen3-tts-instruct-flash-realtime'

export const QWEN_TTS_REALTIME_REGIONS = ['cn', 'intl'] as const

export type QwenTtsRealtimeRegion = typeof QWEN_TTS_REALTIME_REGIONS[number]

export const QWEN_TTS_REALTIME_MODES = ['server_commit', 'commit'] as const

export type QwenTtsRealtimeMode = typeof QWEN_TTS_REALTIME_MODES[number]

export const QWEN_TTS_REALTIME_SAMPLE_RATE = 24000
export const QWEN_TTS_REALTIME_CHANNELS = 1
export const QWEN_TTS_REALTIME_RESPONSE_FORMAT = 'pcm'
export const QWEN_TTS_REALTIME_DEFAULT_LANGUAGE_TYPE = 'Auto'
export const QWEN_TTS_REALTIME_DEFAULT_VOICE = 'Cherry'
export const QWEN_TTS_REALTIME_LANGUAGE_TYPES = [
  'Chinese',
  'English',
  'German',
  'Italian',
  'Portuguese',
  'Spanish',
  'Japanese',
  'Korean',
  'French',
  'Russian',
  'Auto',
] as const

export type QwenTtsRealtimeLanguageType = typeof QWEN_TTS_REALTIME_LANGUAGE_TYPES[number]

interface QwenTtsRealtimeVoiceLanguage {
  code: string
  title: string
}

const COMMON_VOICE_LANGUAGES: QwenTtsRealtimeVoiceLanguage[] = [
  { code: 'zh', title: 'Chinese' },
  { code: 'en', title: 'English' },
  { code: 'de', title: 'German' },
  { code: 'it', title: 'Italian' },
  { code: 'pt', title: 'Portuguese' },
  { code: 'es', title: 'Spanish' },
  { code: 'ja', title: 'Japanese' },
  { code: 'ko', title: 'Korean' },
  { code: 'fr', title: 'French' },
  { code: 'ru', title: 'Russian' },
] as const

function createVoice(
  id: string,
  name: string,
  description: string,
  gender: 'male' | 'female',
  compatibleModels: readonly QwenTtsRealtimeModel[],
  languages?: readonly QwenTtsRealtimeVoiceLanguage[],
): QwenTtsRealtimeVoiceInfo {
  const voiceLanguages = languages ?? COMMON_VOICE_LANGUAGES

  return {
    id,
    name,
    provider: 'qwen-tts-realtime',
    compatibleModels: [...compatibleModels],
    description,
    gender,
    languages: [...voiceLanguages],
  }
}

export const QWEN_TTS_REALTIME_VOICES: QwenTtsRealtimeVoiceInfo[] = [
  createVoice('Cherry', '芊悦', '阳光积极、亲切自然小姐姐', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_EXTENDED),
  createVoice('Serena', '苏瑶', '温柔小姐姐', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Ethan', '晨煦', '标准普通话，带部分北方口音，阳光、温暖、活力、朝气', 'male', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_EXTENDED),
  createVoice('Chelsie', '千雪', '二次元虚拟女友', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Momo', '茉兔', '撒娇搞怪，逗你开心', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Vivian', '十三', '拽拽的、可爱的小暴躁', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Moon', '月白', '率性帅气的月白', 'male', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Maia', '四月', '知性与温柔的碰撞', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Kai', '凯', '耳朵的一场 SPA', 'male', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Nofish', '不吃鱼', '不会翘舌音的设计师', 'male', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_EXTENDED),
  createVoice('Bella', '萌宝', '喝酒不打醉拳的小萝莉', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Eldric Sage', '沧明子', '沉稳睿智的老者，沧桑如松却心明如镜', 'male', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Mia', '乖小妹', '温顺如春水，乖巧如初雪', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Mochi', '沙小弥', '聪明伶俐的小大人，童真未泯却早慧如禅', 'male', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Bellona', '燕铮莺', '声音洪亮，吐字清晰，人物鲜活', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Vincent', '田叔', '一口独特的沙哑烟嗓，一开口便道尽千军万马与江湖豪情', 'male', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Bunny', '萌小姬', '萌属性爆棚的小萝莉', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Neil', '阿闻', '平直的基线语调，字正腔圆的新闻主持人', 'male', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Elias', '墨讲师', '保持学科严谨性，并通过叙事技巧将复杂知识转化为可消化模块', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_EXTENDED),
  createVoice('Arthur', '徐大爷', '被岁月和旱烟浸泡过的质朴嗓音，不疾不徐地讲述奇闻异事', 'male', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Nini', '邻家妹妹', '糯米糍一样又软又黏的嗓音', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Seren', '小婉', '温和舒缓的声线，助你更快进入睡眠', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Pip', '顽屁小孩', '调皮捣蛋却充满童真的他来了', 'male', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Stella', '少女阿月', '甜到发腻的迷糊少女音，但在喊出代表月亮消灭你时瞬间充满正义感', 'female', QWEN_TTS_REALTIME_INSTRUCT_FLASH_MODELS_BASE),
  createVoice('Jennifer', '詹妮弗', '品牌级、电影质感般美语女声', 'female', QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED),
  createVoice('Ryan', '甜茶', '节奏拉满，戏感炸裂，真实与张力共舞', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED),
  createVoice('Katerina', '卡捷琳娜', '御姐音色，韵律回味十足', 'female', QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED),
  createVoice('Aiden', '艾登', '精通厨艺的美语大男孩', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_BASE),
  createVoice('Bodega', '博德加', '热情的西班牙大叔', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_BASE),
  createVoice('Sonrisa', '索尼莎', '热情开朗的拉美大姐', 'female', QWEN_TTS_REALTIME_FLASH_MODELS_BASE),
  createVoice('Alek', '阿列克', '一开口，是战斗民族的冷，也是毛呢大衣下的暖', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_BASE),
  createVoice('Dolce', '多尔切', '慵懒的意大利大叔', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_BASE),
  createVoice('Sohee', '素熙', '温柔开朗，情绪丰富的韩国欧尼', 'female', QWEN_TTS_REALTIME_FLASH_MODELS_BASE),
  createVoice('Ono Anna', '小野杏', '鬼灵精怪的青梅竹马', 'female', QWEN_TTS_REALTIME_FLASH_MODELS_BASE),
  createVoice('Lenn', '莱恩', '理性是底色，叛逆藏在细节里', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_BASE),
  createVoice('Emilien', '埃米尔安', '浪漫的法国大哥哥', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_BASE),
  createVoice('Andre', '安德雷', '声音磁性，自然舒服、沉稳男生', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_BASE),
  createVoice('Radio Gol', '拉迪奥·戈尔', '足球诗人 Rádio Gol！今天我要用名字为你们解说足球', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_BASE),
  createVoice('Jada', '上海-阿珍', '风风火火的沪上阿姐', 'female', QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED, [
    { code: 'zh-sh', title: 'Shanghai Chinese' },
    { code: 'en', title: 'English' },
  ]),
  createVoice('Dylan', '北京-晓东', '北京胡同里长大的少年', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED, [
    { code: 'zh-bj', title: 'Beijing Chinese' },
    { code: 'en', title: 'English' },
  ]),
  createVoice('Li', '南京-老李', '耐心的瑜伽老师', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED, [
    { code: 'zh-nj', title: 'Nanjing Chinese' },
    { code: 'en', title: 'English' },
  ]),
  createVoice('Marcus', '陕西-秦川', '面宽话短，心实声沉', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED, [
    { code: 'zh-sx', title: 'Shaanxi Chinese' },
    { code: 'en', title: 'English' },
  ]),
  createVoice('Roy', '闽南-阿杰', '诙谐直爽、市井活泼的台湾哥仔形象', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED, [
    { code: 'zh-mn', title: 'Minnan Chinese' },
    { code: 'en', title: 'English' },
  ]),
  createVoice('Peter', '天津-李彼得', '天津相声，专业捧哏', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED, [
    { code: 'zh-tj', title: 'Tianjin Chinese' },
    { code: 'en', title: 'English' },
  ]),
  createVoice('Sunny', '四川-晴儿', '甜到你心里的川妹子', 'female', QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED, [
    { code: 'zh-sc', title: 'Sichuan Chinese' },
    { code: 'en', title: 'English' },
  ]),
  createVoice('Eric', '四川-程川', '一个跳脱市井的四川成都男子', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED, [
    { code: 'zh-sc', title: 'Sichuan Chinese' },
    { code: 'en', title: 'English' },
  ]),
  createVoice('Rocky', '粤语-阿强', '幽默风趣的阿强，在线陪聊', 'male', QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED, [
    { code: 'zh-yue', title: 'Cantonese' },
    { code: 'en', title: 'English' },
  ]),
  createVoice('Kiki', '粤语-阿清', '甜美的港妹闺蜜', 'female', QWEN_TTS_REALTIME_FLASH_MODELS_EXTENDED, [
    { code: 'zh-yue', title: 'Cantonese' },
    { code: 'en', title: 'English' },
  ]),
]

export interface QwenTtsRealtimeVoiceInfo {
  id: string
  name: string
  provider: string
  compatibleModels: QwenTtsRealtimeModel[]
  description?: string
  gender?: string
  deprecated?: boolean
  languages: {
    code: string
    title: string
  }[]
}

export interface QwenTtsRealtimeSessionConfig {
  model: string
  voice: string
  region: QwenTtsRealtimeRegion
  mode: QwenTtsRealtimeMode
  instructions?: string
  optimizeInstructions?: boolean
  languageType?: string
}

export interface QwenTtsRealtimeProxyStartPayload {
  apiKey: string
  model: string
  region: QwenTtsRealtimeRegion
  session: QwenTtsRealtimeSessionConfig
}

export interface QwenTtsRealtimeSessionUpdateEvent {
  event_id: string
  type: 'session.update'
  session: {
    model: string
    voice: string
    mode: QwenTtsRealtimeMode
    response_format: typeof QWEN_TTS_REALTIME_RESPONSE_FORMAT
    sample_rate: typeof QWEN_TTS_REALTIME_SAMPLE_RATE
    language_type: QwenTtsRealtimeLanguageType
    instructions?: string
    optimize_instructions?: boolean
  }
}

export interface QwenTtsRealtimeAppendTextEvent {
  event_id: string
  type: 'input_text_buffer.append'
  text: string
}

export interface QwenTtsRealtimeCommitEvent {
  event_id: string
  type: 'input_text_buffer.commit'
}

export interface QwenTtsRealtimeFinishEvent {
  event_id: string
  type: 'session.finish'
}

export interface QwenTtsRealtimeInterruptEvent {
  event_id: string
  type: 'proxy.interrupt'
}

export type QwenTtsRealtimeClientMessage
  = | { type: 'proxy.start', payload: QwenTtsRealtimeProxyStartPayload }
    | QwenTtsRealtimeSessionUpdateEvent
    | QwenTtsRealtimeAppendTextEvent
    | QwenTtsRealtimeCommitEvent
    | QwenTtsRealtimeFinishEvent
    | QwenTtsRealtimeInterruptEvent

export type QwenTtsRealtimeServerMessage = Record<string, unknown> & {
  type?: string
  delta?: string
}

export const electronQwenTtsRealtimeStream = defineInvokeEventa<
  QwenTtsRealtimeServerMessage,
  ReadableStream<QwenTtsRealtimeClientMessage> | AsyncIterable<QwenTtsRealtimeClientMessage>
>('eventa:invoke:electron:qwen-tts-realtime:stream')

export function createQwenTtsRealtimeEventId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `event_${crypto.randomUUID()}`
  }

  return `event_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

export function buildQwenTtsRealtimeUpstreamUrl(model: string, region: QwenTtsRealtimeRegion) {
  const baseUrl = region === 'intl'
    ? 'wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime'
    : 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime'

  const url = new URL(baseUrl)
  url.searchParams.set('model', model)
  return url
}

export function createQwenTtsRealtimeSessionUpdateEvent(
  config: QwenTtsRealtimeSessionConfig,
): QwenTtsRealtimeSessionUpdateEvent {
  const languageType = normalizeQwenTtsRealtimeLanguageType(config.languageType)

  return {
    event_id: createQwenTtsRealtimeEventId(),
    type: 'session.update',
    session: {
      model: config.model,
      voice: config.voice,
      mode: config.mode,
      response_format: QWEN_TTS_REALTIME_RESPONSE_FORMAT,
      sample_rate: QWEN_TTS_REALTIME_SAMPLE_RATE,
      language_type: languageType,
      instructions: config.instructions?.trim() || undefined,
      optimize_instructions: config.optimizeInstructions ?? undefined,
    },
  }
}

export function normalizeQwenTtsRealtimeLanguageType(languageType?: string): QwenTtsRealtimeLanguageType {
  const normalized = languageType?.trim()
  if (normalized && QWEN_TTS_REALTIME_LANGUAGE_TYPES.includes(normalized as QwenTtsRealtimeLanguageType)) {
    return normalized as QwenTtsRealtimeLanguageType
  }

  return QWEN_TTS_REALTIME_DEFAULT_LANGUAGE_TYPE
}

export function formatQwenTtsRealtimeModelLabel(model: string) {
  if (model in QWEN_TTS_REALTIME_MODEL_DISPLAY_NAMES) {
    return QWEN_TTS_REALTIME_MODEL_DISPLAY_NAMES[model as QwenTtsRealtimeModel]
  }

  if (model.includes('instruct')) {
    return 'Qwen 3 TTS Instruct Flash Realtime'
  }

  if (model.includes('flash')) {
    return 'Qwen 3 TTS Flash Realtime'
  }

  return model
}

export function formatQwenTtsRealtimeVoiceCompatibilityDescription(voice: QwenTtsRealtimeVoiceInfo) {
  const compatibleModels = voice.compatibleModels.map(formatQwenTtsRealtimeModelLabel)
  if (compatibleModels.length === 0) {
    return 'Compatible with no known snapshot.'
  }

  return `Compatible with: ${compatibleModels.join(', ')}`
}

export function createQwenTtsRealtimeAppendTextEvent(text: string): QwenTtsRealtimeAppendTextEvent {
  return {
    event_id: createQwenTtsRealtimeEventId(),
    type: 'input_text_buffer.append',
    text,
  }
}

export function createQwenTtsRealtimeCommitEvent(): QwenTtsRealtimeCommitEvent {
  return {
    event_id: createQwenTtsRealtimeEventId(),
    type: 'input_text_buffer.commit',
  }
}

export function createQwenTtsRealtimeFinishEvent(): QwenTtsRealtimeFinishEvent {
  return {
    event_id: createQwenTtsRealtimeEventId(),
    type: 'session.finish',
  }
}

export function createQwenTtsRealtimeInterruptEvent(): QwenTtsRealtimeInterruptEvent {
  return {
    event_id: createQwenTtsRealtimeEventId(),
    type: 'proxy.interrupt',
  }
}

export function createQwenTtsRealtimeProxyStartMessage(payload: QwenTtsRealtimeProxyStartPayload): QwenTtsRealtimeClientMessage {
  return {
    type: 'proxy.start',
    payload,
  }
}

export function buildQwenTtsRealtimeServerUrl(serverUrl: string, token?: string | null) {
  const url = new URL(QWEN_TTS_REALTIME_SERVER_PATH, serverUrl)
  if (token) {
    url.searchParams.set('token', token)
  }
  return url
}

function decodeBase64Bytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64)
  const output = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    output[i] = binary.charCodeAt(i)
  }
  return output
}

export function decodeBase64ToUint8Array(base64: string): Uint8Array {
  return decodeBase64Bytes(base64)
}

export function isQwenTtsRealtimeAudioDeltaEvent(event: QwenTtsRealtimeServerMessage): event is QwenTtsRealtimeServerMessage & { type: 'response.audio.delta', delta: string } {
  return event.type === 'response.audio.delta' && typeof event.delta === 'string'
}

export function isQwenTtsRealtimeTerminalEvent(event: QwenTtsRealtimeServerMessage): boolean {
  return event.type === 'session.finished' || event.type === 'session.closed' || event.type === 'response.done'
}
