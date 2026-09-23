import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { requireUser } from '../_shared/supabaseClient.ts'
import { embedText } from '../_shared/gemini.ts'

interface AiSemanticSearchBody {
  connectionId: string
  query: string
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const { client } = await requireUser(req)
    const { connectionId, query } = (await req.json()) as AiSemanticSearchBody
    if (!connectionId || !query) {
      return jsonResponse(req, { error: 'Missing connectionId or query' }, 400)
    }

    const embedding = await embedText(query)

    // security-invoker RPC: still scoped by RLS to the caller's own
    // table_embeddings rows for this connection.
    const { data, error } = await client.rpc('match_table_embeddings', {
      query_embedding: embedding,
      match_connection_id: connectionId,
      match_count: 5,
    })

    if (error) return jsonResponse(req, { error: error.message }, 400)

    return jsonResponse(req, { matches: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message === 'Not authenticated' ? 401 : 500
    return jsonResponse(req, { error: message }, status)
  }
})
