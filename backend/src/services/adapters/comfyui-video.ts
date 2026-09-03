import { randomInt } from 'node:crypto'
import type {
  AIConfig,
  ProviderRequest,
  VideoGenerationRecord,
  VideoGenResponse,
  VideoPollResponse,
  VideoProviderAdapter,
} from './types.js'
import { joinProviderUrl } from './url.js'

const DEFAULT_MODEL = 'THUDM/CogVideoX-5b'
const DEFAULT_MODEL_PATH = 'D:\\videoCreate\\models\\cogvideox-5b'
const FPS = 8

const DEFAULT_NEGATIVE_PROMPT = [
  'low quality',
  'blurry',
  'distorted anatomy',
  'extra limbs',
  'missing limbs',
  'extra fingers',
  'text',
  'watermark',
  'jitter',
  'flicker',
  'static image',
].join(', ')

interface ComfyOutputFile {
  filename?: string
  subfolder?: string
  type?: string
}

export class ComfyUIVideoAdapter implements VideoProviderAdapter {
  provider = 'comfyui'

  buildGenerateRequest(config: AIConfig, record: VideoGenerationRecord): ProviderRequest {
    const prompt = (record.prompt || '').trim()
    if (!prompt) throw new Error('ComfyUI CogVideoX 要求必须提供提示词')

    const model = normalizeModel(record.model || config.model)
    const modelPath = (process.env.COMFYUI_COGVIDEOX_MODEL_PATH || DEFAULT_MODEL_PATH).trim()
    const { width, height } = normalizeDimensions(record.aspectRatio)
    const numFrames = normalizeFrameCount(record.duration)

    const workflow = {
      '1': {
        inputs: {
          load_device: 'main_device',
          precision: 'bf16',
          attention_mode: 'sdpa',
          quantization: 'disabled',
          enable_sequential_cpu_offload: false,
          model,
        },
        class_type: 'DownloadAndLoadCogVideoModel',
      },
      '2': {
        inputs: {
          model_path: modelPath,
          max_length: 226,
          prompt,
          precision: 'bf16',
          negative_prompt: DEFAULT_NEGATIVE_PROMPT,
        },
        class_type: 'CogVideoLocalDualTextEncode',
      },
      '3': {
        inputs: { height, width, batch_size: 1 },
        class_type: 'EmptyLatentImage',
      },
      '4': {
        inputs: {
          steps: 20,
          samples: ['3', 0],
          seed: randomInt(0, 2_147_483_647),
          positive: ['2', 0],
          negative: ['2', 1],
          num_frames: numFrames,
          model: ['1', 0],
          cfg: 6,
          denoise_strength: 1,
          scheduler: 'CogVideoXDDIM',
        },
        class_type: 'CogVideoSampler',
      },
      '5': {
        inputs: {
          tile_overlap_factor_height: 0.2,
          tile_sample_min_height: 240,
          tile_sample_min_width: 360,
          vae: ['1', 1],
          tile_overlap_factor_width: 0.2,
          samples: ['4', 0],
          enable_vae_tiling: true,
          auto_tile_size: true,
        },
        class_type: 'CogVideoDecode',
      },
      '6': {
        inputs: {
          bit_depth: 'auto',
          color_space: 'sRGB',
          images: ['5', 0],
          fps: FPS,
        },
        class_type: 'CreateVideo',
      },
      '7': {
        inputs: {
          filename_prefix: `video/cineverse_cogvideox_${record.id}`,
          format: 'mp4',
          video: ['6', 0],
          codec: 'h264',
        },
        class_type: 'SaveVideo',
      },
    }

    return {
      url: joinProviderUrl(config.baseUrl, '', '/prompt'),
      method: 'POST',
      headers: buildHeaders(config.apiKey, true),
      body: { prompt: workflow },
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    const promptId = result?.prompt_id
    if (!promptId) {
      const message = result?.error?.message || result?.error || 'No prompt_id in ComfyUI response'
      throw new Error(String(message))
    }
    return { isAsync: true, taskId: String(promptId) }
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: joinProviderUrl(config.baseUrl, '', `/history/${encodeURIComponent(taskId)}`),
      method: 'GET',
      headers: buildHeaders(config.apiKey),
      body: undefined,
    }
  }

  parsePollResponse(result: any, config?: AIConfig, taskId?: string): VideoPollResponse {
    const history = taskId ? result?.[taskId] : Object.values(result || {})[0]
    if (!history || typeof history !== 'object') return { status: 'processing' }

    const entry = history as any
    if (entry.status?.status_str === 'error') {
      return { status: 'failed', error: extractExecutionError(entry.status) }
    }
    if (!entry.status?.completed) return { status: 'processing' }

    const output = findVideoOutput(entry.outputs)
    if (!output?.filename) {
      return { status: 'failed', error: 'ComfyUI 已完成任务，但没有找到 MP4/WebM 视频输出' }
    }
    if (!config?.baseUrl) {
      return { status: 'failed', error: 'ComfyUI Base URL 缺失，无法读取视频输出' }
    }

    const viewUrl = new URL(joinProviderUrl(config.baseUrl, '', '/view'))
    viewUrl.searchParams.set('filename', output.filename)
    viewUrl.searchParams.set('subfolder', output.subfolder || '')
    viewUrl.searchParams.set('type', output.type || 'output')
    return { status: 'completed', videoUrl: viewUrl.toString() }
  }

  extractVideoUrl(): string | null {
    return null
  }
}

function buildHeaders(apiKey: string, withJson = false): Record<string, string> {
  const headers: Record<string, string> = {}
  if (withJson) headers['Content-Type'] = 'application/json'
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  return headers
}

function normalizeModel(rawModel?: string | null): string {
  const model = (rawModel || DEFAULT_MODEL).trim()
  if (model.toLowerCase() === 'cogvideox-5b' || model.toLowerCase() === DEFAULT_MODEL.toLowerCase()) {
    return DEFAULT_MODEL
  }
  throw new Error(`当前 ComfyUI 工作流仅支持 ${DEFAULT_MODEL}，当前: ${model}`)
}

function normalizeFrameCount(duration?: number | null): number {
  const parsed = Number(duration || 5)
  const seconds = Number.isFinite(parsed) ? Math.min(6, Math.max(2, parsed)) : 5
  return Math.round(seconds * FPS) + 1
}

function normalizeDimensions(aspectRatio?: string | null): { width: number; height: number } {
  const dimensions: Record<string, { width: number; height: number }> = {
    '9:16': { width: 480, height: 720 },
    '1:1': { width: 480, height: 480 },
    '4:3': { width: 640, height: 480 },
    '3:4': { width: 480, height: 640 },
    '21:9': { width: 720, height: 320 },
  }
  return dimensions[aspectRatio || ''] || { width: 720, height: 480 }
}

function findVideoOutput(outputs: any): ComfyOutputFile | null {
  for (const nodeOutput of Object.values(outputs || {}) as any[]) {
    for (const key of ['videos', 'gifs', 'images']) {
      const files = Array.isArray(nodeOutput?.[key]) ? nodeOutput[key] : []
      const video = files.find((file: ComfyOutputFile) => /\.(mp4|webm|mov|mkv)$/i.test(file?.filename || ''))
      if (video) return video
    }
  }
  return null
}

function extractExecutionError(status: any): string {
  const messages = Array.isArray(status?.messages) ? status.messages : []
  for (const message of [...messages].reverse()) {
    const payload = Array.isArray(message) ? message[1] : message
    const detail = payload?.exception_message || payload?.error || payload?.message
    if (detail) return String(detail)
  }
  return 'ComfyUI 视频生成失败'
}
