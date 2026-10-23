import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { user: null, error: 'Missing authorization header' }
  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return { user: null, error: 'Unauthorized' }
  return { user: data.user, error: null }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({}, 204)

  if (req.method !== 'GET') {
    return json({ message: 'Method not allowed', code: 'method_not_allowed' }, 405)
  }

  const { user, error } = await getUser(req)
  if (error) return json({ message: error, code: 'unauthorized' }, 401)

  const { data: profile, error: dbError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (dbError && dbError.code !== 'PGRST116') {
    return json({ message: 'Could not load profile', code: 'db_error' }, 500)
  }

  const mapped = profile ? {
    words: profile.words || [],
    completed: profile.completed || [],
    practiced: profile.practiced || [],
    challengeDone: profile.challenge_done || [],
    coachSessions: profile.coach_sessions || [],
    updatedAt: profile.updated_at || null,
  } : null

  return json({ profile: mapped })
})
