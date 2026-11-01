import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/Alert'

export function OAuthCallbackPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useState(() => new URLSearchParams(window.location.hash.slice(1)))
  const [error, setError] = useState<string | null>(() =>
    params.has('access_token') || params.has('mfa_token') ? null : (params.get('error') ?? 'Sign-in failed'),
  )
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true
    window.history.replaceState(null, '', window.location.pathname)

    const accessToken = params.get('access_token')
    const mfaToken = params.get('mfa_token')
    if (accessToken) {
      signIn(accessToken)
        .then(() => navigate('/profile', { replace: true }))
        .catch((err) => setError(errorMessage(err)))
    } else if (mfaToken) {
      navigate('/login', {
        replace: true,
        state: { mfaToken, mfaExpiresIn: Number(params.get('expires_in') ?? 300) },
      })
    }
  }, [params, signIn, navigate])

  return (
    <div className="card narrow">
      <h1>Signing in with Google</h1>
      {error ? (
        <>
          <Alert>{error}</Alert>
          <Link to="/login">Back to login</Link>
        </>
      ) : (
        <p className="muted">Please wait…</p>
      )}
    </div>
  )
}
