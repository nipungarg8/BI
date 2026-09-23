import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { requireUser } from '../_shared/supabaseClient.ts'
import { loadConnectionParams } from '../_shared/loadConnection.ts'
import { connectCustomerDb } from '../_shared/customerDb.ts'
import { introspectSchema } from '../_shared/schema.ts'
import { embedText } from '../_shared/gemini.ts'

interface IndexSchemaBody {
  connectionId: string
}

// Builds/refreshes pgvector embeddings for a connection's tables, so
// AI search can find relevant tables by meaning rather than keyword.
// Only table/column metadata is sent to Gemini, never row data.
Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const { client } = await requireUser(req)
    const { connectionId } = (await req.json()) as IndexSchemaBody
    if (!connectionId) return jsonResponse({ error: 'Missing connectionId' }, 400)

    const params = await loadConnectionParams(client, connectionId)
    const sql = connectCustomerDb(params)

    let schema
    try {
      schema = await introspectSchema(sql)
    } finally {
      await sql.end({ timeout: 5 })
    }

    let indexed = 0
    for (const [tableName, columns] of Object.entries(schema)) {
      const description = `Table ${tableName} with columns: ${columns
        .map((c) => `${c.columnName} (${c.dataType})`)
        .join(', ')}`
      const embedding = await embedText(description)

      const { error } = await client.from('table_embeddings').upsert(
        {
          connection_id: connectionId,
          table_name: tableName,
          column_info: columns,
          embedding,
        },
        { onConflict: 'connection_id,table_name' }
      )
      if (error) throw new Error(error.message)
      indexed += 1
    }

    return jsonResponse({ indexed })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message === 'Not authenticated' ? 401 : 500
    return jsonResponse({ error: message }, status)
  }
})
