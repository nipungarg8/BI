import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { callFunction } from '../lib/functions'
import type { DashboardCard, QueryCache } from '../types/dashboard'
import type { SavedQuery } from '../types/query'
import { ResultsGrid } from './ResultsGrid'

const PALETTE = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2']

export function ChartCard({
  card,
  onDelete,
}: {
  card: DashboardCard
  onDelete: (id: string) => void
}) {
  const [cache, setCache] = useState<QueryCache | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadCache() {
    setLoading(true)
    const { data } = await supabase
      .from('query_cache')
      .select('*')
      .eq('saved_query_id', card.saved_query_id)
      .maybeSingle()
    setCache(data as QueryCache | null)
    setLoading(false)
  }

  useEffect(() => {
    loadCache()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.saved_query_id])

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    try {
      const { data: sq } = await supabase
        .from('saved_queries')
        .select('*')
        .eq('id', card.saved_query_id)
        .single()
      const savedQuery = sq as SavedQuery
      await callFunction('run-query', {
        connectionId: savedQuery.connection_id,
        structuredQuery: savedQuery.structured_query,
        savedQueryId: card.saved_query_id,
      })
      await loadCache()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRefreshing(false)
    }
  }

  const rows = cache?.result ?? []
  const { xField, yField } = card.config

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{card.saved_queries?.name ?? 'Untitled'}</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button onClick={() => onDelete(card.id)}>Remove</button>
        </div>
      </div>
      {cache && (
        <p style={{ fontSize: 12, opacity: 0.6 }}>
          Cached {new Date(cache.cached_at).toLocaleString()} ({cache.row_count} rows)
        </p>
      )}
      {error && <p className="auth-error">{error}</p>}
      {loading && <p>Loading…</p>}

      {!loading && rows.length === 0 && <p>No cached data yet — click Refresh.</p>}

      {!loading && rows.length > 0 && card.chart_type === 'bar' && (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xField} />
            <YAxis />
            <Tooltip />
            <Bar dataKey={yField} fill={PALETTE[0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {!loading && rows.length > 0 && card.chart_type === 'line' && (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xField} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey={yField} stroke={PALETTE[1]} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {!loading && rows.length > 0 && card.chart_type === 'pie' && (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie data={rows} dataKey={yField} nameKey={xField} outerRadius={100} label>
              {rows.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}

      {!loading && rows.length > 0 && card.chart_type === 'table' && <ResultsGrid rows={rows} />}
    </div>
  )
}
