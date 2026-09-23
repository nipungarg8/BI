import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { SavedQuery } from '../types/query'

export function Queries() {
  const [queries, setQueries] = useState<SavedQuery[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('saved_queries')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setQueries((data as SavedQuery[]) ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Saved queries</h1>
        <Link to="/queries/new">
          <button>New query</button>
        </Link>
      </div>
      {loading && <p>Loading…</p>}
      {!loading && queries.length === 0 && <p>No saved queries yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {queries.map((q) => (
          <li key={q.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <Link to={`/queries/${q.id}`}>
              <strong>{q.name}</strong>
            </Link>
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              <code>{q.generated_sql}</code>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
