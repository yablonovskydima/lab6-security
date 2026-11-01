import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../api/client'
import type { Message, TokenOut, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/Alert'
import { formatDate } from '../components/format'
import { PasswordStrength } from '../components/PasswordStrength'

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState(user?.full_name ?? '')
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  async function saveName(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      setUser(await api<User>('/users/me', { method: 'PATCH', body: { full_name: name || null } }))
      setSaved('Profile saved')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h1>My profile</h1>
        <dl className="details">
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Role</dt>
          <dd>
            <span className={`badge ${user.role === 'admin' ? 'badge-admin' : ''}`}>{user.role}</span>
          </dd>
          <dt>Account status</dt>
          <dd>
            {user.is_verified ? (
              <span className="badge badge-ok">Activated</span>
            ) : (
              <span className="badge badge-warn">Not activated</span>
            )}
          </dd>
          <dt>Two-factor auth</dt>
          <dd>
            {user.mfa_enabled ? (
              <span className="badge badge-ok">Enabled</span>
            ) : (
              <span className="badge">Disabled</span>
            )}
          </dd>
          <dt>Member since</dt>
          <dd>{formatDate(user.created_at)}</dd>
        </dl>
        <Alert kind="success">{saved}</Alert>
        <Alert>{error}</Alert>
        <form onSubmit={saveName} className="form inline-form">
          <label>
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} onFocus={() => setSaved(null)} />
          </label>
          <button className="btn">Save</button>
        </form>
      </div>
      <PasswordCard />
      <MfaCard user={user} onChange={setUser} />
    </div>
  )
}

function PasswordCard() {
  const { signIn } = useAuth()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [info, setInfo] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const requestCode = () =>
    run(async () => {
      const res = await api<Message>('/users/me/password', {
        method: 'POST',
        body: { current_password: current, new_password: password },
      })
      setInfo(res.detail)
      setCode('')
      setStep('code')
    })

  function submit(e: FormEvent) {
    e.preventDefault()
    setDone(null)
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    requestCode()
  }

  function confirmCode(e: FormEvent) {
    e.preventDefault()
    run(async () => {
      const res = await api<TokenOut>('/users/me/password/confirm', { method: 'POST', body: { code } })
      await signIn(res.access_token)
      setCurrent('')
      setPassword('')
      setConfirm('')
      setInfo(null)
      setStep('form')
      setDone('Password changed. Other sessions have been signed out.')
    })
  }

  function cancel() {
    setStep('form')
    setInfo(null)
    setError(null)
  }

  return (
    <div className="card">
      <h2>Change password</h2>
      <p className="muted">
        The change takes effect after you confirm it with a code sent to your email. Signed up with Google and never set
        a password? Log out and use “Forgot password?” on the login page.
      </p>
      <Alert kind="success">{done}</Alert>
      <Alert kind="info">{info}</Alert>
      <Alert>{error && error.split('\n').map((line) => <div key={line}>{line}</div>)}</Alert>
      {step === 'code' && (
        <form onSubmit={confirmCode} className="form inline-form">
          <label>
            Code from email
            <input
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              autoFocus
            />
          </label>
          <button className="btn btn-primary" disabled={busy || code.length !== 6}>
            Confirm
          </button>
          <button type="button" className="btn btn-ghost" onClick={requestCode} disabled={busy}>
            Resend
          </button>
          <button type="button" className="btn btn-ghost" onClick={cancel}>
            Cancel
          </button>
        </form>
      )}
      {step === 'form' && (
        <form onSubmit={submit} className="form narrow-form">
          <label>
            Current password
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
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
            {busy ? 'Sending code…' : 'Change password'}
          </button>
        </form>
      )}
    </div>
  )
}

function MfaCard({ user, onChange }: { user: User; onChange: (u: User) => void }) {
  const [step, setStep] = useState<'idle' | 'code' | 'password'>('idle')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const startEnable = () =>
    run(async () => {
      const res = await api<Message>('/users/me/mfa/enable', { method: 'POST' })
      setInfo(res.detail)
      setCode('')
      setStep('code')
    })

  const confirmEnable = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      onChange(await api<User>('/users/me/mfa/confirm', { method: 'POST', body: { code } }))
      setInfo('Two-factor authentication is now enabled')
      setStep('idle')
    })
  }

  const disable = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      onChange(await api<User>('/users/me/mfa/disable', { method: 'POST', body: { password } }))
      setInfo('Two-factor authentication is now disabled')
      setPassword('')
      setStep('idle')
    })
  }

  function cancel() {
    setStep('idle')
    setError(null)
    setInfo(null)
  }

  return (
    <div className="card">
      <h2>Two-factor authentication</h2>
      <p className="muted">
        When enabled, after entering your password you will also need a one-time code sent to your email.
      </p>
      <Alert kind="info">{info}</Alert>
      <Alert>{error}</Alert>

      {step === 'idle' &&
        (user.mfa_enabled ? (
          <button className="btn btn-danger" onClick={() => setStep('password')}>
            Disable 2FA
          </button>
        ) : (
          <button className="btn btn-primary" onClick={startEnable} disabled={busy}>
            {busy ? 'Sending code…' : 'Enable 2FA'}
          </button>
        ))}

      {step === 'code' && (
        <form onSubmit={confirmEnable} className="form inline-form">
          <label>
            Code from email
            <input
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              autoFocus
            />
          </label>
          <button className="btn btn-primary" disabled={busy || code.length !== 6}>
            Confirm
          </button>
          <button type="button" className="btn btn-ghost" onClick={startEnable} disabled={busy}>
            Resend
          </button>
          <button type="button" className="btn btn-ghost" onClick={cancel}>
            Cancel
          </button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={disable} className="form inline-form">
          <label>
            Confirm with your password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </label>
          <button className="btn btn-danger" disabled={busy || !password}>
            Disable
          </button>
          <button type="button" className="btn btn-ghost" onClick={cancel}>
            Cancel
          </button>
        </form>
      )}
    </div>
  )
}
