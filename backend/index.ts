import { router, json, error, requireAuth, db, ai } from '@appdeploy/sdk';

type Profile = {
  id: string;
  words: unknown[];
  completed: string[];
  practiced: string[];
  challengeDone: string[];
  coachSessions?: Array<{ id: number; createdAt: string; transcript: string; feedback: string; source: string }>;
  updatedAt?: string;
};
const textValue = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';

export const handler = router({
  'GET /api/profile': [
    requireAuth(),
    async (ctx) => {
      const userId = ctx.user!.userId;
      const [profile] = await db.get<Profile>('clearvoice_profiles', [userId]);
      return json({ profile: profile ? {
        words: profile.words || [],
        completed: profile.completed || [],
        practiced: profile.practiced || [],
        challengeDone: profile.challengeDone || [],
        coachSessions: profile.coachSessions || [],
        updatedAt: profile.updatedAt || null
      } : null });
    }
  ],
  'PUT /api/profile': [
    requireAuth(),
    async (ctx) => {
      const userId = ctx.user!.userId;
      const incoming = ((ctx.body || {}) as { profile?: Record<string, unknown> }).profile || {};
      const record = {
        id: userId,
        words: Array.isArray(incoming.words) ? incoming.words.slice(0, 300) : [],
        completed: Array.isArray(incoming.completed) ? incoming.completed.filter(x => typeof x === 'string').slice(0, 30) : [],
        practiced: Array.isArray(incoming.practiced) ? incoming.practiced.filter(x => typeof x === 'string').slice(0, 300) : [],
        challengeDone: Array.isArray(incoming.challengeDone) ? incoming.challengeDone.filter(x => typeof x === 'string').slice(0, 100) : [],
        coachSessions: Array.isArray(incoming.coachSessions) ? incoming.coachSessions.filter((x): x is { id: number; createdAt: string; transcript: string; feedback: string; source: string } => !!x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'number' && typeof (x as { createdAt?: unknown }).createdAt === 'string' && typeof (x as { transcript?: unknown }).transcript === 'string' && typeof (x as { feedback?: unknown }).feedback === 'string' && typeof (x as { source?: unknown }).source === 'string').slice(0, 10).map(x => ({ id: x.id, createdAt: x.createdAt.slice(0, 40), transcript: x.transcript.slice(0, 1200), feedback: x.feedback.slice(0, 5000), source: x.source === 'audio' ? 'audio' : 'transcript' })) : [],
        updatedAt: new Date().toISOString()
      };
      const [existing] = await db.get<Profile>('clearvoice_profiles', [userId]);
      if (existing) {
        const [ok] = await db.update('clearvoice_profiles', [{ id: userId, record }]);
        if (!ok) return error('Could not save progress. Please try again.', 500);
      } else {
        const [id] = await db.add('clearvoice_profiles', [record]);
        if (!id) {
          const [latest] = await db.get<Profile>('clearvoice_profiles', [userId], { consistent: true });
          if (!latest) return error('Could not create your profile. Please try again.', 500);
          const [ok] = await db.update('clearvoice_profiles', [{ id: userId, record }]);
          if (!ok) return error('Could not save progress. Please try again.', 500);
        }
      }
      return json({ saved: true, updatedAt: record.updatedAt });
    }
  ],
  'POST /api/learning-plan': [
    requireAuth(),
    async (ctx) => {
      const body = (ctx.body || {}) as { goal?: unknown; level?: unknown; minutes?: unknown; history?: unknown; completedChallenges?: unknown };
      const goal = textValue(body.goal, 120) || 'Everyday conversations';
      const level = textValue(body.level, 100) || 'Building confidence';
      const minutes = typeof body.minutes === 'number' && Number.isFinite(body.minutes) ? Math.max(5, Math.min(20, Math.round(body.minutes))) : 10;
      const history = Array.isArray(body.history) ? body.history.filter((x): x is string => typeof x === 'string').slice(0, 3).map(x => x.slice(0, 500)) : [];
      const completed = typeof body.completedChallenges === 'number' && Number.isFinite(body.completedChallenges) ? Math.max(0, Math.min(100, Math.round(body.completedChallenges))) : 0;
      try {
        const result = await ai.generate({
          system: 'You are ClearVoice, a supportive speaking skills coach. Create practical, achievable plans without diagnosing speech conditions or promising outcomes. Keep it encouraging and concrete. Do not claim to have measured skills objectively. Use headings and concise day-by-day tasks. Include a 1-minute reflection and a rest/flex option.',
          prompt: 'Create a personalized 7-day speaking practice plan. Goal: ' + goal + '. Self-described current level: ' + level + '. Daily time available: ' + minutes + ' minutes. Completed guided challenges so far: ' + completed + '. Recent coaching themes, if provided: ' + (history.length ? history.join('\n---\n') : 'No prior feedback available; do not assume weaknesses.') + '. For each day include focus, a drill that fits the time limit, a real-life mini challenge, and one reflection question. Progress gently across the week. End with how to adapt next week. Do not invent progress data.',
          maxTokens: 900,
          thinkingMode: 'FAST',
          cache: true
        });
        return json({ plan: result.text });
      } catch (err) {
        console.error('ClearVoice learning plan failed', err);
        return error('Your learning plan is temporarily unavailable. Please try again shortly.', 503);
      }
    }
  ],
  'POST /api/simulator': [
    requireAuth(),
    async (ctx) => {
      const body = (ctx.body || {}) as { scenario?: unknown; messages?: unknown; message?: unknown };
      const scenarios: Record<string, string> = {
        'job-interview': 'a job interview; ask one realistic question at a time and respond as the interviewer',
        'work-meeting': 'a work meeting; act as a respectful colleague responding to an idea and asking relevant follow-ups',
        'small-talk': 'everyday small talk; be a friendly conversation partner and build naturally on what the learner says',
        'networking': 'a professional networking conversation; be curious, warm, and ask natural follow-up questions',
        'presentation-q-and-a': 'presentation Q&A; act as an audience member asking clear, realistic questions'
      };
      const key = textValue(body.scenario, 80);
      if (!scenarios[key]) return error('Choose a supported conversation scenario.', 400);
      const message = textValue(body.message, 1500).trim();
      if (!message) return error('Write a response before sending.', 400);
      const history = Array.isArray(body.messages) ? body.messages.filter((x): x is { role: string; text: string } => !!x && typeof x === 'object' && ((x as { role?: unknown }).role === 'user' || (x as { role?: unknown }).role === 'assistant') && typeof (x as { text?: unknown }).text === 'string').slice(-10).map(x => ({ role: x.role === 'assistant' ? 'assistant' as const : 'user' as const, content: x.text.slice(0, 1000) })) : [];
      try {
        const result = await ai.generate({
          system: 'You are ClearVoice roleplay partner. Stay in the selected scenario, be kind and realistic, and ask only one follow-up question at a time. Keep replies under 100 words. Do not break character unless the learner asks for feedback or the conversation has reached a natural pause. If asked for feedback, give two specific strengths, one actionable improvement, and a short example of a clearer response based only on the actual conversation. Never assign unsupported scores or diagnose.',
          messages: [...history, { role: 'user', content: message }],
          prompt: 'Continue this practice roleplay: ' + scenarios[key] + '. Respond naturally to the learner’s latest message. If they ask for feedback, switch to a concise coaching debrief.',
          maxTokens: 250,
          thinkingMode: 'FAST'
        });
        return json({ reply: result.text });
      } catch (err) {
        console.error('ClearVoice simulator failed', err);
        return error('Your conversation partner is temporarily unavailable. Please try again shortly.', 503);
      }
    }
  ],
  'POST /api/coach': [
    requireAuth(),
    async (ctx) => {
      const body = (ctx.body || {}) as { audio?: unknown; mimeType?: unknown; transcript?: unknown; goal?: unknown };
      const audio = textValue(body.audio, 2500000);
      const transcript = textValue(body.transcript, 5000);
      if (!audio && !transcript.trim()) return error('Record a clip or provide a transcript first.', 400);
      if (audio.length > 2500000) return error('Recording is too large. Try a shorter clip.', 413);
      try {
        const result = await ai.generate({
          system: 'You are ClearVoice, a supportive public-speaking and articulation coach. Be specific, kind, concise, and practical. Never invent observations, counts, or scores. If the input is transcript-only, do not claim to assess vocal pace, volume, tone, accent, or pronunciation from audio. If audio is supplied, comment only on audible qualities you can reasonably assess. Distinguish observations from suggestions. Use these headings: Strengths; One thing to improve; A 60-second practice drill; A stronger version. For a transcript, provide a polished version preserving the speaker’s meaning. If no transcript is supplied, say a transcript is needed for a reliable rewrite. Do not diagnose speech disorders.',
          prompt: ['Coach this speaking attempt. Identify concrete strengths, one high-impact improvement, a 60-second drill, and a polished rewrite when transcript text is available. Do not give numeric scores unless the evidence supports a clearly explained count.', 'User goal: ' + textValue(body.goal, 500), transcript ? 'User-provided transcript (text-only observations must remain text-based):\n' + transcript : 'Listen to the supplied short audio recording.'].join('\n\n'),
          audios: audio ? [{ data: audio, mimeType: textValue(body.mimeType, 80) || 'audio/webm' }] : undefined,
          maxTokens: 650,
          thinkingMode: 'FAST',
          cache: true
        });
        return json({ feedback: result.text });
      } catch (err) {
        console.error('ClearVoice AI feedback failed', err);
        return error('AI feedback is temporarily unavailable. Please try again shortly.', 503);
      }
    }
  ]
});