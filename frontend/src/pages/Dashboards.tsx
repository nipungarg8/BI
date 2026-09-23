import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import type { Dashboard } from '../types/dashboard'

export function Dashboards() {
  const { user } = useAuth()
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('dashboards')
      .select('*')
      .order('created_at', { ascending: false })
    setDashboards((data as Dashboard[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name || !user) return
    setCreating(true)
    await supabase.from('dashboards').insert({ user_id: user.id, name, layout: {} })
    setName('')
    setCreating(false)
    load()
  }

  return (
    <div>
      <h1>Dashboards</h1>
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          placeholder="New dashboard name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={creating || !name}>
          Create
        </button>
      </form>

      {loading && <p>Loading…</p>}
      {!loading && dashboards.length === 0 && <p>No dashboards yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {dashboards.map((d) => (
          <li key={d.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <Link to={`/dashboards/${d.id}`}>{d.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
