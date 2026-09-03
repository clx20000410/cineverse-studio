<template>
  <div class="page">
    <div class="launcher-hero">
      <div class="head-left">
        <h1 class="launcher-title">项目启动台</h1>
        <p class="launcher-sub">从一个创意到一部短剧，AI 全流程为你代工</p>
        <div class="hero-stats">
          <span class="tag">{{ dramas.length }} 个项目</span>
          <span class="tag tag-success">{{ dramas.filter(d => currentStatus(d) === 'active').length }} 进行中</span>
          <span class="tag tag-accent">{{ stylePresets.length }} 种视觉风格</span>
        </div>
      </div>
      <button class="btn btn-primary" @click="showCreate = true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        新建项目
      </button>
    </div>

    <div class="toolbar">
      <label class="search-box">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input v-model.trim="searchKeyword" class="input" placeholder="搜索项目" />
      </label>
      <div class="chip-row">
        <button
          v-for="f in filters"
          :key="f.value"
          type="button"
          class="filter-chip"
          :class="{ on: statusFilter === f.value }"
          @click="statusFilter = f.value"
        >
          {{ f.label }}
        </button>
      </div>
      <select v-model="sortMode" class="input sort-select" aria-label="项目排序">
        <option value="updated">最近更新</option>
        <option value="title">项目名称</option>
      </select>
    </div>

    <div v-if="loading" class="project-grid">
      <div v-for="i in 6" :key="i" class="card skeleton-card">
        <div class="skeleton-cover"></div>
        <div class="skeleton-body">
          <div class="skeleton-line w-60"></div>
          <div class="skeleton-line w-40"></div>
        </div>
      </div>
    </div>

    <div v-else-if="filteredDramas.length" class="project-grid">
      <article
        v-for="(d, i) in filteredDramas"
        :key="d.id"
        class="card project-card"
        :style="{ animationDelay: `${i * 0.04}s` }"
        tabindex="0"
        role="button"
        :aria-label="`打开项目 ${d.title}`"
        @click="openDrama(d)"
        @keydown.enter.prevent="openDrama(d)"
        @keydown.space.prevent="openDrama(d)"
      >
        <div class="project-thumb" aria-hidden="true">
          <Film :size="34" :stroke-width="1.4" />
          <div class="status-wrap" @click.stop>
            <button type="button" class="cover-badge tag status-badge" title="点击标记项目状态" @click="statusMenuId = statusMenuId === d.id ? null : d.id">
              <span class="status-dot" :class="statusDotClass(d)"></span>
              {{ projectStatus(d) }}
            </button>
            <div v-if="statusMenuId === d.id" class="more-menu status-menu">
              <button
                v-for="s in statusOptions"
                :key="s.value"
                type="button"
                class="menu-item"
                :class="{ on: currentStatus(d) === s.value }"
                @click="setDramaStatus(d, s.value)"
              >{{ s.label }}</button>
            </div>
          </div>
          <div class="more-wrap">
            <button class="btn btn-icon btn-sm cover-more" type="button" title="更多" @click.stop="toggleMenu(d.id)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>
              </svg>
            </button>
            <div v-if="activeMenuId === d.id" class="more-menu" @click.stop>
              <button type="button" class="menu-item" @click="openDrama(d)">打开项目</button>
              <button type="button" class="menu-item is-danger" @click="activeMenuId = null; dramaToDelete = d">删除项目</button>
            </div>
          </div>
        </div>
        <div class="project-body">
          <h2 class="project-name truncate">{{ d.title }}</h2>
          <div class="project-meta">
            <span v-if="d.style" class="tag tag-accent">{{ styleLabel(d.style) }}</span>
            <span>{{ d.characters?.length || 0 }} 角色 · {{ d.scenes?.length || 0 }} 场景 · {{ d.episodes?.length || 0 }} 集</span>
          </div>
          <div class="project-foot">
            <span class="updated">
              <Clock :size="11" :stroke-width="1.8" />
              {{ fmtDate(d.updated_at || d.updatedAt) }}
            </span>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      </div>
      <p class="empty-title">{{ dramas.length ? '没有匹配的项目' : '新建第一个短剧项目' }}</p>
      <p class="empty-desc">{{ dramas.length ? '调整搜索词或筛选条件。' : '创建后选择集开始制作。' }}</p>
      <button v-if="!dramas.length" class="btn btn-primary" @click="showCreate = true">新建项目</button>
    </div>

    <div v-if="showCreate" class="overlay" @click.self="showCreate = false">
      <div class="dialog create-dialog">
        <div class="dialog-head">
          <div class="modal-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <div class="dialog-head-copy">
            <h2 class="dialog-title">新建项目</h2>
            <p class="dialog-desc">创建后进入项目页选择集</p>
          </div>
        </div>
        <form @submit.prevent="create" class="dialog-form">
          <div class="dialog-body">
            <label class="field">
              <span class="field-label">项目名称 <span class="required">*</span></span>
              <input v-model="form.title" class="input" placeholder="例如：都市情感短剧《时光邮局》" required autofocus />
            </label>
            <label class="field">
              <span class="field-label">视觉风格</span>
              <BaseSelect v-model="form.style" :options="styleSelectOptions" placeholder="选择风格" searchable />
              <span v-if="selectedStyleDesc" class="field-hint">{{ selectedStyleDesc }}</span>
            </label>
            <label class="field">
              <span class="field-label">画面比例</span>
              <BaseSelect v-model="form.aspect_ratio" :options="aspectRatioOptions" placeholder="选择画面比例" />
              <span class="field-hint">创建后固定，视频生成将统一使用该比例</span>
            </label>
          </div>
          <div class="dialog-foot">
            <button type="button" class="btn" @click="showCreate = false">取消</button>
            <button type="submit" class="btn btn-primary">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              创建项目
            </button>
          </div>
        </form>
      </div>
    </div>
    <ConfirmDialog
      :open="!!dramaToDelete"
      title="删除项目"
      :message="`确定删除「${dramaToDelete?.title}」？项目下的剧集、分镜与生成记录将一并删除，此操作不可恢复。`"
      :loading="deletingDrama"
      @confirm="confirmDelDrama"
      @cancel="dramaToDelete = null"
    />
  </div>
