import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { callFunction } from '../lib/functions'
import type { Connection } from '../types/connection'
import type { QueryResult } from '../types/query'
import type { QueryRuleGroup } from '../types/aiSearch'
import { ResultsGrid } from '../components/ResultsGrid'

interface NlToSqlResponse {
  structuredQuery: { table: string; columns: string[]; filter: QueryRuleGroup; limit?: number }
  generatedSql: string
  explanation: string
}

interface SemanticMatch {
  table_name: string
  column_info: { columnName: string; dataType: string }[]
  similarity: number
}

export function AiSearch() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionId, setConnectionId] = useState('')

  const [question, setQuestion] = useState('')
  const [nlLoading, setNlLoading] = useState(false)
  const [nlResult, setNlResult] = useState<NlToSqlResponse | null>(null)
  const [nlError, setNlError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)

  const [semanticQuery, setSemanticQuery] = useState('')
  const [semanticLoading, setSemanticLoading] = useState(false)
  const [matches, setMatches] = useState<SemanticMatch[] | null>(null)
  const [semanticError, setSemanticError] = useState<string | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [indexMessage, setIndexMessage] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('connections_public')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setConnections((data as Connection[]) ?? []))
  }, [])

  async function handleAskNl() {
    if (!connectionId || !question) return
    setNlLoading(true)
    setNlError(null)
    setNlResult(null)
    setQueryResult(null)
    try {
      const res = await callFunction<NlToSqlResponse>('ai-nl-to-sql', {
        connectionId,
        question,
      })
      setNlResult(res)
    } catch (err) {
      setNlError(err instanceof Error ? err.message : String(err))
    } finally {
      setNlLoading(false)
    }
  }

  async function handleRunGenerated() {
    if (!nlResult || !connectionId) return
    setRunning(true)
    try {
      const res = await callFunction<QueryResult>('run-query', {
        connectionId,
        structuredQuery: nlResult.structuredQuery,
      })
      setQueryResult(res)
    } catch (err) {
      setNlError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  async function handleIndex() {
    if (!connectionId) return
    setIndexing(true)
    setIndexMessage(null)
    try {
      const res = await callFunction<{ indexed: number }>('index-schema', { connectionId })
      setIndexMessage(`Indexed ${res.indexed} table(s).`)
    } catch (err) {
      setIndexMessage(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIndexing(false)
    }
  }

  async function handleSemanticSearch() {
    if (!connectionId || !semanticQuery) return
    setSemanticLoading(true)
    setSemanticError(null)
    setMatches(null)
    try {
      const res = await callFunction<{ matches: SemanticMatch[] }>('ai-semantic-search', {
        connectionId,
        query: semanticQuery,
      })
      setMatches(res.matches)
    } catch (err) {
      setSemanticError(err instanceof Error ? err.message : String(err))
    } finally {
      setSemanticLoading(false)
    }
  }

  return (
    <div>
      <h1>AI Search</h1>
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        Uses sample/demo data only — free-tier Gemini prompts may be used by Google.
      </p>

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

      <section style={{ marginTop: 24 }}>
        <h2>Ask a question (natural language → SQL)</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ flex: 1 }}
            placeholder="e.g. Show customers who spent more than 500"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button onClick={handleAskNl} disabled={nlLoading || !connectionId}>
            {nlLoading ? 'Thinking…' : 'Ask'}
          </button>
        </div>
        {nlError && <p className="auth-error">{nlError}</p>}
        {nlResult && (
          <div style={{ marginTop: 12 }}>
            <p>{nlResult.explanation}</p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              <code>{nlResult.generatedSql}</code>
            </p>
            <p style={{ fontSize: 13 }}>Review the SQL above before running it.</p>
            <button onClick={handleRunGenerated} disabled={running}>
              {running ? 'Running…' : 'Run this query'}
            </button>
          </div>
        )}
        {queryResult && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 13, opacity: 0.8 }}>
              {queryResult.rowCount} row(s){queryResult.rowCapped ? ' (capped)' : ''}
            </p>
            <ResultsGrid rows={queryResult.rows} />
          </div>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Semantic search over tables</h2>
        <button onClick={handleIndex} disabled={indexing || !connectionId}>
          {indexing ? 'Indexing…' : 'Index schema for search'}
        </button>
        {indexMessage && <p>{indexMessage}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            style={{ flex: 1 }}
            placeholder="e.g. tables about payments"
            value={semanticQuery}
            onChange={(e) => setSemanticQuery(e.target.value)}
          />
          <button onClick={handleSemanticSearch} disabled={semanticLoading || !connectionId}>
            {semanticLoading ? 'Searching…' : 'Search'}
          </button>
        </div>
        {semanticError && <p className="auth-error">{semanticError}</p>}
        {matches && (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
            {matches.map((m) => (
              <li key={m.table_name} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <strong>{m.table_name}</strong>{' '}
                <span style={{ fontSize: 12, opacity: 0.6 }}>
                  (similarity {m.similarity.toFixed(3)})
                </span>
                <div style={{ fontSize: 13, opacity: 0.7 }}>
                  {m.column_info.map((c) => c.columnName).join(', ')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
