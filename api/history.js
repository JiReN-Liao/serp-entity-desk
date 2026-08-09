import { createClient } from '@supabase/supabase-js'

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function setCors(req, res) {
  const origin = getHeader(req, 'origin')
  const allowedOrigins = (process.env.APP_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (origin && allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
}

function markPrivate(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
}

async function authenticatedClient(req) {
  const authorization = getHeader(req, 'authorization')
  const token = typeof authorization === 'string' ? authorization.match(/^Bearer\s+(.+)$/i)?.[1] : null
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!token || !url || !anonKey) return null
  const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data, error } = await client.auth.getUser()
  if (error || !data?.user) return null
  return { client, user: data.user }
}

export default async function handler(req, res) {
  markPrivate(res)
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: '只接受 GET。' })

  let auth
  try {
    auth = await authenticatedClient(req)
  } catch (error) {
    console.error('History auth failed:', error?.message || error)
    return res.status(503).json({ error: '登入服務暫時無法連線，請稍後再試。' })
  }
  if (!auth) return res.status(401).json({ error: '請先登入。' })

  let data
  let error
  try {
    ({ data, error } = await auth.client
      .from('analysis_runs')
      .select('id, query, source, mode, article_count, entity_count, cluster_count, created_at')
      .order('created_at', { ascending: false })
      .limit(12))
  } catch (lookupError) {
    console.error('History lookup failed:', lookupError?.message || lookupError)
    return res.status(502).json({ error: '無法讀取歷史分析，請稍後再試。' })
  }

  if (error) {
    console.error('History lookup failed:', error.message)
    return res.status(502).json({ error: '無法讀取歷史分析，請確認 Supabase schema 已執行。' })
  }

  return res.status(200).json({
    history: (Array.isArray(data) ? data : []).filter((row) => row && typeof row === 'object').map((row) => ({
      id: row.id,
      query: row.query,
      source: row.source,
      mode: row.mode,
      articleCount: row.article_count,
      entityCount: row.entity_count,
      clusterCount: row.cluster_count,
      createdAt: row.created_at,
    })),
  })
}
