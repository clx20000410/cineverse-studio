import assert from 'node:assert/strict'
import test from 'node:test'
import { getExtFromUrl } from './storage.js'

test('uses the ComfyUI filename query parameter to preserve the video extension', () => {
  assert.equal(
    getExtFromUrl('http://host.docker.internal:8189/view?filename=clip_00001_.mp4&subfolder=video&type=output'),
    '.mp4',
  )
})
