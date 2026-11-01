import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '../../api/client'
import type { LoginAttempt, LoginAttemptSummary, LoginResult } from '../../api/types'
import { Alert } from '../../components/Alert'
import { formatDate } from '../../components/format'

const RESULTS: LoginResult[] = [
  'success',
  'invalid_credentials',
  'locked',
  'blocked',
  'not_verified',
  'ip_throttled',
  'mfa_pending',
  'mfa_failed',
]

const RESULT_CLASS: Record<LoginResult, string> = {
  success: 'badge-ok',
  mfa_pending: 'badge-info',
  invalid_credentials: 'badge-error',
  mfa_failed: 'badge-error',
  locked: 'badge-warn',
  blocked: 'badge-warn',
  not_verified: 'badge-warn',
  ip_throttled: 'badge-warn',
}

export function AdminLoginLogPage() {
  const [summary, setSummary] = useState<LoginAttemptSummary[]>([])
  const [attempts, setAttempts] = useState<LoginAttempt[]>([])
  const [email, setEmail] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([
      api<LoginAttemptSummary[]>('/admin/login-attempts/summary'),
      api<LoginAttempt[]>('/admin/login-attempts', { query: { email, result, limit: 200 } }),
    ])
      .then(([s, a]) => {
        setSummary(s)
        setAttempts(a)
      })
      .catch((err) => setError(errorMessage(err)))
  }, [email, result])

  useEffect(() => {
    const id = setTimeout(load, 250)
    return () => clearTimeout(id)
  }, [load])

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <h1>Login log</h1>
          <button className="btn btn-ghost" onClick={load}>
            Refresh
          </button>
        </div>
        <Alert>{error}</Alert>
        <h2>Attempts per account</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th className="num">Total</th>
                <th className="num">Failed</th>
                <th>Last attempt</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.email} className="clickable" onClick={() => setEmail(s.email)}>
                  <td>
                    {s.email}
                    {s.user_id === null && <span className="muted small"> (unknown)</span>}
                  </td>
                  <td className="num">{s.total}</td>
                  <td className={`num ${s.failed > 0 ? 'text-error' : ''}`}>{s.failed}</td>
                  <td className="nowrap">{formatDate(s.last_attempt_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>All attempts</h2>
        <div className="filters">
          <input placeholder="Filter by email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">All results</option>
            {RESULTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {(email || result) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setEmail('')
                setResult('')
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Email</th>
                <th>IP</th>
                <th>Method</th>
                <th>Result</th>
                <th>User agent</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">{formatDate(a.created_at)}</td>
                  <td>{a.email}</td>
                  <td>{a.ip_address ?? '—'}</td>
                  <td>{a.method}</td>
                  <td>
                    <span className={`badge ${RESULT_CLASS[a.result]}`}>{a.result}</span>
                  </td>
                  <td className="muted small ellipsis" title={a.user_agent ?? ''}>
                    {a.user_agent ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {attempts.length === 0 && <p className="muted">No attempts.</p>}
      </div>
    </div>
  )
}
