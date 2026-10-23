/**
 * @appdeploy/client — local stub
 *
 * Provides `api` and `auth` used by src/App.tsx. In this local build the
 * API calls are served by the Vite dev-server middleware in vite.config.ts,
 * so sign-in, profile sync, coaching, learning plans and the conversation
 * simulator all work without a separate cloud backend.
 */

export interface User {
  userId: string
  name: string
  email: string
}

interface ApiError extends Error {
  code?: string
  status?: number
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  let data: any = {}
  try {
    data = await res.json()
  } catch {
    // ignore non-JSON error bodies
  }

  if (!res.ok) {
    const err: ApiError = new Error(data?.message || 'Request failed')
    err.code = data?.code
    err.status = res.status
    throw err
  }

  return data
}

export const api = {
  get: (path: string) => request(path),
  put: (path: string, body: any) => request(path, { method: 'PUT', body }),
  post: (path: string, body: any) => request(path, { method: 'POST', body }),
}

export const auth = {
  async signIn(): Promise<{ user: User }> {
    const user: User = {
      userId: 'demo-user',
      name: 'Demo User',
      email: 'demo@example.com',
    }
    localStorage.setItem('appdeploy_user', JSON.stringify(user))
    localStorage.setItem('appdeploy_token', 'demo-token')
    return { user }
  },

  async signOut(): Promise<void> {
    localStorage.removeItem('appdeploy_user')
    localStorage.removeItem('appdeploy_token')
  },

  isSignedIn(): boolean {
    return !!localStorage.getItem('appdeploy_token')
  },

  async getUser(): Promise<User | null> {
    const raw = localStorage.getItem('appdeploy_user')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  },
}
