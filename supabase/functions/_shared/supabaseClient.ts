import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

// Client scoped to the caller's own JWT. Every query through this client is
// subject to RLS, so it can only ever see or write the caller's own rows.
export function userClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization') ?? ''
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
}

// Service-role client that bypasses RLS. Use only for operations that must
// cross users' rows by design (e.g. the query_usage counter), never to read
// or return another user's data.
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

export async function requireUser(req: Request) {
  const client = userClient(req)
  const {
    data: { user },
    error,
  } = await client.auth.getUser()
  if (error || !user) {
    throw new Error('Not authenticated')
  }
  return { client, user }
}
