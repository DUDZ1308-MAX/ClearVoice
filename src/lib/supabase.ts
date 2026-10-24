import { createClient } from '@supabase/supabase-js'

/**
 * These values are PUBLIC by design (the anon key is meant to be shipped in
 * browser bundles; Row Level Security protects the data). They are used as
 * fallbacks so a missing/misnamed hosting env var can never blank the site.
 */
const FALLBACK_URL = 'https://bbgvzztexrifnnmmeios.supabase.co'
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZ3Z6enRleHJpZm5ubW1laW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MzE0NzQsImV4cCI6MjEwODMwNzQ3NH0.nXezQQ1A54teMF24jLGQldO5ND8Ihpb3KsZaerAbhiU'

export const supabaseUrl = (
  import.meta.env.SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL ||
  FALLBACK_URL
).replace(/\/$/, '')

export const supabaseAnonKey =
  import.meta.env.SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  FALLBACK_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
})
