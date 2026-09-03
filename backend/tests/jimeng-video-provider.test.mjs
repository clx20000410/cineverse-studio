import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('backend registers Jimeng as an official video provider', () => {
  const ai = read('src/services/ai.ts')
  const registry = read('src/services/adapters/registry.ts')
  const route = read('src/routes/aiConfigs.ts')

  assert.match(ai, /video:\s*\[[^\]]*'jimeng'/)
  assert.match(registry, /JimengVideoAdapter/)
  assert.match(registry, /jimeng:\s*new JimengVideoAdapter\(\)/)
  assert.match(route, /p === 'jimeng'/)
  assert.match(route, /joinProviderUrl\(baseUrl, '\/v1', '\/models'\)/)
  assert.match(route, /searchParams\.set\('type', 'video'\)/)
})

test('settings page exposes a local Jimeng Seedance template', () => {
  const settingsPage = read('../frontend/app/pages/settings.vue')

  assert.match(settingsPage, /const providers = \[[^\]]*'jimeng'/)
  assert.match(settingsPage, /本地即梦 · Seedance/)
  assert.match(settingsPage, /http:\/\/host\.docker\.internal:8000/)
  assert.match(settingsPage, /jimeng-video-seedance-2\.5/)
  assert.match(settingsPage, /jimeng-video-seedance-2\.0/)
})
