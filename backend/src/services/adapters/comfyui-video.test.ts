import assert from 'node:assert/strict'
import test from 'node:test'
import { ComfyUIVideoAdapter } from './comfyui-video.js'

const config = {
  provider: 'comfyui',
  baseUrl: 'http://host.docker.internal:8189/',
  apiKey: '',
  model: 'THUDM/CogVideoX-5b',
}

test('builds a CogVideoX workflow request for ComfyUI', () => {
  const adapter = new ComfyUIVideoAdapter()
  const request = adapter.buildGenerateRequest(config, {
    id: 42,
    prompt: 'A cinematic sunrise over the mountains',
    duration: 3,
    aspectRatio: '9:16',
  })

  assert.equal(request.method, 'POST')
  assert.equal(request.url, 'http://host.docker.internal:8189/prompt')
  assert.equal(request.headers['Content-Type'], 'application/json')
  assert.equal(request.headers.Authorization, undefined)
  assert.equal(request.body.prompt['1'].inputs.model, 'THUDM/CogVideoX-5b')
  assert.equal(request.body.prompt['2'].inputs.model_path, 'D:\\videoCreate\\models\\cogvideox-5b')
  assert.equal(request.body.prompt['2'].inputs.prompt, 'A cinematic sunrise over the mountains')
  assert.equal(request.body.prompt['3'].inputs.width, 480)
  assert.equal(request.body.prompt['3'].inputs.height, 720)
  assert.equal(request.body.prompt['4'].inputs.num_frames, 25)
  assert.match(request.body.prompt['7'].inputs.filename_prefix, /^video\/cineverse_cogvideox_42$/)
})

test('parses a ComfyUI prompt id and builds its history request', () => {
  const adapter = new ComfyUIVideoAdapter()
  assert.deepEqual(adapter.parseGenerateResponse({ prompt_id: 'prompt-123' }), {
    isAsync: true,
    taskId: 'prompt-123',
  })

  const poll = adapter.buildPollRequest(config, 'prompt-123')
  assert.equal(poll.method, 'GET')
  assert.equal(poll.url, 'http://host.docker.internal:8189/history/prompt-123')
})

test('returns processing while ComfyUI has no history entry', () => {
  const adapter = new ComfyUIVideoAdapter()
  assert.deepEqual(adapter.parsePollResponse({}, config, 'prompt-123'), {
    status: 'processing',
  })
})

test('turns a completed SaveVideo output into a ComfyUI view URL', () => {
  const adapter = new ComfyUIVideoAdapter()
  const response = adapter.parsePollResponse({
    'prompt-123': {
      status: { status_str: 'success', completed: true },
      outputs: {
        '7': {
          images: [{
            filename: 'cineverse output_00001_.mp4',
            subfolder: 'video',
            type: 'output',
          }],
          animated: [true],
        },
      },
    },
  }, config, 'prompt-123')

  assert.equal(response.status, 'completed')
  assert.equal(
    response.videoUrl,
    'http://host.docker.internal:8189/view?filename=cineverse+output_00001_.mp4&subfolder=video&type=output',
  )
})

test('surfaces ComfyUI execution errors', () => {
  const adapter = new ComfyUIVideoAdapter()
  const response = adapter.parsePollResponse({
    'prompt-123': {
      status: {
        status_str: 'error',
        completed: false,
        messages: [[
          'execution_error',
          { exception_message: 'CUDA out of memory' },
        ]],
      },
      outputs: {},
    },
  }, config, 'prompt-123')

  assert.deepEqual(response, {
    status: 'failed',
    error: 'CUDA out of memory',
  })
})
