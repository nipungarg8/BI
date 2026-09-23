import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { callFunction } from '../lib/functions'
import { getGoogleSheetsAccessToken } from '../lib/googleAuth'
import type { SavedQuery } from '../types/query'
import type { QueryCache } from '../types/dashboard'
import { ResultsGrid } from '../components/ResultsGrid'

interface SheetLink {
  spreadsheet_id: string
  sheet_name: string
  last_synced_at: string | null
}

export function QueryDetail() {
  const { id } = useParams<{ id: string }>()
  const [query, setQuery] = useState<SavedQuery | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [sheetLink, setSheetLink] = useState<SheetLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    const [{ data: sq }, { data: cache }, { data: link }] = await Promise.all([
      supabase.from('saved_queries').select('*').eq('id', id).single(),
      supabase.from('query_cache').select('*').eq('saved_query_id', id).maybeSingle(),
      supabase.from('sheet_links').select('*').eq('saved_query_id', id).maybeSingle(),
    ])
    setQuery(sq as SavedQuery)
    setRows(((cache as QueryCache | null)?.result as Record<string, unknown>[]) ?? [])
    setSheetLink(link as SheetLink | null)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleRefresh() {
    if (!query) return
    setRefreshing(true)
    setError(null)
    try {
      const res = await callFunction<{ rows: Record<string, unknown>[] }>('run-query', {
        connectionId: query.connection_id,
        structuredQuery: query.structured_query,
        savedQueryId: query.id,
      })
      setRows(res.rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }

  async function handlePush() {
    if (!query) return
    setPushing(true)
    setError(null)
    setMessage(null)
    try {
      const accessToken = await getGoogleSheetsAccessToken()
      const res = await callFunction<{ spreadsheetUrl: string; syncedAt: string }>(
        'push-to-sheet',
        { savedQueryId: query.id, accessToken, rows }
      )
      setMessage(`Pushed to Google Sheets.`)
      setSheetLink({
        spreadsheet_id: res.spreadsheetUrl.split('/d/')[1]?.split('/')[0] ?? '',
        sheet_name: sheetLink?.sheet_name ?? 'Sheet1',
        last_synced_at: res.syncedAt,
      })
      window.open(res.spreadsheetUrl, '_blank', 'noopener')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPushing(false)
    }
  }

  if (loading) return <p>Loading…</p>
  if (!query) return <p>Query not found.</p>

  return (
    <div>
      <h1>{query.name}</h1>
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        <code>{query.generated_sql}</code>
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh from source'}
        </button>
        <button onClick={handlePush} disabled={pushing || rows.length === 0}>
          {pushing ? 'Pushing…' : 'Push to Google Sheets'}
        </button>
        {sheetLink && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${sheetLink.spreadsheet_id}/edit`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open sheet
          </a>
        )}
      </div>

      {error && <p className="auth-error">{error}</p>}
      {message && <p>{message}</p>}
      {sheetLink?.last_synced_at && (
        <p style={{ fontSize: 12, opacity: 0.6 }}>
          Last synced {new Date(sheetLink.last_synced_at).toLocaleString()}
        </p>
      )}

      <p style={{ fontSize: 13, opacity: 0.7 }}>
        Edits below are local to this grid — push to Sheets to publish them. Values aren't
        written back to the source database.
      </p>
      <ResultsGrid rows={rows} editable onCellEdited={setRows} />
    </div>
  )
}
