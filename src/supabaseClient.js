import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const demoAllowed = import.meta.env.VITE_DEMO_MODE !== 'false'
export const publicTestAllowed = import.meta.env.VITE_PUBLIC_TEST_MODE === 'true'
export const publicTestAllowAnyQuery = import.meta.env.VITE_PUBLIC_TEST_ALLOW_ANY_QUERY === 'true'
