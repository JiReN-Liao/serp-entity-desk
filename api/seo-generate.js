import { validateSeoInput } from './seo-input.js'
import { verifySupabaseUser } from './auth-user.js'

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
  if (req.method !== 'POST') return res.status(405).json({ error: '只接受 POST。' })
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

  const webhookUrl = process.env.N8N_SEO_WEBHOOK_URL
  if (!webhookUrl) return res.status(503).json({ error: 'n8n 正式服務尚未完成設定。' })
  if (isCoolingDown(user.id || clientIp(req))) {
    res.setHeader('Retry-After', String(Math.ceil(cooldownMs / 1000)))
    return res.status(429).json({ error: '請等待 20 秒再產生下一篇。' })
  }

  const payload = {
    ...parsed.value,
    request_id: `formal-${Date.now()}`,
    run_mode: 'live',
    language: 'zh-TW',
    tone: '清楚、實務、可信',
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55_000),
    })
    if (!response.ok) {
      if (response.status === 429) {
        res.setHeader('Retry-After', '30')
        return res.status(429).json({ error: '內容服務目前請求過於頻繁，請稍後再試。' })
      }
      return res.status(response.status === 503 ? 503 : 502).json({
        error: response.status === 503 ? 'n8n 正在喚醒，請稍後再試。' : 'n8n 執行失敗。',
      })
    }
    const text = await response.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      return res.status(502).json({ error: 'n8n 回傳格式無法解析，請稍後再試。' })
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(502).json({ error: 'n8n 回傳格式不完整，請稍後再試。' })
    }
    return res.status(200).json(data)
  } catch (error) {
    console.error('SEO workflow proxy failed:', error?.message || error)
    return res.status(503).json({ error: 'n8n 正在啟動或暫時無法連線，請稍後再試。' })
  }
}
