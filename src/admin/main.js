const DEFAULT_LABELS = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
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

const populateForm = (config) => {
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
    setStatus('最新の設定を読み込みました。', 'success')
  } catch (error) {
    console.error(error)
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

  const payload = { labels: {}, tiers: {} }
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

    setStatus('設定を保存しました。', 'success')
  } catch (error) {
    console.error(error)
    setStatus(error.message, 'error')
  }
})

loadConfig()
