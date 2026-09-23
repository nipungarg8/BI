import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { requireUser } from '../_shared/supabaseClient.ts'
import { loadConnectionParams } from '../_shared/loadConnection.ts'
import { connectCustomerDb } from '../_shared/customerDb.ts'
import { introspectSchema } from '../_shared/schema.ts'
import { buildSelectQuery, type StructuredQuery } from '../_shared/sqlBuilder.ts'
import { nlToStructuredQuery } from '../_shared/gemini.ts'

interface AiNlToSqlBody {
  connectionId: string
  question: string
}

// Turns a natural-language question into a structured query, the same
// shape the manual query builder produces. Nothing here executes a query —
// the caller must review the generated SQL and separately call run-query,
// so AI-authored SQL goes through the exact same allowlist-validated,
// read-only path as everything else.
Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const { client } = await requireUser(req)
    const { connectionId, question } = (await req.json()) as AiNlToSqlBody
    if (!connectionId || !question) {
      return jsonResponse({ error: 'Missing connectionId or question' }, 400)
    }

    const params = await loadConnectionParams(client, connectionId)
    const sql = connectCustomerDb(params)

    let schema
    try {
      schema = await introspectSchema(sql)
    } finally {
      await sql.end({ timeout: 5 })
    }

    const aiResult = await nlToStructuredQuery(schema, question)

    const structuredQuery: StructuredQuery = {
      table: aiResult.table,
      columns: aiResult.columns,
      filter: { combinator: 'and', rules: aiResult.rules },
      limit: aiResult.limit,
    }

    // Re-validates table/columns against the live allowlist; throws if the
    // model hallucinated something that doesn't exist.
    const built = buildSelectQuery(structuredQuery, schema)

    return jsonResponse({
      structuredQuery,
      generatedSql: built.text,
      explanation: aiResult.explanation,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message === 'Not authenticated' ? 401 : 500
    return jsonResponse({ error: message }, status)
  }
})
