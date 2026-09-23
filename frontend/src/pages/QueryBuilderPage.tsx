import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QueryBuilder, type Field, type RuleGroupType } from 'react-querybuilder'
import 'react-querybuilder/dist/query-builder.css'
import { supabase } from '../lib/supabase'
import { callFunction } from '../lib/functions'
import type { Connection } from '../types/connection'
import type { QueryResult, TableSchema } from '../types/query'
import { ResultsGrid } from '../components/ResultsGrid'

const emptyQuery: RuleGroupType = { combinator: 'and', rules: [] }

export function QueryBuilderPage() {
  const navigate = useNavigate()
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionId, setConnectionId] = useState('')
  const [schema, setSchema] = useState<TableSchema | null>(null)
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [table, setTable] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [filter, setFilter] = useState<RuleGroupType>(emptyQuery)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('connections_public')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setConnections((data as Connection[]) ?? []))
  }, [])

  useEffect(() => {
    if (!connectionId) return
    setLoadingSchema(true)
    setSchemaError(null)
    setSchema(null)
    setTable('')
    setColumns([])
    setFilter(emptyQuery)
    callFunction<{ schema: TableSchema }>('list-schema', { connectionId })
      .then((res) => setSchema(res.schema))
      .catch((err) => setSchemaError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoadingSchema(false))
  }, [connectionId])

  const tableNames = schema ? Object.keys(schema) : []
  const tableColumns = schema && table ? schema[table] : []

  const fields = useMemo<Field[]>(
    () => tableColumns.map((c) => ({ name: c.columnName, label: c.columnName })),
    [tableColumns]
  )

  function toggleColumn(col: string) {
    setColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]))
  }

  async function handleRun() {
    if (!connectionId || !table) return
    setRunning(true)
    setRunError(null)
    setSaveMessage(null)
    try {
      const res = await callFunction<QueryResult>('run-query', {
        connectionId,
        structuredQuery: { table, columns, filter },
      })
      setResult(res)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  async function handleSave() {
    if (!saveName || !connectionId || !table) return
    setSaving(true)
    setSaveMessage(null)
    try {
      await callFunction('save-query', {
        connectionId,
        name: saveName,
        structuredQuery: { table, columns, filter },
      })
      setSaveMessage('Saved.')
      setTimeout(() => navigate('/queries'), 800)
    } catch (err) {
      setSaveMessage(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1>Query builder</h1>

      <label>
        Connection
        <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
          <option value="">Select a connection…</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {loadingSchema && <p>Loading schema…</p>}
      {schemaError && <p className="auth-error">{schemaError}</p>}

      {schema && (
        <>
          <div style={{ marginTop: 16 }}>
            <label>
              Table
              <select value={table} onChange={(e) => { setTable(e.target.value); setColumns([]); setFilter(emptyQuery) }}>
                <option value="">Select a table…</option>
                {tableNames.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {table && (
            <>
              <div style={{ marginTop: 16 }}>
                <strong>Columns</strong> (none selected = all)
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {tableColumns.map((c) => (
                    <label key={c.columnName} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={columns.includes(c.columnName)}
                        onChange={() => toggleColumn(c.columnName)}
                      />
                      {c.columnName}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <strong>Filters</strong>
                <QueryBuilder fields={fields} query={filter} onQueryChange={setFilter} />
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={handleRun} disabled={running}>
                  {running ? 'Running…' : 'Run query'}
                </button>
                <input
                  placeholder="Query name"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                />
                <button onClick={handleSave} disabled={saving || !saveName}>
                  {saving ? 'Saving…' : 'Save query'}
                </button>
                {saveMessage && <span>{saveMessage}</span>}
              </div>
            </>
          )}
        </>
      )}

      {runError && <p className="auth-error">{runError}</p>}

      {result && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            {result.rowCount} row(s){result.rowCapped ? ' (capped)' : ''} — <code>{result.generatedSql}</code>
          </p>
          <ResultsGrid rows={result.rows} />
        </div>
      )}
    </div>
  )
}
