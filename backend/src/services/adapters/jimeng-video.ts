/**
 * 本地即梦视频生成 Adapter
 * 端点: POST /v1/videos/generations
 * 响应: { data: [{ url: "..." }] }
 */
import type {
  AIConfig,
  ProviderRequest,
  VideoGenerationRecord,
  VideoGenResponse,
  VideoPollResponse,
  VideoProviderAdapter,
} from './types'
import { joinProviderUrl } from './url'

const DEFAULT_MODEL = 'jimeng-video-seedance-2.5'
const MODEL_PREFIX = 'jimeng-video-'
const VALID_RATIOS = new Set(['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'])
const VALID_RESOLUTIONS = new Set(['720p', '1080p', '4k'])

function parseUrlArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value)
      ? value.filter((url): url is string => typeof url === 'string' && !!url.trim())
      : []
  } catch {
    return []
  }
}

export class JimengVideoAdapter implements VideoProviderAdapter {
  provider = 'jimeng'

  buildGenerateRequest(config: AIConfig, record: VideoGenerationRecord): ProviderRequest {
    const model = record.model || config.model || DEFAULT_MODEL
    if (!model.startsWith(MODEL_PREFIX)) {
      throw new Error(`仅支持即梦视频模型（${MODEL_PREFIX}*），当前: ${model}`)
    }

    const prompt = (record.prompt || '').trim()
    if (!prompt) throw new Error('即梦视频生成必须提供提示词')

    const references = parseUrlArray(record.referenceImageUrls)
    const firstFrame = (record.firstFrameUrl || record.imageUrl || references[0] || '').trim()
    const lastFrame = (record.lastFrameUrl || references[1] || '').trim()
    const filePaths = [firstFrame, lastFrame].filter(Boolean)

    return {
      url: joinProviderUrl(config.baseUrl, '/v1', '/videos/generations'),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: {
        model,
        prompt,
        ratio: this.normalizeRatio(record.aspectRatio),
        resolution: this.normalizeResolution(record.resolution),
        duration: this.normalizeDuration(record.duration),
        file_paths: filePaths,
        response_format: 'url',
      },
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    const videoUrl = this.extractVideoUrl(result)
    if (!videoUrl) throw new Error('即梦响应中没有视频 URL')
    return { isAsync: false, videoUrl }
  }

  buildPollRequest(): ProviderRequest {
    throw new Error('即梦视频接口为同步响应，不需要轮询')
  }

  parsePollResponse(): VideoPollResponse {
    return { status: 'failed', error: '即梦视频接口为同步响应，不需要轮询' }
  }

  extractVideoUrl(result: any): string | null {
    return result?.data?.[0]?.url || result?.video_url || result?.url || null
  }

  private normalizeRatio(ratio?: string | null): string {
    const value = (ratio || '').trim()
    return VALID_RATIOS.has(value) ? value : '16:9'
  }

  private normalizeResolution(resolution?: string | null): string {
    const value = (resolution || '').trim().toLowerCase()
    if (value === '2k') return '1080p'
    return VALID_RESOLUTIONS.has(value) ? value : '720p'
  }

  private normalizeDuration(duration?: number | null): number {
    const value = Math.round(Number(duration || 5))
    if (!Number.isFinite(value)) return 5
    return Math.min(15, Math.max(4, value))
  }
}
