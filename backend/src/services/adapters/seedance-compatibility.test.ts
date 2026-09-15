import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { JimengVideoAdapter } from './jimeng-video.js'

const config = {
  provider: 'jimeng', baseUrl: 'https://ai.centos.hk/', apiKey: 'test-key',
  model: 'doubao-seedance-2-0-fast-260128',
}
const adapter = new JimengVideoAdapter()
const record = { id: 12, prompt: '镜头平稳推进，人物表情自然变化' }
const image = (url: string, role = 'reference_image') => ({ type: 'image_url', role, image_url: { url } })

test('builds the documented text-to-video request with defaults and Bearer authentication', () => {
  const request = adapter.buildGenerateRequest(config, record)
  assert.equal(request.method, 'POST')
  assert.equal(request.url, 'https://ai.centos.hk/v1/videos')
  assert.equal(request.headers.Authorization, 'Bearer test-key')
  assert.equal(request.headers['Content-Type'], 'application/json')
  assert.deepEqual(request.body, {
    model: config.model, prompt: record.prompt, ratio: 'adaptive', resolution: '720p',
    duration: 5, generate_audio: true, watermark: false,
  })
})

for (const baseUrl of ['https://example.com', 'https://example.com/v1/', 'https://example.com/proxy/v1/']) {
  test(`preserves the gateway prefix without duplicating v1: ${baseUrl}`, () => {
    const prefix = baseUrl.includes('/proxy') ? '/proxy/v1' : '/v1'
    assert.equal(adapter.buildGenerateRequest({ ...config, baseUrl }, record).url, `https://example.com${prefix}/videos`)
    const poll = adapter.buildPollRequest({ ...config, baseUrl }, 'task/with space')
    assert.equal(poll.url, `https://example.com${prefix}/videos/task%2Fwith%20space`)
    assert.equal(poll.method, 'GET')
    assert.equal(poll.headers.Authorization, 'Bearer test-key')
    assert.equal(poll.body, undefined)
  })
}

test('supports mixed image, video and audio references without frame roles', () => {
  const request = adapter.buildGenerateRequest(config, {
    ...record, referenceImageUrls: JSON.stringify(['https://example.com/image.png']),
    referenceVideoUrls: JSON.stringify(['https://example.com/video.mp4']),
    referenceAudioUrls: JSON.stringify(['data:audio/mp3;base64,audio']), generateAudio: false,
  })
  assert.deepEqual(request.body.content, [
    image('https://example.com/image.png'),
    { type: 'video_url', role: 'reference_video', video_url: { url: 'https://example.com/video.mp4' } },
    { type: 'audio_url', role: 'reference_audio', audio_url: { url: 'data:audio/mp3;base64,audio' } },
  ])
  assert.equal(request.body.generate_audio, false)
})

test('supports a single explicit first frame via imageUrl', () => {
  assert.deepEqual(adapter.buildGenerateRequest(config, {
    ...record, imageUrl: 'https://example.com/start.png',
  }).body.content, [image('https://example.com/start.png', 'first_frame')])
})

for (const field of ['referenceImageUrls', 'referenceVideoUrls', 'referenceAudioUrls']) {
  test(`rejects mixing explicit frames with ${field}`, () => {
    assert.throws(() => adapter.buildGenerateRequest(config, {
      ...record, firstFrameUrl: 'https://example.com/start.png',
      [field]: JSON.stringify(['https://example.com/reference']),
    }), /不可混用/)
  })
}

test('rejects a last frame without a first frame and audio-only references', () => {
  assert.throws(() => adapter.buildGenerateRequest(config, {
    ...record, lastFrameUrl: 'https://example.com/end.png',
  }), /首帧/)
  assert.throws(() => adapter.buildGenerateRequest(config, {
    ...record, referenceAudioUrls: JSON.stringify(['https://example.com/ref.mp3']),
  }), /参考音频需要/)
})

test('accepts video plus audio without an image', () => {
  const request = adapter.buildGenerateRequest(config, {
    ...record, referenceVideoUrls: JSON.stringify(['https://example.com/ref.mp4']),
    referenceAudioUrls: JSON.stringify(['https://example.com/ref.mp3']),
  })
  assert.deepEqual(request.body.content.map((item: { role: string }) => item.role), ['reference_video', 'reference_audio'])
})

for (const [field, limit] of [['referenceImageUrls', 9], ['referenceVideoUrls', 3], ['referenceAudioUrls', 3]] as const) {
  test(`rejects excess ${field}`, () => {
    assert.throws(() => adapter.buildGenerateRequest(config, {
      ...record, referenceImageUrls: JSON.stringify(['https://example.com/image.png']),
      [field]: JSON.stringify(Array.from({ length: limit + 1 }, (_, i) => `https://example.com/${i}`)),
    }), /参考素材超限/)
  })
}

test('trims URLs and tolerates empty or malformed stored references', () => {
  assert.deepEqual(adapter.buildGenerateRequest(config, {
    ...record, referenceImageUrls: JSON.stringify(['  https://example.com/ref.png  ', '', null, 5]),
    referenceVideoUrls: '{', referenceAudioUrls: '{}',
  }).body.content, [image('https://example.com/ref.png')])
})

