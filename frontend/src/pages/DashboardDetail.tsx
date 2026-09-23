import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Dashboard, DashboardCard, ChartType } from '../types/dashboard'
import type { SavedQuery } from '../types/query'
import { ChartCard } from '../components/ChartCard'

export function DashboardDetail() {
  const { id } = useParams<{ id: string }>()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [cards, setCards] = useState<DashboardCard[]>([])
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [loading, setLoading] = useState(true)

  const [savedQueryId, setSavedQueryId] = useState('')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [xField, setXField] = useState('')
  const [yField, setYField] = useState('')
  const [adding, setAdding] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    const [{ data: dashboardData }, { data: cardsData }, { data: queriesData }] =
      await Promise.all([
        supabase.from('dashboards').select('*').eq('id', id).single(),
        supabase
          .from('dashboard_cards')
          .select('*, saved_queries(name)')
          .eq('dashboard_id', id)
          .order('created_at', { ascending: true }),
        supabase.from('saved_queries').select('*').order('created_at', { ascending: false }),
      ])
    setDashboard(dashboardData as Dashboard)
    setCards((cardsData as DashboardCard[]) ?? [])
    setSavedQueries((queriesData as SavedQuery[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleAddCard(e: FormEvent) {
    e.preventDefault()
    if (!id || !savedQueryId) return
    setAdding(true)
    await supabase.from('dashboard_cards').insert({
      dashboard_id: id,
      saved_query_id: savedQueryId,
      chart_type: chartType,
      config: chartType === 'table' ? {} : { xField, yField },
    })
    setSavedQueryId('')
    setXField('')
    setYField('')
    setAdding(false)
    load()
  }

  async function handleDeleteCard(cardId: string) {
    await supabase.from('dashboard_cards').delete().eq('id', cardId)
    setCards((prev) => prev.filter((c) => c.id !== cardId))
  }

  if (loading) return <p>Loading…</p>
  if (!dashboard) return <p>Dashboard not found.</p>

  return (
    <div>
      <h1>{dashboard.name}</h1>

      <form
        onSubmit={handleAddCard}
        style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}
      >
        <select value={savedQueryId} onChange={(e) => setSavedQueryId(e.target.value)} required>
          <option value="">Select a saved query…</option>
          {savedQueries.map((q) => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
        </select>
        <select value={chartType} onChange={(e) => setChartType(e.target.value as ChartType)}>
          <option value="bar">Bar</option>
          <option value="line">Line</option>
          <option value="pie">Pie</option>
          <option value="table">Table</option>
        </select>
        {chartType !== 'table' && (
          <>
            <input
              placeholder="X field (column)"
              value={xField}
              onChange={(e) => setXField(e.target.value)}
              required
            />
            <input
              placeholder="Y field (column)"
              value={yField}
              onChange={(e) => setYField(e.target.value)}
              required
            />
          </>
        )}
        <button type="submit" disabled={adding}>
          Add card
        </button>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        {cards.map((card) => (
          <ChartCard key={card.id} card={card} onDelete={handleDeleteCard} />
        ))}
      </div>
    </div>
  )
}
