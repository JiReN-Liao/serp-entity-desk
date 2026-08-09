import { createClient } from '@supabase/supabase-js'

export async function verifySupabaseUser(req) {
  const authorization = req?.headers?.authorization
  const token = typeof authorization === 'string' ? authorization.match(/^Bearer\s+(.+)$/i)?.[1] : null
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!token || !url || !anonKey) return null

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await client.auth.getUser()
  return error ? null : data?.user || null
}