test('normalizes duration and aspect ratio and preserves explicit audio false', () => {
  for (const [duration, expected] of [[2, 4], [18, 15], [7.6, 8], [NaN, 5], [Infinity, 5]]) {
    assert.equal(adapter.buildGenerateRequest(config, { ...record, duration }).body.duration, expected)
  }
  for (const ratio of ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', 'adaptive']) {
    assert.equal(adapter.buildGenerateRequest(config, { ...record, aspectRatio: ratio }).body.ratio, ratio)
  }
  assert.equal(adapter.buildGenerateRequest(config, { ...record, aspectRatio: 'invalid' }).body.ratio, 'adaptive')
  for (const generateAudio of [false, 0]) {
    assert.equal(adapter.buildGenerateRequest(config, { ...record, generateAudio }).body.generate_audio, false)
  }
  assert.equal(adapter.buildGenerateRequest({ ...config, model: '' }, record).body.model, config.model)
})

test('caps Fast models at 720p but keeps standard-model 1080p', () => {
  for (const resolution of ['1080p', '2K', '4k']) {
    assert.equal(adapter.buildGenerateRequest(config, { ...record, resolution }).body.resolution, '720p')
    assert.equal(adapter.buildGenerateRequest(config, {
      ...record, model: 'doubao-seedance-2-0-260128', resolution,
    }).body.resolution, '1080p')
  }
  assert.equal(adapter.buildGenerateRequest(config, { ...record, resolution: '480p' }).body.resolution, '480p')
})

test('accepts both documented task ID fields', () => {
  for (const field of ['id', 'task_id']) {
    assert.deepEqual(adapter.parseGenerateResponse({ [field]: 'task_example', status: 'queued' }), {
      isAsync: true, taskId: 'task_example',
    })
  }
  assert.throws(() => adapter.parseGenerateResponse({}), /没有视频 URL/)
})

test('maps documented polling states and extracts metadata.url', () => {
  for (const status of ['queued', 'in_progress']) {
    assert.deepEqual(adapter.parsePollResponse({ status, progress: 30 }), { status: 'processing' })
  }
  assert.deepEqual(adapter.parsePollResponse({ status: 'completed', progress: 100,
    metadata: { url: 'https://example.com/result.mp4', total_tokens: '54789' },
  }), { status: 'completed', videoUrl: 'https://example.com/result.mp4' })
  for (const error of ['余额不足', { message: '余额不足' }]) {
    assert.deepEqual(adapter.parsePollResponse({ status: 'failed', error }), { status: 'failed', error: '余额不足' })
  }
  assert.equal(adapter.parsePollResponse({ status: 'completed' }).status, 'failed')
  assert.equal(adapter.parsePollResponse({}).status, 'pending')
})

test('submits and polls through HTTP using the documented Seedance contract', async (t) => {
  const calls: string[] = []
  let polls = 0
  const server = createServer(async (req, res) => {
    calls.push(`${req.method} ${req.url}`)
    if (req.headers.authorization !== 'Bearer test-key') {
      res.writeHead(401).end()
      return
    }
    res.setHeader('Content-Type', 'application/json')
    if (req.method === 'POST' && req.url === '/v1/videos') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = JSON.parse(Buffer.concat(chunks).toString())
      if (!body.content.every((item: { role: string }) => item.role === 'reference_image')) {
        res.writeHead(400).end(JSON.stringify({ error: 'Reference roles must not be frame roles' }))
        return
      }
      res.end(JSON.stringify({ id: 'task_example', status: 'queued' }))
      return
    }
    if (req.method === 'GET' && req.url === '/v1/videos/task_example') {
      polls++
      res.end(JSON.stringify(polls === 1 ? { status: 'in_progress', progress: 40 } : {
        status: 'completed', progress: 100, metadata: { url: 'https://example.com/result.mp4', total_tokens: '54789' },
      }))
      return
    }
    res.writeHead(404).end('{}')
  })
  t.after(() => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const localConfig = { ...config, baseUrl: `http://127.0.0.1:${address.port}/v1` }
  const request = adapter.buildGenerateRequest(localConfig, {
    ...record, referenceImageUrls: JSON.stringify(['https://example.com/ref.png']),
  })
  const response = await fetch(request.url, { ...request, body: JSON.stringify(request.body) })
  assert.equal(response.status, 200)
  const generated = adapter.parseGenerateResponse(await response.json())
  assert.equal(generated.taskId, 'task_example')
  const poll = adapter.buildPollRequest(localConfig, generated.taskId!)
  assert.equal(adapter.parsePollResponse(await (await fetch(poll.url, poll)).json()).status, 'processing')
  assert.deepEqual(adapter.parsePollResponse(await (await fetch(poll.url, poll)).json()), {
    status: 'completed', videoUrl: 'https://example.com/result.mp4',
  })
  assert.deepEqual(calls, ['POST /v1/videos', 'GET /v1/videos/task_example', 'GET /v1/videos/task_example'])
})
