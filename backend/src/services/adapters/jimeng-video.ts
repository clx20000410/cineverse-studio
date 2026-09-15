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
const REF_LIMITS = { images: 9, videos: 3, audios: 3 } as const

type SeedanceContent =
  | { type: 'image_url'; role: 'first_frame' | 'last_frame' | 'reference_image'; image_url: { url: string } }
  | { type: 'video_url'; role: 'reference_video'; video_url: { url: string } }
  | { type: 'audio_url'; role: 'reference_audio'; audio_url: { url: string } }

function parseUrlArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value)
      ? value.filter((url): url is string => typeof url === 'string' && !!url.trim()).map(url => url.trim())
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
    const videos = parseUrlArray(record.referenceVideoUrls)
    const audios = parseUrlArray(record.referenceAudioUrls)
    const firstFrame = (record.firstFrameUrl || record.imageUrl || '').trim()
    const lastFrame = (record.lastFrameUrl || '').trim()

    // 首帧、首尾帧与多模态参考互斥，不能把参考图片隐式改成首尾帧。
    if ((firstFrame || lastFrame) && references.length + videos.length + audios.length > 0) {
      throw new Error('首尾帧与多模态参考素材不可混用')
    }
    if (lastFrame && !firstFrame) throw new Error('提供尾帧时必须同时提供首帧')
    if (references.length > REF_LIMITS.images || videos.length > REF_LIMITS.videos || audios.length > REF_LIMITS.audios) {
      throw new Error('参考素材超限：图片≤9、视频≤3、音频≤3')
    }
    if (audios.length > 0 && references.length + videos.length === 0) {
      throw new Error('参考音频需要至少 1 个参考图片或视频')
    }

    const content: SeedanceContent[] = []
    if (firstFrame) content.push({ type: 'image_url', role: 'first_frame', image_url: { url: firstFrame } })
    if (lastFrame) content.push({ type: 'image_url', role: 'last_frame', image_url: { url: lastFrame } })
    for (const url of references) {
      content.push({ type: 'image_url', role: 'reference_image', image_url: { url } })
    }
    for (const url of videos) {
      content.push({ type: 'video_url', role: 'reference_video', video_url: { url } })
    }
    for (const url of audios) {
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
        resolution: this.normalizeResolution(record.resolution, model),
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

  private normalizeResolution(resolution: string | null | undefined, model: string): string {
    const value = (resolution || '').trim().toLowerCase()
    const normalized = value === '2k' || value === '4k' ? '1080p' : value
    if (normalized === '1080p' && model.startsWith('doubao-seedance-2-0-fast')) return '720p'
    return VALID_RESOLUTIONS.has(normalized) ? normalized : '720p'
  }

  private normalizeDuration(duration?: number | null): number {
    const value = Math.round(Number(duration || 5))
    if (!Number.isFinite(value)) return 5
    return Math.min(15, Math.max(4, value))
  }
}
