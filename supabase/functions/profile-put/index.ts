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

const textValue = (value: unknown, max: number) =>
  typeof value === 'string' ? value.slice(0, max) : ''

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({}, 204)

  if (req.method !== 'PUT') {
    return json({ message: 'Method not allowed', code: 'method_not_allowed' }, 405)
  }

  const { user, error } = await getUser(req)
  if (error) return json({ message: error, code: 'unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))
  const incoming = body.profile || {}

  const record = {
    id: user.id,
    words: Array.isArray(incoming.words) ? incoming.words.slice(0, 300) : [],
    completed: Array.isArray(incoming.completed)
      ? incoming.completed.filter((x: unknown) => typeof x === 'string').slice(0, 30)
      : [],
    practiced: Array.isArray(incoming.practiced)
      ? incoming.practiced.filter((x: unknown) => typeof x === 'string').slice(0, 300)
      : [],
    challengeDone: Array.isArray(incoming.challengeDone)
      ? incoming.challengeDone.filter((x: unknown) => typeof x === 'string').slice(0, 100)
      : [],
    coachSessions: Array.isArray(incoming.coachSessions)
      ? incoming.coachSessions
          .filter(
            (x: any) =>
              !!x &&
              typeof x === 'object' &&
              typeof x.id === 'number' &&
              typeof x.createdAt === 'string' &&
              typeof x.transcript === 'string' &&
              typeof x.feedback === 'string' &&
              typeof x.source === 'string'
          )
          .slice(0, 10)
          .map((x: any) => ({
            id: x.id,
            createdAt: x.createdAt.slice(0, 40),
            transcript: x.transcript.slice(0, 1200),
            feedback: x.feedback.slice(0, 5000),
            source: x.source === 'audio' ? 'audio' : 'transcript',
          }))
      : [],
    updated_at: new Date().toISOString(),
  }

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(record, { onConflict: 'id' })

  if (upsertError) {
    return json({ message: 'Could not save progress', code: 'db_error' }, 500)
  }

  return json({ saved: true, updatedAt: record.updated_at })
})
