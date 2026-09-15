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
  assert.match(route, /joinProviderUrl\(baseUrl, '\/v1', '\/videos\/__probe__'\)/)
})

test('settings page exposes the documented Seedance gateway through the Jimeng adapter', () => {
  const settingsPage = read('../frontend/app/pages/settings.vue')

  assert.match(settingsPage, /const providers = \[[^\]]*'jimeng'/)
  assert.match(settingsPage, /jimeng: \{ label: '即梦 · Seedance API', baseUrl: 'https:\/\/ai\.centos\.hk'/)
  assert.match(settingsPage, /service_type: 'video', provider: 'jimeng', name: '聚合视频服务 · Seedance', base_url: 'https:\/\/ai\.centos\.hk'/)
  assert.match(settingsPage, /doubao-seedance-2-0-fast-260128/)
  assert.match(settingsPage, /doubao-seedance-2-0-260128/)
})
