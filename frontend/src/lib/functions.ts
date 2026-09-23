import { supabase } from './supabase'

const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Not authenticated')
  }

  const res = await fetch(`${functionsUrl}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })

  const json = await res.json()

  if (!res.ok) {
    throw new Error(json.error ?? `Request to ${name} failed with status ${res.status}`)
  }

  return json as T
}
