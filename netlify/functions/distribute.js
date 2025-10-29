import { getConfigStore } from './_lib/store.js'

const CONFIG_KEY = 'router-config'

const DEFAULT_CONFIG = {
  labels: {
    beginner: '初級',
    intermediate: '中級',
    advanced: '上級',
  },
  tiers: {
    beginner: { links: [], nextIndex: 0 },
    intermediate: { links: [], nextIndex: 0 },
    advanced: { links: [], nextIndex: 0 },
  },
  aiSettings: {
    gasUrl: '',
    geminiApiKey: '',
    prompt: '',
    mapsLink: '',
    model: '',
  },
  updatedAt: null,
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const jsonResponse = (statusCode, payload = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders,
  },
  body: JSON.stringify(payload),
})

const mergeWithDefault = (config = {}) => {
  const mergedLabels = { ...DEFAULT_CONFIG.labels, ...(config.labels || {}) }

  const mergedTiers = Object.entries(DEFAULT_CONFIG.tiers).reduce((acc, [tierKey, defaults]) => {
    const storedTier = config.tiers?.[tierKey] || defaults
    const links = Array.isArray(storedTier.links) ? storedTier.links : []
    const nextIndex = Number.isInteger(storedTier.nextIndex) ? storedTier.nextIndex : 0
    acc[tierKey] = {
      links,
      nextIndex: links.length > 0 ? nextIndex % links.length : 0,
    }
    return acc
  }, {})

  const sanitizeString = (value) => (typeof value === 'string' ? value : '')
  const mergedAiSettings = {
    gasUrl: sanitizeString(config.aiSettings?.gasUrl),
    geminiApiKey: sanitizeString(config.aiSettings?.geminiApiKey),
    prompt: sanitizeString(config.aiSettings?.prompt),
    mapsLink: sanitizeString(config.aiSettings?.mapsLink),
    model: sanitizeString(config.aiSettings?.model),
  }

  return {
    ...DEFAULT_CONFIG,
    ...config,
    labels: mergedLabels,
    tiers: mergedTiers,
    aiSettings: mergedAiSettings,
  }
}

const fetchConfig = async (store) => {
  const storedConfig = await store.get(CONFIG_KEY, { type: 'json' }).catch(() => null)
  return mergeWithDefault(storedConfig || DEFAULT_CONFIG)
}

const persistConfig = async (store, config) => {
  await store.set(CONFIG_KEY, JSON.stringify(config), {
    contentType: 'application/json',
    metadata: { updatedAt: config.updatedAt || new Date().toISOString() },
  })
}

export const handler = async (event) => {
  const store = getConfigStore()

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
    }
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { message: 'POSTメソッドのみ利用できます。' })
  }

  if (!event.body) {
    return jsonResponse(400, { message: 'リクエストボディが空です。' })
  }

  let payload
  try {
    payload = JSON.parse(event.body)
  } catch {
    return jsonResponse(400, { message: 'JSON形式が正しくありません。' })
  }

  const tierKey = String(payload?.tier || '').toLowerCase()

  if (!tierKey) {
    return jsonResponse(400, { message: 'tierパラメータを指定してください。' })
  }

  const config = await fetchConfig(store)
  const tierConfig = config.tiers?.[tierKey]

  if (!tierConfig) {
    return jsonResponse(404, { message: `${tierKey}はサポートされていません。` })
  }

  if (!Array.isArray(tierConfig.links) || tierConfig.links.length === 0) {
    return jsonResponse(404, {
      message: `${config.labels?.[tierKey] || tierKey}のリンクが設定されていません。`,
    })
  }

  const nextIndex = tierConfig.nextIndex ?? 0
  const safeIndex = tierConfig.links.length > 0 ? nextIndex % tierConfig.links.length : 0
  const destination = tierConfig.links[safeIndex]

  const timestamp = new Date().toISOString()

  // update pointer for next call
  tierConfig.nextIndex = (safeIndex + 1) % tierConfig.links.length
  tierConfig.lastServedAt = timestamp
  config.updatedAt = timestamp

  await persistConfig(store, config)

  return jsonResponse(200, {
    url: destination,
    tier: tierKey,
    label: config.labels?.[tierKey] || tierKey,
  })
}
