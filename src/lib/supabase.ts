import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.SUPABASE_URL
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'ClearVoice: SUPABASE_URL or SUPABASE_ANON_KEY is not set. ' +
    'Cloud sync, sign-in, and AI features will not work until configured.'
  )
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
)
