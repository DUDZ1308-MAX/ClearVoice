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
      { message: 'AI feedback is not configured on the server.', code: 'not_configured' },
      503
    )
  }

  const body = await req.json().catch(() => ({}))
  const audio = textValue(body.audio, 2500000)
  const transcript = textValue(body.transcript, 5000)
  const goal = textValue(body.goal, 500)

  if (!audio && !transcript.trim()) {
    return json({ message: 'Record a clip or provide a transcript first.', code: 'validation_error' }, 400)
  }

  try {
    const prompt = [
      'Coach this speaking attempt. Identify concrete strengths, one high-impact improvement, a 60-second drill, and a polished rewrite when transcript text is available. Do not give numeric scores unless the evidence supports a clearly explained count.',
      'User goal: ' + goal,
      transcript
        ? 'User-provided transcript (text-only observations must remain text-based):\n' + transcript
        : 'Listen to the supplied short audio recording.',
    ].join('\n\n')

    const messages: any[] = [
      {
        role: 'system',
        content: 'You are ClearVoice, a supportive public-speaking and articulation coach. Be specific, kind, concise, and practical. Never invent observations, counts, or scores. If the input is transcript-only, do not claim to assess vocal pace, volume, tone, accent, or pronunciation from audio. If audio is supplied, comment only on audible qualities you can reasonably assess. Distinguish observations from suggestions. Use these headings: Strengths; One thing to improve; A 60-second practice drill; A stronger version. For a transcript, provide a polished version preserving the speaker’s meaning. If no transcript is supplied, say a transcript is needed for a reliable rewrite. Do not diagnose speech disorders.',
      },
      { role: 'user', content: prompt },
    ]

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 650,
        temperature: 0.7,
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('OpenAI error', aiRes.status, errText)
      return json(
        { message: 'AI feedback is temporarily unavailable.', code: 'ai_error' },
        503
      )
    }

    const aiData = await aiRes.json()
    const feedback = aiData.choices?.[0]?.message?.content || ''

    if (!feedback.trim()) {
      return json({ message: 'Empty coaching response', code: 'empty_response' }, 503)
    }

    return json({ feedback })
  } catch (err) {
    console.error('ClearVoice AI feedback failed', err)
    return json(
      { message: 'AI feedback is temporarily unavailable. Please try again shortly.', code: 'internal_error' },
      503
    )
  }
})
