import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { Message } from '../api/types'
import { Alert } from '../components/Alert'

export function ActivatePage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current || !token) return
    sent.current = true
    api<Message>('/auth/activate', { method: 'POST', body: { token } })
      .then((res) => setResult({ ok: true, text: res.detail }))
      .catch((err) => setResult({ ok: false, text: errorMessage(err) }))
  }, [token])

  return (
    <div className="card narrow">
      <h1>Account activation</h1>
      {!token && <Alert>Activation link is missing a token</Alert>}
      {token && !result && <p className="muted">Activating…</p>}
      {result && <Alert kind={result.ok ? 'success' : 'error'}>{result.text}</Alert>}
      {result?.ok && (
        <Link to="/login" className="btn btn-primary">
          Log in
        </Link>
      )}
      {result && !result.ok && (
        <p className="muted small">
          The link may have expired or was already used. Try logging in — you can request a new link there.
        </p>
      )}
    </div>
  )
}
