import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { callFunction } from '../lib/functions'
import type { Connection } from '../types/connection'

export function ConnectionNew() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    host: '',
    port: 5432,
    dbName: '',
    username: '',
    password: '',
    sslMode: 'require',
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setTestResult(null)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    setError(null)
    try {
      const result = await callFunction<{ ok: boolean; error?: string }>(
        'test-connection',
        form
      )
      setTestResult(result.ok ? 'Connection successful.' : `Failed: ${result.error}`)
    } catch (err) {
      setTestResult(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await callFunction<{ connection: Connection }>('create-connection', form)
      navigate('/connections')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1>Add connection</h1>
      <p style={{ fontSize: 14, opacity: 0.8 }}>
        Use a read-only database user. Credentials are encrypted before storage and only ever
        used server-side.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <p className="auth-error">{error}</p>}
        <label>
          Connection name
          <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </label>
        <label>
          Host
          <input value={form.host} onChange={(e) => update('host', e.target.value)} required />
        </label>
        <label>
          Port
          <input
            type="number"
            value={form.port}
            onChange={(e) => update('port', Number(e.target.value))}
            required
          />
        </label>
        <label>
          Database name
          <input value={form.dbName} onChange={(e) => update('dbName', e.target.value)} required />
        </label>
        <label>
          Username (read-only role)
          <input
            value={form.username}
            onChange={(e) => update('username', e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            required
          />
        </label>
        <label>
          SSL mode
          <select value={form.sslMode} onChange={(e) => update('sslMode', e.target.value)}>
            <option value="require">require</option>
            <option value="disable">disable</option>
          </select>
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save connection'}
          </button>
        </div>
        {testResult && <p>{testResult}</p>}
      </form>
    </div>
  )
}
