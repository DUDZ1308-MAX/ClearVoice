/**
 * @appdeploy/sdk — local stub
 *
 * Minimal shape used by backend/index.ts. The backend is not hosted separately
 * in this local build; the Vite dev-server middleware serves the same API
 * routes. This stub keeps backend/index.ts importable and typeable.
 */

import type { IncomingMessage, ServerResponse } from 'http'

export function json(data: any, status = 200) {
  return { status, body: JSON.stringify(data), headers: { 'content-type': 'application/json' } }
}

export function error(message: string, status: number) {
  return { status, body: JSON.stringify({ message }), headers: { 'content-type': 'application/json' } }
}

export function requireAuth() {
  return (ctx: any) => {
    if (!ctx.user) throw new Error('unauthenticated')
  }
}

export const db = {
  async get<T>(_table: string, _keys: any[], _opts?: any): Promise<[T | null]> {
    return [null]
  },
  async add(_table: string, _records: any[]): Promise<[string | null]> {
    return [null]
  },
  async update(_table: string, _records: any[]): Promise<[boolean]> {
    return [true]
  },
}

export const ai = {
  async generate(_opts: {
    system?: string
    prompt?: string
    messages?: any[]
    audios?: any[]
    maxTokens?: number
    thinkingMode?: string
    cache?: boolean
  }): Promise<{ text: string }> {
    return { text: '' }
  },
}

export type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>

export function router(_routes: Record<string, any[]>): Handler {
  return async () => {
    // stub: no-op
  }
}
