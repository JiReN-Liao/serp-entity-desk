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

function isCoolingDown(ip, windowMs = cooldownMs) {
  const now = Date.now()
  const previous = recentRequests.get(ip) || 0
  recentRequests.set(ip, now)
  for (const [key, timestamp] of recentRequests) {
    if (now - timestamp > cooldownMs * 4) recentRequests.delete(key)
  }
  return now - previous < windowMs
}

export const maxDuration = 60

async function callWorkflow(webhookUrl, proxySecret, payload, timeoutMs) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-seo-proxy-token': proxySecret,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const raw = await response.text()
  let data = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error('INVALID_WORKFLOW_JSON')
  }
  if (!response.ok) {
    const error = new Error(`WORKFLOW_${response.status}`)
    error.status = response.status
    throw error
  }
  const normalized = normalizeSeoResult(data)
  if (!normalized.ok) throw new Error(`INVALID_WORKFLOW_RESULT:${normalized.error}`)
  return normalized.data
}

export async function runSeoWorkflow({ webhookUrl, proxySecret, payload, requestedMode, caller = callWorkflow }) {
  try {
    const data = await caller(webhookUrl, proxySecret, payload, requestedMode === 'live' ? 55_000 : 20_000)
    return { data, fallbackReason: '' }
  } catch (error) {
    if (requestedMode !== 'live') throw error
    const fallbackReason = error?.status === 429 ? 'Gemini 額度或頻率限制' : 'Gemini 暫時未回應'
    const data = await caller(webhookUrl, proxySecret, { ...payload, run_mode: 'demo' }, 20_000)
    return { data, fallbackReason }
  }
}

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
  const requestCooldownMs = parsed.value.generation_mode === 'live' ? cooldownMs : 2_000
  if (isCoolingDown(cooldownKey, requestCooldownMs)) {
    res.setHeader('Retry-After', String(Math.ceil(requestCooldownMs / 1000)))
    return res.status(429).json({ error: `請等待 ${Math.ceil(requestCooldownMs / 1000)} 秒再產生下一篇。` })
  }

  const webhookUrl = process.env.N8N_SEO_WEBHOOK_URL
  const proxySecret = process.env.SEO_PROXY_SECRET
  if (!webhookUrl || !proxySecret) return res.status(503).json({ error: 'n8n 正式服務尚未完成設定。' })

  const requestId = `formal-${randomUUID()}`
  const requestedMode = parsed.value.generation_mode

  const payload = {
    ...parsed.value,
    request_id: requestId,
    run_mode: requestedMode,
    language: 'zh-TW',
    tone: '清楚、實務、可信',
  }

  try {
    const { data, fallbackReason } = await runSeoWorkflow({ webhookUrl, proxySecret, payload, requestedMode })
    res.setHeader('x-request-id', requestId)
    return res.status(200).json({
      ...data,
      request_id: requestId,
      requested_mode: requestedMode,
      fallback_used: Boolean(fallbackReason),
      fallback_reason: fallbackReason,
    })
  } catch (error) {
    console.error('SEO workflow proxy failed:', error?.message || error)
    return res.status(503).json({ error: 'n8n 正在啟動或暫時無法連線，請稍後再試。', request_id: requestId })
  }
}
