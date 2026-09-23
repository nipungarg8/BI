import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { decryptSecret } from './crypto.ts'
import type { ConnectionParams } from './customerDb.ts'

// Reads via the caller-scoped client, so RLS guarantees this can only ever
// load a connection the requesting user owns.
export async function loadConnectionParams(
  client: SupabaseClient,
  connectionId: string
): Promise<ConnectionParams> {
  const { data, error } = await client
    .from('connections')
    .select('host, port, db_name, username, encrypted_password, ssl_mode')
    .eq('id', connectionId)
    .single()

  if (error || !data) {
    throw new Error('Connection not found')
  }

  return {
    host: data.host,
    port: data.port,
    database: data.db_name,
    username: data.username,
    password: await decryptSecret(data.encrypted_password),
    sslMode: data.ssl_mode,
  }
}
