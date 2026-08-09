import { randomUUID } from 'node:crypto'

import { validateSeoInput } from './seo-input.js'
import { verifySupabaseUser } from './auth-user.js'
import { normalizeSeoResult } from './seo-contract.js'

const recentRequests = new Map()
const cooldownMs = 20_000

function parseBody(req) {
  const raw = req?.body
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function clientIp(req) {
  return String(req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim()
}

function isCoolingDown(ip) {
  const now = Date.now()
  const previous = recentRequests.get(ip) || 0
  recentRequests.set(ip, now)
  for (const [key, timestamp] of recentRequests) {
    if (now - timestamp > cooldownMs * 4) recentRequests.delete(key)
  }
  return now - previous < cooldownMs
}

export const maxDuration = 60

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST')
    return res.status(405).json({ error: '只接受 POST。' })
  }
  let user
  try {
    user = await verifySupabaseUser(req)
  } catch (error) {
    console.error('SEO workflow auth failed:', error?.message || error)
    return res.status(503).json({ error: '登入服務暫時無法連線，請稍後再試。' })
  }
  if (!user) return res.status(401).json({ error: '請先登入。' })

  const body = parseBody(req)
  let bodySize = 0
  try {
    bodySize = JSON.stringify(body).length
  } catch {
    return res.status(400).json({ error: 'request body 格式無法解析。' })
  }
  if (bodySize > 5000) return res.status(413).json({ error: 'request body 過大。' })

  const parsed = validateSeoInput(body)
  if (!parsed.ok) return res.status(400).json({ error: parsed.error })
  const cooldownKey = `${user.id}:${clientIp(req)}`
  if (isCoolingDown(cooldownKey)) {
    res.setHeader('Retry-After', String(Math.ceil(cooldownMs / 1000)))
    return res.status(429).json({ error: '請等待 20 秒再產生下一篇。' })
  }

  const webhookUrl = process.env.N8N_SEO_WEBHOOK_URL
  const proxySecret = process.env.SEO_PROXY_SECRET
  if (!webhookUrl || !proxySecret) return res.status(503).json({ error: 'n8n 正式服務尚未完成設定。' })

  const requestId = `formal-${randomUUID()}`

  const payload = {
    ...parsed.value,
    request_id: requestId,
    run_mode: 'live',
    language: 'zh-TW',
    tone: '清楚、實務、可信',
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-seo-proxy-token': proxySecret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55_000),
    })
    const text = await response.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      return res.status(502).json({ error: 'n8n 回傳了無法解析的資料。', request_id: requestId })
    }
    if (!response.ok) {
      if (response.status === 429) {
        res.setHeader('Retry-After', '30')
        return res.status(429).json({ error: '內容服務目前請求過於頻繁，請稍後再試。', request_id: requestId })
      }
      const unavailable = response.status === 503 || response.status === 504
      return res.status(unavailable ? 503 : 502).json({
        error: unavailable ? 'n8n 正在喚醒，請稍後再試。' : 'n8n 執行失敗。',
        request_id: requestId,
      })
    }
    const normalized = normalizeSeoResult(data)
    if (!normalized.ok) return res.status(502).json({ error: normalized.error, request_id: requestId })
    res.setHeader('x-request-id', requestId)
    return res.status(200).json({ ...normalized.data, request_id: requestId })
  } catch (error) {
    console.error('SEO workflow proxy failed:', error?.message || error)
    return res.status(503).json({ error: 'n8n 正在啟動或暫時無法連線，請稍後再試。', request_id: requestId })
  }
}
