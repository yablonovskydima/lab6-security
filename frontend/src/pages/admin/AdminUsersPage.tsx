import { useEffect, useState } from 'react'
import { api, errorMessage } from '../../api/client'
import type { AdminUser } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Alert } from '../../components/Alert'
import { formatDate } from '../../components/format'

export function AdminUsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = () =>
    api<AdminUser[]>('/admin/users')
      .then(setUsers)
      .catch((err) => setError(errorMessage(err)))

  useEffect(() => {
    load()
  }, [])

  async function act(path: string, body?: unknown) {
    setError(null)
    try {
      const updated = await api<AdminUser>(path, { method: body ? 'PATCH' : 'POST', body })
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="card">
      <div className="row-between">
        <h1>Users</h1>
        <button className="btn btn-ghost" onClick={load}>
          Refresh
        </button>
      </div>
      <Alert>{error}</Alert>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Role</th>
              <th>Activated</th>
              <th>2FA</th>
              <th>Status</th>
              <th>Failed logins</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === me?.id
              return (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>
                    {u.email}
                    {u.full_name && <div className="muted small">{u.full_name}</div>}
                  </td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-admin' : ''}`}>{u.role}</span>
                  </td>
                  <td>{u.is_verified ? <span className="badge badge-ok">yes</span> : <span className="badge badge-warn">no</span>}</td>
                  <td>{u.mfa_enabled ? 'on' : 'off'}</td>
                  <td>
                    {!u.is_active ? (
                      <span className="badge badge-error">blocked</span>
                    ) : u.is_locked ? (
                      <span className="badge badge-warn" title={`until ${formatDate(u.locked_until)}`}>
                        locked until {new Date(u.locked_until!).toLocaleTimeString()}
                      </span>
                    ) : (
                      <span className="badge badge-ok">active</span>
                    )}
                  </td>
                  <td>{u.failed_login_attempts}</td>
                  <td className="nowrap small" title={formatDate(u.created_at)}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="actions">
                    {!self && (
                      <>
                        {u.is_active && !u.is_locked ? (
                          <button className="btn btn-sm btn-danger" onClick={() => act(`/admin/users/${u.id}/block`)}>
                            Block
                          </button>
                        ) : (
                          <button className="btn btn-sm" onClick={() => act(`/admin/users/${u.id}/unblock`)}>
                            Unblock
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => act(`/admin/users/${u.id}/role`, { role: u.role === 'admin' ? 'user' : 'admin' })}
                        >
                          Make {u.role === 'admin' ? 'user' : 'admin'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
