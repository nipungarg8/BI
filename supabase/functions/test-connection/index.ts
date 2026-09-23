import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { requireUser } from '../_shared/supabaseClient.ts'
import { connectCustomerDb } from '../_shared/customerDb.ts'

interface TestConnectionBody {
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
    await requireUser(req)
    const body = (await req.json()) as TestConnectionBody

    for (const field of ['host', 'port', 'dbName', 'username', 'password'] as const) {
      if (!body[field]) {
        return jsonResponse(req, { ok: false, error: `Missing field: ${field}` }, 400)
      }
    }

    const sql = connectCustomerDb({
      host: body.host,
      port: body.port,
      database: body.dbName,
      username: body.username,
      password: body.password,
      sslMode: body.sslMode ?? 'require',
    })

    try {
      await sql`select 1`
      return jsonResponse(req, { ok: true })
    } catch (err) {
      return jsonResponse(req, 
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        200
      )
    } finally {
      await sql.end({ timeout: 5 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message === 'Not authenticated' ? 401 : 500
    return jsonResponse(req, { ok: false, error: message }, status)
  }
})
