import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { requireUser } from '../_shared/supabaseClient.ts'
import { loadConnectionParams } from '../_shared/loadConnection.ts'
import { connectCustomerDb, ROW_CAP } from '../_shared/customerDb.ts'
import { introspectSchema } from '../_shared/schema.ts'
import { buildSelectQuery, type StructuredQuery } from '../_shared/sqlBuilder.ts'
import { enforceDailyQueryCap } from '../_shared/usageCap.ts'

interface RunQueryBody {
  connectionId: string
  structuredQuery: StructuredQuery
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const { client, user } = await requireUser(req)
    const { connectionId, structuredQuery } = (await req.json()) as RunQueryBody
    if (!connectionId || !structuredQuery) {
      return jsonResponse({ error: 'Missing connectionId or structuredQuery' }, 400)
    }

    await enforceDailyQueryCap(user.id)

    const params = await loadConnectionParams(client, connectionId)
    const sql = connectCustomerDb(params)

    try {
      const schema = await introspectSchema(sql)
      const built = buildSelectQuery(structuredQuery, schema)
      const rows = await sql.unsafe(built.text, built.params as never[])

      return jsonResponse({
        rows,
        rowCount: rows.length,
        rowCapped: rows.length >= ROW_CAP,
        generatedSql: built.text,
      })
    } finally {
      await sql.end({ timeout: 5 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message === 'Not authenticated' ? 401 : 500
    return jsonResponse({ error: message }, status)
  }
})
