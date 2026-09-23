import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { requireUser } from '../_shared/supabaseClient.ts'
import { loadConnectionParams } from '../_shared/loadConnection.ts'
import { connectCustomerDb } from '../_shared/customerDb.ts'
import { introspectSchema } from '../_shared/schema.ts'

interface ListSchemaBody {
  connectionId: string
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const { client } = await requireUser(req)
    const { connectionId } = (await req.json()) as ListSchemaBody
    if (!connectionId) return jsonResponse({ error: 'Missing connectionId' }, 400)

    const params = await loadConnectionParams(client, connectionId)
    const sql = connectCustomerDb(params)
    try {
      const schema = await introspectSchema(sql)
      return jsonResponse({ schema })
    } finally {
      await sql.end({ timeout: 5 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message === 'Not authenticated' ? 401 : 500
    return jsonResponse({ error: message }, status)
  }
})
