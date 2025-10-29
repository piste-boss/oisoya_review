import { getStore } from '@netlify/blobs'

const DEFAULT_STORE_NAME = 'oiso-review-router-config'

const resolveStoreOptions = () => {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.BLOBS_SITE_ID
  const token =
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.NETLIFY_AUTH_TOKEN ||
    process.env.BLOBS_TOKEN

  if (!siteID && !token) {
    return null
  }

  const options = {}
  if (siteID) options.siteID = siteID
  if (token) options.token = token
  return options
}

export const createStore = (name = DEFAULT_STORE_NAME) => {
  const options = resolveStoreOptions()
  return options ? getStore(name, options) : getStore(name)
}

export const getConfigStore = () => createStore()
