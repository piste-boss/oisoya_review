const DEFAULT_LABELS = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
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

let labels = { ...DEFAULT_LABELS }

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
    }
    setStatus('')
  } catch (error) {
    console.warn(error)
    labels = { ...DEFAULT_LABELS }
    applyLabels()
    setStatus(error.message, 'warn')
  }
}

applyLabels()
loadConfig()
import './style.css'