</template>

<script setup>
import { toast } from 'vue-sonner'
import { Film, Clock } from 'lucide-vue-next'
import { dramaAPI, stylePresetAPI } from '~/composables/useApi'
import BaseSelect from '~/components/BaseSelect.vue'

const dramas = ref([])
const loading = ref(false)
const showCreate = ref(false)
const searchKeyword = ref('')
const statusFilter = ref('all')
const sortMode = ref('updated')
const activeMenuId = ref(null)
const dramaToDelete = ref(null)
const deletingDrama = ref(false)
const form = ref({ title: '', style: '', aspect_ratio: '16:9' })
const stylePresets = ref([])
const styleSelectOptions = computed(() => stylePresets.value.map(p => ({ label: p.name, value: p.value })))
const selectedStyleDesc = computed(() => stylePresets.value.find(p => p.value === form.value.style)?.description || '')
const aspectRatioOptions = [
  { label: '16:9 · 横屏', value: '16:9' },
  { label: '9:16 · 竖屏', value: '9:16' },
  { label: '1:1 · 方形', value: '1:1' },
  { label: '自适应', value: 'adaptive' },
]
const filters = [
  { label: '全部', value: 'all' },
  { label: '待开始', value: 'draft' },
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'completed' },
]
// 项目状态由用户手动标记（持久化到 dramas.status），不再按内容自动推算
const statusOptions = [
  { label: '待开始', value: 'draft' },
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'completed' },
]
const statusMenuId = ref(null)

function currentStatus(d) { return d.status || 'draft' }
function projectStatus(d) { return statusOptions.find(s => s.value === currentStatus(d))?.label || '待开始' }
function statusDotClass(d) { return currentStatus(d) === 'active' ? 'on' : currentStatus(d) === 'completed' ? 'done' : '' }

async function setDramaStatus(d, status) {
  statusMenuId.value = null
  if (currentStatus(d) === status) return
  const prev = d.status
  d.status = status
  try {
    await dramaAPI.update(d.id, { status })
  } catch (e) {
    d.status = prev
    toast.error(e.message)
  }
}

