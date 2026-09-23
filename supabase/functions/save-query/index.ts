import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { requireUser } from '../_shared/supabaseClient.ts'
import { loadConnectionParams } from '../_shared/loadConnection.ts'
import { connectCustomerDb } from '../_shared/customerDb.ts'
import { introspectSchema } from '../_shared/schema.ts'
import { buildSelectQuery, type StructuredQuery } from '../_shared/sqlBuilder.ts'

interface SaveQueryBody {
  connectionId: string
  name: string
  structuredQuery: StructuredQuery
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const { client, user } = await requireUser(req)
    const { connectionId, name, structuredQuery } = (await req.json()) as SaveQueryBody
    if (!connectionId || !name || !structuredQuery) {
      return jsonResponse({ error: 'Missing connectionId, name, or structuredQuery' }, 400)
    }

    const params = await loadConnectionParams(client, connectionId)
    const sql = connectCustomerDb(params)

    // Re-derive the SQL server-side from the structured query rather than
    // trusting any SQL text the client might send, so what's saved always
    // matches what the allowlist-validated builder would run.
    let generatedSql: string
    try {
      const schema = await introspectSchema(sql)
      generatedSql = buildSelectQuery(structuredQuery, schema).text
    } finally {
      await sql.end({ timeout: 5 })
    }

    const { data, error } = await client
      .from('saved_queries')
      .insert({
        user_id: user.id,
        connection_id: connectionId,
        name,
        structured_query: structuredQuery,
        generated_sql: generatedSql,
      })
      .select('*')
      .single()

    if (error) return jsonResponse({ error: error.message }, 400)

    return jsonResponse({ savedQuery: data }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message === 'Not authenticated' ? 401 : 500
    return jsonResponse({ error: message }, status)
  }
})
