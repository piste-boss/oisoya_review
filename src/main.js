const DEFAULT_LABELS = {
  beginner: 'ライトカップ',
  intermediate: 'ミディアムカップ',
  advanced: 'フルシティカップ',
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
  { key: 'beginner', defaultLabel: DEFAULT_LABELS.beginner },
  { key: 'intermediate', defaultLabel: DEFAULT_LABELS.intermediate },
  { key: 'advanced', defaultLabel: DEFAULT_LABELS.advanced },
]

const app = document.querySelector('#app')
if (!app) {
  throw new Error('#app が見つかりません。')
}

const statusEl = app.querySelector('[data-role="status"]')
const buttons = Array.from(app.querySelectorAll('[data-tier]'))

if (!statusEl || buttons.length === 0) {
  throw new Error('必要なDOM要素が初期化されていません。')
}

const cachedConfig = readCachedConfig()

let labels = {
  ...DEFAULT_LABELS,
  ...(cachedConfig?.labels ?? {}),
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

const applyLabels = () => {
  buttons.forEach((button) => {
    const tierKey = button.dataset.tier
    const label = labels[tierKey] || DEFAULT_LABELS[tierKey] || tierKey
    button.querySelector('.router__button-label').textContent = label
  })
}

const toggleButtons = (disabled) => {
  buttons.forEach((button) => {
    if (disabled) {
      button.setAttribute('disabled', '')
      button.classList.add('is-loading')
    } else {
      button.removeAttribute('disabled')
      button.classList.remove('is-loading')
    }
  })
}

const handleDistribution = async (tierKey) => {
  const label = labels[tierKey] || DEFAULT_LABELS[tierKey] || tierKey
  setStatus(`${label}へ最適なフォームを探しています…`)
  toggleButtons(true)

  try {
    const response = await fetch('/.netlify/functions/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: tierKey }),
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      const errorMessage =
        errorPayload?.message ||
        'リダイレクト先を取得できませんでした。時間をおいて再度お試しください。'
      throw new Error(errorMessage)
    }

    const payload = await response.json()
    if (!payload?.url) {
      throw new Error('リダイレクト先URLが設定されていません。')
    }

    window.location.href = payload.url
  } catch (error) {
    console.error(error)
    setStatus(error.message, 'error')
    toggleButtons(false)
  }
}

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    handleDistribution(button.dataset.tier)
  })
})

const resetUIState = () => {
  toggleButtons(false)
  setStatus('')
  const latestCached = readCachedConfig()
  labels = {
    ...DEFAULT_LABELS,
    ...(latestCached?.labels ?? {}),
  }
  applyLabels()
}

const loadConfig = async () => {
  try {
    const response = await fetch('/.netlify/functions/config')
    if (!response.ok) {
      throw new Error('設定の取得に失敗しました。デフォルト表示で続行します。')
    }
    const payload = await response.json()
    if (payload?.labels) {
      labels = { ...DEFAULT_LABELS, ...payload.labels }
      applyLabels()
      writeCachedConfig(payload)
    }
    setStatus('')
  } catch (error) {
    console.warn(error)
    const fallbackConfig = readCachedConfig()
    labels = {
      ...DEFAULT_LABELS,
      ...(fallbackConfig?.labels ?? {}),
    }
    applyLabels()
    setStatus(error.message, 'warn')
  }
}

applyLabels()
loadConfig()

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    const latestCached = readCachedConfig()
    labels = {
      ...DEFAULT_LABELS,
      ...(latestCached?.labels ?? {}),
    }
    applyLabels()
    resetUIState()
    loadConfig()
  } else {
    toggleButtons(false)
  }
})
import './style.css'