function styleLabel(key) {
  return stylePresets.value.find(p => p.value === key)?.name || key || ''
}

const filteredDramas = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const items = dramas.value.filter((d) => {
    const text = [d.title, d.style, styleLabel(d.style), projectStatus(d)].filter(Boolean).join(' ').toLowerCase()
    const matchesSearch = !keyword || text.includes(keyword)
    const matchesStatus = statusFilter.value === 'all' || currentStatus(d) === statusFilter.value
    return matchesSearch && matchesStatus
  })

  return [...items].sort((a, b) => {
    if (sortMode.value === 'title') return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN')
    return new Date(b.updated_at || b.updatedAt || 0).getTime() - new Date(a.updated_at || a.updatedAt || 0).getTime()
  })
})

async function load() {
  loading.value = true
  try {
    const [res, presets] = await Promise.all([dramaAPI.list(), stylePresetAPI.list()])
    dramas.value = res.items || []
    stylePresets.value = presets || []
    if (!form.value.style && stylePresets.value.length) {
      form.value.style = stylePresets.value[0].value
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

async function create() {
  if (!form.value.title?.trim()) return
  try {
    const d = await dramaAPI.create(form.value)
    showCreate.value = false
    navigateTo(`/drama/${d.id}`)
  } catch (e) {
    toast.error(e.message)
  }
}

async function confirmDelDrama() {
  const d = dramaToDelete.value
  if (!d) return
  try {
    deletingDrama.value = true
    await dramaAPI.del(d.id)
    toast.success('已删除')
    dramaToDelete.value = null
    load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    deletingDrama.value = false
  }
}

function toggleMenu(id) {
  activeMenuId.value = activeMenuId.value === id ? null : id
}

function getEpisodeNumber(d) {
  const episodes = [...(d.episodes || [])]
  if (!episodes.length) return 1
  episodes.sort((a, b) => Number(a.episode_number || a.episodeNumber || 1) - Number(b.episode_number || b.episodeNumber || 1))
  return Number(episodes[0].episode_number || episodes[0].episodeNumber || 1)
}

function getDramaPath(d) {
  return `/drama/${d.id}`
}

function openDrama(d) {
  activeMenuId.value = null
  navigateTo(getDramaPath(d))
}

function latestEpisodeLabel(d) {
  if (!d.episodes?.length) return '暂无剧集'
  return `第 ${getEpisodeNumber(d)} 集`
}

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.page {
  padding: 40px 48px 64px;
  overflow-y: auto;
  height: 100%;
  animation: fadeUp 0.35s var(--ease-out) both;
  background: var(--surface-base);
}

.launcher-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--sp-6);
  padding: var(--sp-4) 0 var(--sp-6);
}
.head-left { display: flex; flex-direction: column; }
.launcher-title {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: 0;
  color: var(--text-0);
}
.launcher-sub { color: var(--text-2); font-size: 14px; margin-top: 4px; }
.hero-stats { display: flex; gap: var(--sp-2); margin-top: var(--sp-3); }

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-5);
}
.search-box { position: relative; width: 260px; flex: 0 0 auto; }
.search-box svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-3);
  pointer-events: none;
}
.search-box .input {
  padding-left: 34px;
  border-radius: var(--radius-pill);
  border-color: var(--border);
  background: rgba(0, 0, 0, 0.04);
}
.search-box .input:focus { background: #fff; }
.chip-row { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 1px; }
.filter-chip {
  appearance: none;
  cursor: pointer;
  padding: 6px 14px;
  border: none;
  border-radius: var(--radius-pill);
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.16s var(--ease-out);
}
.filter-chip:hover { color: var(--text-0); background: rgba(0, 0, 0, 0.08); }
.filter-chip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3.5px var(--button-focus);
}
.filter-chip.on { background: var(--text-0); color: #fff; }
.sort-select {
  margin-left: auto;
  width: auto;
  min-width: 132px;
  min-height: 36px;
  border-radius: var(--radius-pill);
  border-color: var(--border);
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-1);
}
.sort-select:focus { background: #fff; }

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(258px, 1fr));
  gap: var(--sp-5);
}
.project-card {
  position: relative;
  overflow: hidden;
  cursor: pointer;
  animation: fadeUp 0.32s var(--ease-out) both;
}
.project-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lift); }
.project-card:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3.5px var(--button-focus);
}
.project-thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e3edff;
  color: #4a6fb5;
}
.cover-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  gap: 6px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  color: var(--text-1);
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-3);
}
.status-dot.on { background: var(--success); }
.status-dot.done { background: var(--accent); }
.status-wrap { position: absolute; top: 10px; left: 10px; }
.status-wrap .cover-badge { position: static; }
.status-badge { cursor: pointer; border: none; font: inherit; }
.status-menu {
  top: calc(100% + 6px);
  left: 0;
  right: auto;
  width: 108px;
}
.status-menu .menu-item.on { color: var(--accent); background: var(--accent-bg); }
.more-wrap {
  position: absolute;
  top: 8px;
  right: 8px;
}
.cover-more {
  width: 30px;
  min-width: 30px;
  height: 30px;
  min-height: 30px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--text-1);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  opacity: 0;
  transition: opacity 0.15s var(--ease-out), background 0.15s var(--ease-out);
}
.cover-more:hover { background: #fff; }
.project-card:hover .cover-more,
.more-wrap:focus-within .cover-more { opacity: 1; }
.more-menu {
  position: absolute;
  top: 36px;
  right: 0;
  width: 138px;
  display: grid;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-raised);
  box-shadow: var(--shadow-lg);
  z-index: 5;
}
.menu-item {
  min-height: var(--button-height-sm);
  display: flex;
  align-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-1);
  padding: 0 9px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.14s var(--ease-out);
}
.menu-item:hover { background: var(--bg-hover); color: var(--text-0); }
.menu-item:focus-visible {
  outline: none;
  background: var(--bg-hover);
  box-shadow: 0 0 0 2px var(--button-focus);
}
.menu-item.is-danger { color: var(--action-danger); }
.menu-item.is-danger:hover { background: var(--action-danger-bg); color: var(--action-danger); }

