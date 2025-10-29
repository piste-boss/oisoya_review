import { createStore } from './_lib/store.js'

const CONFIG_KEY = 'router-config'
const DEFAULT_MODEL = 'gemini-1.5-flash-latest'

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

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '')

const buildPrompt = (prompt, dataSamples) => {
  const basePrompt = prompt ||
    '次のアンケート回答を参考に、100〜200文字程度の口コミを丁寧な日本語で作成してください。語尾や表現は自然で温かみのあるものにしてください。'

  const formattedSamples = Array.isArray(dataSamples)
    ? dataSamples
        .map((item, index) => {
          if (typeof item === 'string') return `- サンプル${index + 1}: ${item}`
          if (item && typeof item === 'object') {
            return `- サンプル${index + 1}: ${Object.values(item)
              .filter((value) => value)
              .join(' / ')}`
          }
          return null
        })
        .filter(Boolean)
        .join('\n')
    : ''

  return `${basePrompt}\n\n参考データ:\n${formattedSamples}`
}

const extractTextFromGemini = (payload) => {
  const candidates = payload?.candidates
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return ''
  }

  const parts = candidates[0]?.content?.parts
  if (!Array.isArray(parts)) {
    return ''
  }

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim()
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
    }
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { message: 'POSTメソッドのみ利用できます。' })
  }

  const store = createStore()
  const config = (await store.get(CONFIG_KEY, { type: 'json' }).catch(() => null)) || {}
  const aiSettings = config.aiSettings || {}

  const geminiApiKey = sanitizeString(aiSettings.geminiApiKey)
  const gasUrl = sanitizeString(aiSettings.gasUrl)
  const prompt = sanitizeString(aiSettings.prompt)
  const mapsLink = sanitizeString(aiSettings.mapsLink)

  if (!geminiApiKey) {
    return jsonResponse(400, { message: 'Gemini APIキーが設定されていません。' })
  }

  if (!gasUrl) {
    return jsonResponse(400, { message: 'GASアプリURLが設定されていません。' })
  }

  let dataSamples = []
  try {
    const gasResponse = await fetch(gasUrl)
    if (!gasResponse.ok) {
      throw new Error(`GASアプリの呼び出しに失敗しました (status: ${gasResponse.status}).`)
    }
    const contentType = gasResponse.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      dataSamples = await gasResponse.json()
    } else {
      const text = await gasResponse.text()
      dataSamples = text ? [text] : []
    }
  } catch (error) {
    console.error('Failed to retrieve GAS data:', error)
    return jsonResponse(500, { message: 'GASアプリからデータを取得できませんでした。' })
  }

  const requestModel = sanitizeString(event?.queryStringParameters?.model) || sanitizeString(aiSettings.model)
  const model = requestModel || DEFAULT_MODEL
  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${encodeURIComponent(geminiApiKey)}`

  const completePrompt = buildPrompt(prompt, Array.isArray(dataSamples) ? dataSamples.slice(0, 5) : [])

  try {
    const geminiResponse = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: completePrompt }],
          },
        ],
      }),
    })

    if (!geminiResponse.ok) {
      const errorPayload = await geminiResponse.json().catch(() => ({}))
      console.error('Gemini error payload:', errorPayload)
      const message =
        errorPayload?.error?.message || 'Gemini APIからエラーが返されました。設定を見直してください。'
      return jsonResponse(502, { message })
    }

    const geminiPayload = await geminiResponse.json()
    const generatedText = extractTextFromGemini(geminiPayload)

    if (!generatedText) {
      return jsonResponse(502, { message: 'Gemini APIから有効な文章が返されませんでした。' })
    }

    return jsonResponse(200, {
      text: generatedText,
      mapsLink,
      aiSettings: {
        mapsLink,
        gasUrl,
        prompt,
      },
    })
  } catch (error) {
    console.error('Failed to generate content via Gemini:', error)
    return jsonResponse(500, { message: '口コミ生成処理に失敗しました。' })
  }
}
