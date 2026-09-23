import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { requireUser } from '../_shared/supabaseClient.ts'
import { encryptSecret } from '../_shared/crypto.ts'
import { connectCustomerDb } from '../_shared/customerDb.ts'

interface CreateConnectionBody {
  name: string
  host: string
  port: number
  dbName: string
  username: string
  password: string
  sslMode?: string
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const { client, user } = await requireUser(req)
    const body = (await req.json()) as CreateConnectionBody

    for (const field of ['name', 'host', 'port', 'dbName', 'username', 'password'] as const) {
      if (!body[field]) {
        return jsonResponse({ error: `Missing field: ${field}` }, 400)
      }
    }

    const sslMode = body.sslMode ?? 'require'

    // Verify the credentials work and are usable read-only before storing
    // anything.
    const sql = connectCustomerDb({
      host: body.host,
      port: body.port,
      database: body.dbName,
      username: body.username,
      password: body.password,
      sslMode,
    })

    try {
      await sql`select 1`
    } catch (err) {
      return jsonResponse(
        { error: `Could not connect: ${err instanceof Error ? err.message : String(err)}` },
        400
      )
    } finally {
      await sql.end({ timeout: 5 })
    }

    const encryptedPassword = await encryptSecret(body.password)

    const { data, error } = await client
      .from('connections')
      .insert({
        user_id: user.id,
        name: body.name,
        host: body.host,
        port: body.port,
        db_name: body.dbName,
        username: body.username,
        encrypted_password: encryptedPassword,
        ssl_mode: sslMode,
      })
      .select('id, name, host, port, db_name, username, ssl_mode, created_at')
      .single()

    if (error) {
      return jsonResponse({ error: error.message }, 400)
    }

    return jsonResponse({ connection: data }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message === 'Not authenticated' ? 401 : 500
    return jsonResponse({ error: message }, status)
  }
})
