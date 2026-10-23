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

const scenarios: Record<string, string> = {
  'job-interview': 'a job interview; ask one realistic question at a time and respond as the interviewer',
  'work-meeting': 'a work meeting; act as a respectful colleague responding to an idea and asking relevant follow-ups',
  'small-talk': 'everyday small talk; be a friendly conversation partner and build naturally on what the learner says',
  'networking': 'a professional networking conversation; be curious, warm, and ask natural follow-up questions',
  'presentation-q-and-a': 'presentation Q&A; act as an audience member asking clear, realistic questions',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({}, 204)

  if (req.method !== 'POST') {
    return json({ message: 'Method not allowed', code: 'method_not_allowed' }, 405)
  }

  const { user, error } = await getUser(req)
  if (error) return json({ message: error, code: 'unauthorized' }, 401)

  if (!openaiApiKey) {
    return json(
      { message: 'Conversation simulator is not configured on the server.', code: 'not_configured' },
      503
    )
  }

  const body = await req.json().catch(() => ({}))
  const key = textValue(body.scenario, 80)
  if (!scenarios[key]) {
    return json({ message: 'Choose a supported conversation scenario.', code: 'validation_error' }, 400)
  }

  const message = textValue(body.message, 1500).trim()
  if (!message) {
    return json({ message: 'Write a response before sending.', code: 'validation_error' }, 400)
  }

  const history = Array.isArray(body.messages)
    ? body.messages
        .filter(
          (x: any) =>
            !!x &&
            typeof x === 'object' &&
            (x.role === 'user' || x.role === 'assistant') &&
            typeof x.text === 'string'
        )
        .slice(-10)
        .map((x: any) => ({
          role: x.role === 'assistant' ? 'assistant' : 'user',
          content: x.text.slice(0, 1000),
        }))
    : []

  try {
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
            content: 'You are ClearVoice roleplay partner. Stay in the selected scenario, be kind and realistic, and ask only one follow-up question at a time. Keep replies under 100 words. Do not break character unless the learner asks for feedback or the conversation has reached a natural pause. If asked for feedback, give two specific strengths, one actionable improvement, and a short example of a clearer response based only on the actual conversation. Never assign unsupported scores or diagnose.',
          },
          ...history,
          { role: 'user', content: 'Continue this practice roleplay: ' + scenarios[key] + '. Respond naturally to the learner’s latest message. If they ask for feedback, switch to a concise coaching debrief.' },
        ],
        max_tokens: 250,
        temperature: 0.7,
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('OpenAI error', aiRes.status, errText)
      return json(
        { message: 'Your conversation partner is temporarily unavailable.', code: 'ai_error' },
        503
      )
    }

    const aiData = await aiRes.json()
    const reply = aiData.choices?.[0]?.message?.content || ''

    if (!reply.trim()) {
      return json({ message: 'No reply', code: 'empty_response' }, 503)
    }

    return json({ reply })
  } catch (err) {
    console.error('ClearVoice simulator failed', err)
    return json(
      { message: 'Your conversation partner is temporarily unavailable. Please try again shortly.', code: 'internal_error' },
      503
    )
  }
})
