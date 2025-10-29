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
  updatedAt: null,
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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
    const storedTier = config.tiers?.[tierKey] || {}
    acc[tierKey] = {
      links: Array.isArray(storedTier.links) ? storedTier.links : [],
      nextIndex: Number.isInteger(storedTier.nextIndex) ? storedTier.nextIndex % Math.max(storedTier.links?.length || 1, 1) : 0,
    }
    return acc
  }, {})

  return {
    ...DEFAULT_CONFIG,
    ...config,
    labels: mergedLabels,
    tiers: mergedTiers,
    updatedAt: config.updatedAt || DEFAULT_CONFIG.updatedAt,
  }
}

export const handler = async (event) => {
  const store = getConfigStore()

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
    }
  }

  if (event.httpMethod === 'GET') {
    const storedConfig = await store.get(CONFIG_KEY, { type: 'json' }).catch(() => null)
    const config = mergeWithDefault(storedConfig || DEFAULT_CONFIG)
    return jsonResponse(200, config)
  }

  if (event.httpMethod === 'POST') {
    if (!event.body) {
      return jsonResponse(400, { message: 'リクエストボディが空です。' })
    }

    let payload
    try {
      payload = JSON.parse(event.body)
    } catch {
      return jsonResponse(400, { message: 'JSON形式が正しくありません。' })
    }

    if (!payload || typeof payload !== 'object') {
      return jsonResponse(400, { message: '設定が見つかりません。' })
    }

    const newConfig = mergeWithDefault(payload)
    const timestamp = new Date().toISOString()
    newConfig.updatedAt = timestamp

    // リンクが存在しないtierのnextIndexは常に0に戻す
    Object.values(newConfig.tiers).forEach((tier) => {
      if (!Array.isArray(tier.links) || tier.links.length === 0) {
        tier.links = []
        tier.nextIndex = 0
      } else {
        tier.nextIndex = Math.max(0, Math.min(tier.nextIndex, tier.links.length - 1))
      }
    })

    await store.set(CONFIG_KEY, JSON.stringify(newConfig), {
      contentType: 'application/json',
      metadata: { updatedAt: timestamp },
    })

    return jsonResponse(200, newConfig)
  }

  return jsonResponse(405, { message: '許可されていないHTTPメソッドです。' })
}
