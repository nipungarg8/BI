import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Connection } from '../types/connection'

export function Connections() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('connections_public')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setConnections(data as Connection[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Delete this connection? Saved queries using it will stop working.')) return
    const { error } = await supabase.from('connections').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setConnections((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Connections</h1>
        <Link to="/connections/new">
          <button>Add connection</button>
        </Link>
      </div>
      {error && <p className="auth-error">{error}</p>}
      {loading && <p>Loading…</p>}
      {!loading && connections.length === 0 && (
        <p>No connections yet. Add one to start building queries.</p>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <tbody>
          {connections.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 4px' }}>
                <strong>{c.name}</strong>
                <div style={{ fontSize: 13, opacity: 0.7 }}>
                  {c.username}@{c.host}:{c.port}/{c.db_name}
                </div>
              </td>
              <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                <button onClick={() => handleDelete(c.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
