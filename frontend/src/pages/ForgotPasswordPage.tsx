import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { Message } from '../api/types'
import { Alert } from '../components/Alert'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api<Message>('/auth/password-reset/request', { method: 'POST', body: { email } })
      setDone(res.detail)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card narrow">
      <h1>Reset password</h1>
      {done ? (
        <>
          <Alert kind="success">{done}</Alert>
          <p className="muted">Check your inbox and follow the link to set a new password.</p>
        </>
      ) : (
        <>
          <p className="muted">Enter your email and we'll send you a link to set a new password.</p>
          <Alert>{error}</Alert>
          <form onSubmit={submit} className="form">
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </>
      )}
      <p className="muted small center">
        <Link to="/login">Back to login</Link>
      </p>
    </div>
  )
}
