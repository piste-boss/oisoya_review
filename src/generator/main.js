const CONFIG_CACHE_KEY = 'oisoya_review_config_cache'

const readCachedConfig = () => {
  try {
    const value = window.localStorage.getItem(CONFIG_CACHE_KEY)
    if (!value) return null
    return JSON.parse(value)
  } catch {
    return null
  }
}

const writeCachedConfig = (config) => {
  try {
    window.localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config))
  } catch {
    // noop
  }
}

const app = document.querySelector('#generator-app')
if (!app) {
  throw new Error('#generator-app が見つかりません。')
}

const generateButton = app.querySelector('[data-role="generate"]')
const copyButton = app.querySelector('[data-role="copy"]')
const textarea = app.querySelector('#generated-text')
const statusEl = app.querySelector('[data-role="status"]')
const mapsLinkEl = app.querySelector('[data-role="maps-link"]')
const promptKey = app.dataset.promptKey || 'page1'
const tierKey = app.dataset.tier || ''

if (!generateButton || !copyButton || !textarea || !statusEl || !mapsLinkEl) {
  throw new Error('口コミ生成画面の初期化に失敗しました。')
}

const setStatus = (message, type = 'info') => {
  if (!message) {
    statusEl.setAttribute('hidden', '')
    statusEl.textContent = ''
    statusEl.dataset.type = ''
    return
  }

  statusEl.removeAttribute('hidden')
  statusEl.textContent = message
  statusEl.dataset.type = type
}

const applyMapsLink = (link) => {
  if (link) {
    mapsLinkEl.href = link
    mapsLinkEl.removeAttribute('aria-disabled')
  } else {
    mapsLinkEl.href = '#'
    mapsLinkEl.setAttribute('aria-disabled', 'true')
  }
}

let currentConfig = readCachedConfig() || {}
if (currentConfig.aiSettings) {
  applyMapsLink(currentConfig.aiSettings.mapsLink)
}

const toggleLoading = (isLoading) => {
  if (isLoading) {
    generateButton.setAttribute('disabled', '')
    generateButton.textContent = '生成中…'
  } else {
    generateButton.removeAttribute('disabled')
    generateButton.textContent = '口コミ生成'
  }
}

const handleGenerate = async () => {
  setStatus('口コミを生成しています…')
  toggleLoading(true)

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptKey, tier: tierKey }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      const message =
        payload?.message ||
        '口コミ生成に失敗しました。時間をおいて再度お試しください。'
      throw new Error(message)
    }

    const payload = await response.json()
    const text = payload?.text?.trim()
    if (!text) {
      throw new Error('生成結果が空でした。設定を確認してください。')
    }

    textarea.value = text
    const latestMapsLink = payload?.mapsLink || currentConfig?.aiSettings?.mapsLink
    applyMapsLink(latestMapsLink)

    currentConfig = {
      ...currentConfig,
      aiSettings: {
        ...(currentConfig.aiSettings || {}),
        ...(payload?.aiSettings || {}),
        mapsLink: latestMapsLink,
      },
      prompts: {
        ...(currentConfig.prompts || {}),
        ...(payload?.prompts || {}),
      },
    }

    writeCachedConfig(currentConfig)

    setStatus('口コミを生成しました。', 'success')
  } catch (error) {
    console.error(error)
    setStatus(error.message, 'error')
  } finally {
    toggleLoading(false)
  }
}

generateButton.addEventListener('click', () => {
  handleGenerate()
})

copyButton.addEventListener('click', async () => {
  const text = textarea.value.trim()
  if (!text) {
    setStatus('コピーする文章がありません。先に口コミを生成してください。', 'warn')
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    setStatus('クリップボードにコピーしました。', 'success')
  } catch (error) {
    console.error(error)
    setStatus('コピーに失敗しました。手動で選択してコピーしてください。', 'error')
  }
})

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    const latest = readCachedConfig()
    if (latest) {
      currentConfig = latest
      if (latest.aiSettings) {
        applyMapsLink(latest.aiSettings.mapsLink)
      }
    }
    setStatus('ページを再読み込みしました。', 'info')
  }
})
