import { Agent } from 'undici'

type GenerationType = 'image' | 'video'

const IMAGE_GENERATION_TIMEOUT_MS = 10 * 60 * 1000
const VIDEO_GENERATION_TIMEOUT_MS = 30 * 60 * 1000

export const generationHttpAgent = new Agent({
  headersTimeout: VIDEO_GENERATION_TIMEOUT_MS,
  bodyTimeout: VIDEO_GENERATION_TIMEOUT_MS,
})

export function getGenerationRequestTimeoutMs(type: GenerationType): number {
  return type === 'video' ? VIDEO_GENERATION_TIMEOUT_MS : IMAGE_GENERATION_TIMEOUT_MS
}
