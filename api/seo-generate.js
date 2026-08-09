import { validateSeoInput } from './seo-input.js'
import { verifySupabaseUser } from './auth-user.js'

const recentRequests = new Map()
const cooldownMs = 20_000

function clientIp(req) {
  return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
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
  if (req.method !== 'POST') return res.status(405).json({ error: '只接受 POST。' })
  if (!await verifySupabaseUser(req)) return res.status(401).json({ error: '請先登入。' })
  if (isCoolingDown(clientIp(req))) return res.status(429).json({ error: '請等待 20 秒再產生下一篇。' })

  const parsed = validateSeoInput(req.body)
  if (!parsed.ok) return res.status(400).json({ error: parsed.error })

  const webhookUrl = process.env.N8N_SEO_WEBHOOK_URL
  if (!webhookUrl) return res.status(503).json({ error: 'n8n 正式服務尚未完成設定。' })

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
    const text = await response.text()
    const data = text ? JSON.parse(text) : {}
    if (!response.ok) {
      return res.status(response.status === 503 ? 503 : 502).json({
        error: response.status === 503 ? 'n8n 正在喚醒，請稍後再試。' : 'n8n 執行失敗。',
      })
    }
    return res.status(200).json(data)
  } catch (error) {
    console.error('SEO workflow proxy failed:', error?.message || error)
    return res.status(503).json({ error: 'n8n 正在啟動或暫時無法連線，請稍後再試。' })
  }
}