.project-body { padding: var(--sp-4); }
.project-name {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--text-0);
}
.project-meta {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-2);
  flex-wrap: wrap;
}
.project-foot {
  margin-top: var(--sp-3);
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.project-foot .updated {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
}

.skeleton-card { overflow: hidden; }
.skeleton-cover {
  aspect-ratio: 16 / 9;
  background: var(--bg-2);
  animation: skeleton-pulse 1.4s ease-in-out infinite alternate;
}
.skeleton-body { padding: var(--sp-4); display: grid; gap: 10px; }
.skeleton-line {
  height: 12px;
  border-radius: 99px;
  background: var(--bg-2);
  animation: skeleton-pulse 1.4s ease-in-out infinite alternate;
}
.skeleton-line.w-60 { width: 60%; }
.skeleton-line.w-40 { width: 40%; }
@keyframes skeleton-pulse { to { opacity: 0.55; } }

.empty-state {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  text-align: center;
}
.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  background: var(--bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  margin-bottom: 4px;
}
.empty-title { font-size: 14px; font-weight: 700; color: var(--text-1); }
.empty-desc { font-size: 12px; color: var(--text-3); max-width: 240px; line-height: 1.6; }

.create-dialog { width: 460px; max-width: calc(100vw - 32px); }
.dialog-head-copy { display: flex; flex-direction: column; gap: 2px; }
.dialog-desc { font-size: 12.5px; color: var(--text-3); }
.modal-icon {
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: var(--radius);
  background: var(--accent-bg);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dialog-form {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.dialog-body { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-1); }
.required { color: var(--error); }
.field-hint { font-size: 11px; color: var(--text-3); line-height: 1.5; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

@media (max-width: 760px) {
  .page { padding: 24px 16px 40px; }
  .launcher-hero {
    flex-direction: column;
    align-items: stretch;
    gap: var(--sp-4);
  }
  .launcher-hero .btn { width: 100%; }
  .toolbar { flex-wrap: wrap; }
  .search-box { width: 100%; flex: 1 1 100%; }
  .sort-select { margin-left: 0; flex: 1; }
  .field-row { grid-template-columns: 1fr; }
  .dialog-foot { flex-direction: column-reverse; }
  .dialog-foot .btn { width: 100%; }
}
</style>
