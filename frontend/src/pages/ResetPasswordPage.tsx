import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { Message } from '../api/types'
import { Alert } from '../components/Alert'
import { PasswordStrength } from '../components/PasswordStrength'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api<Message>('/auth/password-reset/confirm', {
        method: 'POST',
        body: { token, new_password: password },
      })
      navigate('/login', { replace: true, state: { message: res.detail } })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <div className="card narrow">
        <h1>Set a new password</h1>
        <Alert>Reset link is missing a token.</Alert>
        <Link to="/forgot-password">Request a new link</Link>
      </div>
    )
  }

  return (
    <div className="card narrow">
      <h1>Set a new password</h1>
      <Alert>{error && error.split('\n').map((line) => <div key={line}>{line}</div>)}</Alert>
      <form onSubmit={submit} className="form">
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <PasswordStrength password={password} />
        <label>
          Confirm new password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </div>
  )
}
