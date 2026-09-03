import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync(new URL('../app/layouts/default.vue', import.meta.url), 'utf8')
const nuxtConfig = readFileSync(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
const settingsPage = readFileSync(new URL('../app/pages/settings.vue', import.meta.url), 'utf8')
const episodePage = readFileSync(new URL('../app/views/drama/episode.vue', import.meta.url), 'utf8')
const backendEntry = readFileSync(new URL('../../backend/src/index.ts', import.meta.url), 'utf8')

test('uses CineVerse Studio branding across public application surfaces', () => {
  const publicSurfaces = `${layout}\n${nuxtConfig}\n${settingsPage}\n${episodePage}\n${backendEntry}`

  assert.match(layout, /映界工坊/)
  assert.match(layout, /CineVerse Studio/)
  assert.match(layout, /cineverse-logo\.svg/)
  assert.match(nuxtConfig, /favicon\.svg/)
  assert.match(episodePage, /cineverse:workbench:panel/)
  assert.doesNotMatch(publicSurfaces, /Huobao|火宝|huobao-logo/i)
})
