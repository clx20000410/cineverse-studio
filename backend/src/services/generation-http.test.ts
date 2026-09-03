import assert from 'node:assert/strict'
import test from 'node:test'
import { getGenerationRequestTimeoutMs } from './generation-http.js'

test('allows video generation requests to run for 30 minutes', () => {
  assert.equal(getGenerationRequestTimeoutMs('video'), 30 * 60 * 1000)
})

test('keeps image generation requests at 10 minutes', () => {
  assert.equal(getGenerationRequestTimeoutMs('image'), 10 * 60 * 1000)
})
