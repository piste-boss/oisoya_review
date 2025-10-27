import './style.css'

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

app.innerHTML = `
  <main class="admin">
    <header class="admin__header">
      <p class="admin__badge">大磯屋さま 口コミアプリ</p>
      <h1 class="admin__title">ルータ設定</h1>
      <p class="admin__lead">ボタンの表示文言とリンク先URLを更新できます。各レベルごとに複数のリンクを登録すると順番に案内されます。</p>
    </header>
    <form id="config-form" class="admin__form">
      <section class="admin__card">
        <h2>ボタン表示文言</h2>
        <div class="admin__fields">
          ${TIERS.map(
            ({ key, defaultLabel, description }) => `
              <label class="admin__field">
                <span class="admin__field-label">${defaultLabel}</span>
                <input
                  type="text"
                  name="${key}Label"
                  placeholder="${defaultLabel}"
                  autocomplete="off"
                />
                <span class="admin__field-hint">${description}</span>
              </label>
            `,
          ).join('')}
        </div>
      </section>
      <section class="admin__card">
        <h2>リンク設定</h2>
        <p class="admin__hint">
          1行につき1つのURLを登録します。上から順番に自動で案内され、最後まで到達すると再び最初のURLに戻ります。
        </p>
        <div class="admin__fields">
          ${TIERS.map(
            ({ key, defaultLabel }) => `
              <label class="admin__field">
                <span class="admin__field-label">${defaultLabel}リンク</span>
                <textarea
                  name="${key}Links"
                  rows="4"
                  placeholder="https://example.com/form/${key}-1"
                ></textarea>
              </label>
            `,
          ).join('')}
        </div>
      </section>
      <div class="admin__actions">
        <button type="submit" class="admin__submit">設定を保存</button>
      </div>
    </form>
    <p class="admin__status" data-role="status" hidden></p>
  </main>
`

const form = document.querySelector('#config-form')
const statusEl = document.querySelector('[data-role="status"]')

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
