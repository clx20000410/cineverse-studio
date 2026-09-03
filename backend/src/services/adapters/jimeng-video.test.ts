import assert from 'node:assert/strict'
import test from 'node:test'
import { JimengVideoAdapter } from './jimeng-video.js'

const config = {
  provider: 'jimeng',
  baseUrl: 'http://host.docker.internal:8000/',
  apiKey: 'jm_test_key',
  model: 'jimeng-video-seedance-2.0',
}

test('builds a synchronous Jimeng video generation request', () => {
  const adapter = new JimengVideoAdapter()
  const request = adapter.buildGenerateRequest(config, {
    id: 12,
    prompt: '雨夜里，女孩转身看向镜头',
    duration: 8,
    aspectRatio: '9:16',
    resolution: '720p',
    firstFrameUrl: 'data:image/jpeg;base64,first',
    lastFrameUrl: 'https://example.com/last.jpg',
  })

  assert.equal(request.method, 'POST')
  assert.equal(request.url, 'http://host.docker.internal:8000/v1/videos/generations')
  assert.equal(request.headers.Authorization, 'Bearer jm_test_key')
  assert.deepEqual(request.body, {
    model: 'jimeng-video-seedance-2.0',
    prompt: '雨夜里，女孩转身看向镜头',
    ratio: '9:16',
    resolution: '720p',
    duration: 8,
    file_paths: [
      'data:image/jpeg;base64,first',
      'https://example.com/last.jpg',
    ],
    response_format: 'url',
  })
})

test('uses reference images as start and end frames when explicit frames are absent', () => {
  const adapter = new JimengVideoAdapter()
  const request = adapter.buildGenerateRequest(config, {
    id: 13,
    prompt: '人物缓慢向前走',
    referenceImageUrls: JSON.stringify([
      'https://example.com/one.jpg',
      'https://example.com/two.jpg',
      'https://example.com/ignored.jpg',
    ]),
  })

  assert.deepEqual(request.body.file_paths, [
    'https://example.com/one.jpg',
    'https://example.com/two.jpg',
  ])
})

test('parses the synchronous Jimeng response URL', () => {
  const adapter = new JimengVideoAdapter()
  const response = adapter.parseGenerateResponse({
    created: 1787794197,
    data: [{ url: 'https://example.com/video.mp4' }],
  })

  assert.deepEqual(response, {
    isAsync: false,
    videoUrl: 'https://example.com/video.mp4',
  })
  assert.equal(adapter.extractVideoUrl({ data: [{ url: 'https://example.com/video.mp4' }] }), 'https://example.com/video.mp4')
})

test('rejects empty prompts and unsupported models', () => {
  const adapter = new JimengVideoAdapter()

  assert.throws(
    () => adapter.buildGenerateRequest(config, { id: 14, prompt: '  ' }),
    /必须提供提示词/,
  )
  assert.throws(
    () => adapter.buildGenerateRequest({ ...config, model: 'other-model' }, { id: 15, prompt: 'test' }),
    /仅支持即梦视频模型/,
  )
})
