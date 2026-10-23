import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (req.method !== 'POST') {
    return json({ message: 'Method not allowed', code: 'method_not_allowed' }, 405)
  }

  const { user, error } = await getUser(req)
  if (error) return json({ message: error, code: 'unauthorized' }, 401)

  if (!openaiApiKey) {
    return json(
      { message: 'Learning plan generation is not configured on the server.', code: 'not_configured' },
      503
    )
  }

  const body = await req.json().catch(() => ({}))
  const goal = textValue(body.goal, 120) || 'Everyday conversations'
  const level = textValue(body.level, 100) || 'Building confidence'
  const minutes =
    typeof body.minutes === 'number' && Number.isFinite(body.minutes)
      ? Math.max(5, Math.min(20, Math.round(body.minutes)))
      : 10
  const history = Array.isArray(body.history)
    ? body.history.filter((x: unknown) => typeof x === 'string').slice(0, 3).map((x: string) => x.slice(0, 500))
    : []
  const completed =
    typeof body.completedChallenges === 'number' && Number.isFinite(body.completedChallenges)
      ? Math.max(0, Math.min(100, Math.round(body.completedChallenges)))
      : 0

  try {
    const prompt =
      'Create a personalized 7-day speaking practice plan. Goal: ' +
      goal +
      '. Self-described current level: ' +
      level +
      '. Daily time available: ' +
      minutes +
      ' minutes. Completed guided challenges so far: ' +
      completed +
      '. Recent coaching themes, if provided: ' +
      (history.length ? history.join('\n---\n') : 'No prior feedback available; do not assume weaknesses.') +
      '. For each day include focus, a drill that fits the time limit, a real-life mini challenge, and one reflection question. Progress gently across the week. End with how to adapt next week. Do not invent progress data.'

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are ClearVoice, a supportive speaking skills coach. Create practical, achievable plans without diagnosing speech conditions or promising outcomes. Keep it encouraging and concrete. Do not claim to have measured skills objectively. Use headings and concise day-by-day tasks. Include a 1-minute reflection and a rest/flex option.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 900,
        temperature: 0.7,
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('OpenAI error', aiRes.status, errText)
      return json(
        { message: 'Your learning plan is temporarily unavailable.', code: 'ai_error' },
        503
      )
    }

    const aiData = await aiRes.json()
    const plan = aiData.choices?.[0]?.message?.content || ''

    if (!plan.trim()) {
      return json({ message: 'No plan returned', code: 'empty_response' }, 503)
    }

    return json({ plan })
  } catch (err) {
    console.error('ClearVoice learning plan failed', err)
    return json(
      { message: 'Your learning plan is temporarily unavailable. Please try again shortly.', code: 'internal_error' },
      503
    )
  }
})
