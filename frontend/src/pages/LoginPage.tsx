import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { API_URL, ApiError, api, errorMessage } from '../api/client'
import type { MfaChallengeOut, Message, TokenOut } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/Alert'
import { Countdown } from '../components/Countdown'

interface LocationState {
  from?: string
  mfaToken?: string
  mfaExpiresIn?: number
  message?: string
}

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const state = (useLocation().state ?? {}) as LocationState

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [mfa, setMfa] = useState<{ token: string; until: number } | null>(() =>
    state.mfaToken ? { token: state.mfaToken, until: Date.now() + (state.mfaExpiresIn ?? 300) * 1000 } : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [notActivated, setNotActivated] = useState(false)
  const [info, setInfo] = useState<string | null>(state.message ?? null)
  const [busy, setBusy] = useState(false)

  async function finish(token: string) {
    await signIn(token)
    navigate(state.from ?? '/profile', { replace: true })
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    setNotActivated(false)
    try {
      const res = await api<TokenOut | MfaChallengeOut>('/auth/login', { method: 'POST', body: { email, password } })
      if ('mfa_required' in res) {
        setMfa({ token: res.mfa_token, until: Date.now() + res.expires_in * 1000 })
        setInfo(`${res.detail}: ${email}`)
      } else {
        await finish(res.access_token)
      }
    } catch (err) {
      setError(errorMessage(err))
      setNotActivated(err instanceof ApiError && err.status === 403 && err.message.includes('not activated'))
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault()
    if (!mfa) return
    setBusy(true)
    setError(null)
    try {
      const res = await api<TokenOut>('/auth/login/mfa', { method: 'POST', body: { mfa_token: mfa.token, code } })
      await finish(res.access_token)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function resendActivation() {
    try {
      const res = await api<Message>('/auth/resend-activation', { method: 'POST', body: { email } })
      setInfo(res.detail)
      setError(null)
      setNotActivated(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  function backToPassword() {
    setMfa(null)
    setCode('')
    setError(null)
    setInfo(null)
  }

  if (mfa) {
    return (
      <div className="card narrow">
        <h1>Two-factor authentication</h1>
        <p className="muted">
          Enter the 6-digit code we sent to your email. It expires in <Countdown until={mfa.until} />.
        </p>
        <Alert kind="info">{info}</Alert>
        <Alert>{error}</Alert>
        <form onSubmit={submitCode} className="form">
          <label>
            Verification code
            <input
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              autoFocus
              required
            />
          </label>
          <button className="btn btn-primary" disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Verify'}
          </button>
        </form>
        <p className="muted small">
          Didn't get the code or it expired?{' '}
          <button className="link" onClick={backToPassword}>
            Log in again
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="card narrow">
      <h1>Log in</h1>
      <Alert kind="info">{info}</Alert>
      <Alert>
        {error}
        {notActivated && (
          <div>
            <button className="link" onClick={resendActivation}>
              Resend activation email
            </button>
          </div>
        )}
      </Alert>
      <form onSubmit={submitPassword} className="form">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <div className="row-between">
          <Link to="/forgot-password" className="small">
            Forgot password?
          </Link>
        </div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <div className="divider">or</div>
      <a className="btn btn-google" href={`${API_URL}/auth/google/login`}>
        <GoogleIcon /> Continue with Google
      </a>
      <p className="muted small center">
        No account? <Link to="/register">Sign up</Link>
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  )
}
