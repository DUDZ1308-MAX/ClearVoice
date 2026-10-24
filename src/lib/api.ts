/**
 * src/lib/api.ts — Supabase-backed adapter
 *
 * Exposes the same `api` and `auth` shape that src/App.tsx expects, but
 * backed by Supabase Auth + Edge Functions instead of the @appdeploy stubs.
 *
 * Edge functions must be deployed to your Supabase project:
 *   supabase functions deploy profile-get profile-put coach learning-plan simulator
 *
 * Environment variables (set in your .env or hosting platform):
 *   VITE_SUPABASE_URL      https://<project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY your-supabase-anon-key
 */

import { supabase, supabaseUrl } from './supabase'

interface User {
  userId: string
  name: string
  email: string
}

function baseUrl() {
  return supabaseUrl.replace(/\/$/, '')
}

function functionUrl(name: string) {
  return `${baseUrl()}/functions/v1/${name}`
}

function toUser(supabaseUser: any): User {
  return {
    userId: supabaseUser.id,
    name:
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.user_name ||
      supabaseUser.email ||
      'User',
    email: supabaseUser.email || '',
  }
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token

  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })

  let data: any = {}
  try {
    data = await res.json()
  } catch {
    // ignore non-JSON error bodies
  }

  if (!res.ok) {
    const err: Error & { code?: string; status?: number } = new Error(
      data?.message || 'Request failed'
    )
    err.code = data?.code
    err.status = res.status
    throw err
  }

  return data
}

function routePath(path: string, method: string): string {
  const p = path.replace(/^\//, '')
  if (p === 'api/profile') {
    return method === 'PUT' ? 'profile-put' : 'profile-get'
  }
  if (p === 'api/coach') return 'coach'
  if (p === 'api/learning-plan') return 'learning-plan'
  if (p === 'api/simulator') return 'simulator'
  return p
}

export const auth = {
  isSignedIn(): boolean {
    const session = supabase.auth.getSession()
    return !!session.data.session
  },

  async signIn(): Promise<{ user: User }> {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })
    if (error) throw error
    // OAuth triggers a redirect; on return the session is restored automatically.
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Sign-in did not complete')
    return { user: toUser(userData.user) }
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getUser(): Promise<User | null> {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null
    return toUser(data.user)
  },
}

export const api = {
  async get(path: string) {
    return request(functionUrl(routePath(path, 'GET')))
  },

  async put(path: string, body: any) {
    return request(functionUrl(routePath(path, 'PUT')), {
      method: 'PUT',
      body,
    })
  },

  async post(path: string, body: any) {
    return request(functionUrl(routePath(path, 'POST')), {
      method: 'POST',
      body,
    })
  },
}
