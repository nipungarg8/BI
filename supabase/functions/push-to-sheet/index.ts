import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { requireUser } from '../_shared/supabaseClient.ts'

interface PushToSheetBody {
  savedQueryId: string
  accessToken: string
  rows: Record<string, unknown>[]
}

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'

function toGridValues(rows: Record<string, unknown>[]): unknown[][] {
  if (rows.length === 0) return [[]]
  const headers = Object.keys(rows[0])
  const body = rows.map((row) => headers.map((h) => row[h] ?? ''))
  return [headers, ...body]
}

// One-way push: query results overwrite the linked sheet's data range.
// Two-way sync (reading edits back from Sheets) is a later milestone.
Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const { client, user } = await requireUser(req)
    const { savedQueryId, accessToken, rows } = (await req.json()) as PushToSheetBody

    if (!savedQueryId || !accessToken || !rows) {
      return jsonResponse(req, { error: 'Missing savedQueryId, accessToken, or rows' }, 400)
    }

    const { data: savedQuery, error: sqError } = await client
      .from('saved_queries')
      .select('name')
      .eq('id', savedQueryId)
      .single()
    if (sqError || !savedQuery) return jsonResponse(req, { error: 'Saved query not found' }, 404)

    const { data: existingLink } = await client
      .from('sheet_links')
      .select('*')
      .eq('saved_query_id', savedQueryId)
      .maybeSingle()

    const googleHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    let spreadsheetId = existingLink?.spreadsheet_id as string | undefined
    const sheetName = existingLink?.sheet_name ?? 'Sheet1'

    if (!spreadsheetId) {
      const createRes = await fetch(SHEETS_API, {
        method: 'POST',
        headers: googleHeaders,
        body: JSON.stringify({
          properties: { title: `${savedQuery.name} — BI Tool` },
          sheets: [{ properties: { title: sheetName } }],
        }),
      })
      const created = await createRes.json()
      if (!createRes.ok) {
        return jsonResponse(req, { error: created.error?.message ?? 'Failed to create sheet' }, 502)
      }
      spreadsheetId = created.spreadsheetId
    }

    const values = toGridValues(rows)
    const range = `${sheetName}!A1`
    const updateRes = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: googleHeaders,
        body: JSON.stringify({ values }),
      }
    )
    if (!updateRes.ok) {
      const updateError = await updateRes.json()
      return jsonResponse(req, { error: updateError.error?.message ?? 'Failed to write sheet' }, 502)
    }

    const now = new Date().toISOString()
    await client.from('sheet_links').upsert(
      {
        saved_query_id: savedQueryId,
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
        last_synced_at: now,
      },
      { onConflict: 'saved_query_id' }
    )

    return jsonResponse(req, {
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      syncedAt: now,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message === 'Not authenticated' ? 401 : 500
    return jsonResponse(req, { error: message }, status)
  }
})
