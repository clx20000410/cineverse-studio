/**
 * 即梦/Seedance 视频生成 Adapter
 * 端点: POST /v1/videos，创建异步任务；GET /v1/videos/{id} 查询结果。
 * 模型名称由上游服务决定，不在客户端强制添加或校验前缀。
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

const DEFAULT_MODEL = 'doubao-seedance-2-0-fast-260128'
const VALID_RATIOS = new Set(['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', 'adaptive'])
const VALID_RESOLUTIONS = new Set(['480p', '720p', '1080p'])

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

    const prompt = (record.prompt || '').trim()
    if (!prompt) throw new Error('即梦视频生成必须提供提示词')

    const references = parseUrlArray(record.referenceImageUrls)
    const firstFrame = (record.firstFrameUrl || record.imageUrl || references[0] || '').trim()
    const lastFrame = (record.lastFrameUrl || references[1] || '').trim()
    const content: any[] = []
    if (firstFrame) content.push({ type: 'image_url', role: 'first_frame', image_url: { url: firstFrame } })
    if (lastFrame) content.push({ type: 'image_url', role: 'last_frame', image_url: { url: lastFrame } })
    for (const url of references.slice(2)) {
      content.push({ type: 'image_url', role: 'reference_image', image_url: { url } })
    }
    for (const url of parseUrlArray(record.referenceVideoUrls)) {
      content.push({ type: 'video_url', role: 'reference_video', video_url: { url } })
    }
    for (const url of parseUrlArray(record.referenceAudioUrls)) {
      content.push({ type: 'audio_url', role: 'reference_audio', audio_url: { url } })
    }

    return {
      url: joinProviderUrl(config.baseUrl, '/v1', '/videos'),
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
        generate_audio: record.generateAudio !== 0 && record.generateAudio !== false,
        watermark: false,
        ...(content.length ? { content } : {}),
      },
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    const taskId = result?.id || result?.task_id
    if (taskId) return { isAsync: true, taskId: String(taskId) }
    const videoUrl = this.extractVideoUrl(result)
    if (!videoUrl) throw new Error('即梦响应中没有视频 URL')
    return { isAsync: false, videoUrl }
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: joinProviderUrl(config.baseUrl, '/v1', `/videos/${encodeURIComponent(taskId)}`),
      method: 'GET',
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
      body: undefined,
    }
  }

  parsePollResponse(result: any): VideoPollResponse {
    const status = String(result?.status || '').toLowerCase()
    if (status === 'completed' || status === 'succeeded') {
      const videoUrl = this.extractVideoUrl(result)
      return videoUrl ? { status: 'completed', videoUrl } : { status: 'failed', error: '即梦响应中没有视频 URL' }
    }
    if (status === 'failed' || status === 'error') {
      const error = result?.error
      const message = typeof error === 'string' ? error : error?.message || JSON.stringify(error) || 'Video generation failed'
      return { status: 'failed', error: message }
    }
    return { status: status === 'queued' || status === 'in_progress' ? 'processing' : 'pending' }
  }

  extractVideoUrl(result: any): string | null {
    return result?.metadata?.url || result?.video_url || result?.content?.video_url || result?.data?.[0]?.url || result?.url || null
  }

  private normalizeRatio(ratio?: string | null): string {
    const value = (ratio || '').trim()
    return VALID_RATIOS.has(value) ? value : 'adaptive'
  }

  private normalizeResolution(resolution?: string | null): string {
    const value = (resolution || '').trim().toLowerCase()
    if (value === '2k' || value === '4k') return '1080p'
    return VALID_RESOLUTIONS.has(value) ? value : '720p'
  }

  private normalizeDuration(duration?: number | null): number {
    const value = Math.round(Number(duration || 5))
    if (!Number.isFinite(value)) return 5
    return Math.min(15, Math.max(4, value))
  }
}
