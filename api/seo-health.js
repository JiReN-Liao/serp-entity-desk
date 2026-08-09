import { verifySupabaseUser } from './auth-user.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: '只接受 GET。' })
  if (!await verifySupabaseUser(req)) return res.status(401).json({ ready: false, state: 'unauthorized' })
  const webhookUrl = process.env.N8N_SEO_WEBHOOK_URL
  if (!webhookUrl) return res.status(503).json({ ready: false, state: 'not_configured' })

  try {
    const healthUrl = new URL('/healthz', webhookUrl)
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(8000) })
    return res.status(response.ok ? 200 : 503).json({
      ready: response.ok,
      state: response.ok ? 'ready' : 'starting',
    })
  } catch {
    return res.status(503).json({ ready: false, state: 'starting' })
  }
}
