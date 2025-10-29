const DEFAULT_LABELS = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
}

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

const TIERS = [
  {
    key: 'beginner',
    defaultLabel: DEFAULT_LABELS.beginner,
    description: '初めての口コミ投稿におすすめのステップです。',
  },
  {
    key: 'intermediate',
    defaultLabel: DEFAULT_LABELS.intermediate,
    description: '撮影や投稿に慣れてきた方向けの質問セットです。',
  },
  {
    key: 'advanced',
    defaultLabel: DEFAULT_LABELS.advanced,
    description: '高い熱量でご協力いただけるお客さま向けのフルセットです。',
  },
]

const app = document.querySelector('#admin-app')
if (!app) {
  throw new Error('#admin-app が見つかりません。')
}

const form = app.querySelector('#config-form')
const statusEl = app.querySelector('[data-role="status"]')

if (!form || !statusEl) {
  throw new Error('管理画面の必須要素が見つかりません。')
}

const tabButtons = Array.from(app.querySelectorAll('[data-tab-target]'))
const tabPanels = Array.from(app.querySelectorAll('[data-tab-panel]'))

const aiFields = {
  geminiApiKey: form.elements.geminiApiKey,
  mapsLink: form.elements.mapsLink,
  gasUrl: form.elements.gasUrl,
  prompt: form.elements.prompt,
  model: form.elements.model,
}

const cachedConfig = readCachedConfig()
if (cachedConfig) {
  populateForm(cachedConfig)
}

const setStatus = (message, type = 'info') => {
  if (!message) {
    statusEl.textContent = ''
    statusEl.setAttribute('hidden', '')
    statusEl.dataset.type = ''
    return
  }

  statusEl.textContent = message
  statusEl.removeAttribute('hidden')
  statusEl.dataset.type = type
}

const activateTab = (target) => {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === target
    button.classList.toggle('is-active', isActive)
  })

  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === target
    panel.classList.toggle('is-active', isActive)
  })
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activateTab(button.dataset.tabTarget)
  })
})

if (tabButtons.length > 0) {
  activateTab(tabButtons[0].dataset.tabTarget)
}

function populateForm(config) {
  TIERS.forEach(({ key, defaultLabel }) => {
    const labelInput = form.elements[`${key}Label`]
    const linksInput = form.elements[`${key}Links`]

    if (labelInput) {
      labelInput.value = config.labels?.[key] ?? defaultLabel
    }

    if (linksInput) {
      const links = config.tiers?.[key]?.links ?? []
      linksInput.value = links.join('\n')
    }
  })

  const ai = config.aiSettings || {}
  if (aiFields.geminiApiKey) {
    if (ai.hasGeminiApiKey) {
      aiFields.geminiApiKey.value = ''
      aiFields.geminiApiKey.placeholder = '登録済みのキーがあります。更新する場合は新しいキーを入力'
      aiFields.geminiApiKey.dataset.registered = 'true'
    } else {
      aiFields.geminiApiKey.value = ai.geminiApiKey || ''
      aiFields.geminiApiKey.placeholder = '例: AIza...'
      delete aiFields.geminiApiKey.dataset.registered
    }
  }
  if (aiFields.mapsLink) aiFields.mapsLink.value = ai.mapsLink || ''
  if (aiFields.gasUrl) aiFields.gasUrl.value = ai.gasUrl || ''
  if (aiFields.prompt) aiFields.prompt.value = ai.prompt || ''
  if (aiFields.model) aiFields.model.value = ai.model || ''
}

const loadConfig = async () => {
  setStatus('設定を読み込み中です…')
  try {
    const response = await fetch('/.netlify/functions/config')
    if (!response.ok) {
      throw new Error('設定の取得に失敗しました。ネットワーク状況をご確認ください。')
    }
    const payload = await response.json()
    populateForm(payload)
    writeCachedConfig(payload)
    setStatus('最新の設定を読み込みました。', 'success')
  } catch (error) {
    console.error(error)
    const cached = readCachedConfig()
    if (cached) {
      populateForm(cached)
    }
    setStatus(error.message, 'error')
  }
}

const parseLinks = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const hasInvalidUrl = (value) => {
  try {
    if (!value) return false
    // eslint-disable-next-line no-new
    new URL(value)
    return false
  } catch {
    return true
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const payload = { labels: {}, tiers: {}, aiSettings: {} }
  const errors = []

  TIERS.forEach(({ key, defaultLabel }) => {
    const labelInput = form.elements[`${key}Label`]
    const linksInput = form.elements[`${key}Links`]

    const labelValue = labelInput.value.trim() || defaultLabel
    const links = parseLinks(linksInput.value)

    const invalidLink = links.find(hasInvalidUrl)
    if (invalidLink) {
      errors.push(`${defaultLabel}リンクのURL形式が正しくありません: ${invalidLink}`)
    }

    payload.labels[key] = labelValue
    payload.tiers[key] = { links }
  })

  const aiSettings = {
    geminiApiKey: (aiFields.geminiApiKey?.value || '').trim(),
    mapsLink: (aiFields.mapsLink?.value || '').trim(),
    gasUrl: (aiFields.gasUrl?.value || '').trim(),
    prompt: (aiFields.prompt?.value || '').trim(),
    model: (aiFields.model?.value || '').trim(),
  }

  const urlCandidates = [
    { value: aiSettings.mapsLink, label: 'Googleマップリンク' },
    { value: aiSettings.gasUrl, label: 'GASアプリURL' },
  ]

  urlCandidates.forEach(({ value, label }) => {
    if (!value) return
    try {
      // eslint-disable-next-line no-new
      new URL(value)
    } catch {
      errors.push(`${label} のURL形式が正しくありません。`)
    }
  })

  payload.aiSettings = aiSettings

  if (errors.length > 0) {
    setStatus(errors.join(' / '), 'error')
    return
  }

  setStatus('設定を保存しています…')
  try {
    const response = await fetch('/.netlify/functions/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      const errorMessage =
        errorPayload?.message || '保存に失敗しました。時間を空けて再度お試しください。'
      throw new Error(errorMessage)
    }

    const savedConfig = await response.json().catch(() => null)
    if (savedConfig) {
      writeCachedConfig(savedConfig)
    } else {
      writeCachedConfig({ labels: payload.labels, tiers: payload.tiers, aiSettings: payload.aiSettings })
    }

    setStatus('設定を保存しました。', 'success')
  } catch (error) {
    console.error(error)
    setStatus(error.message, 'error')
  }
})

loadConfig()

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    loadConfig()
  }
})
