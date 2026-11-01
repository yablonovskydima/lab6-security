import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { CaptchaConfig, User } from '../api/types'
import { Alert } from '../components/Alert'
import { Captcha, type CaptchaHandle } from '../components/Captcha'
import { ImageCaptcha } from '../components/ImageCaptcha'
import { PasswordStrength } from '../components/PasswordStrength'

export function RegisterPage() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [captchaConfig, setCaptchaConfig] = useState<CaptchaConfig | null>(null)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const captcha = useRef<CaptchaHandle>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<CaptchaConfig>('/auth/captcha-config')
      .then(setCaptchaConfig)
      .catch((err) => setError(errorMessage(err)))
  }, [])

  const captchaRequired = captchaConfig?.enabled ?? false
  const imageCaptcha = captchaConfig?.provider === 'image'
  const captchaReady = !captchaRequired || (captchaToken !== '' && (!imageCaptcha || captchaAnswer !== ''))
  const mismatch = confirm.length > 0 && password !== confirm

  function onImageCaptcha(id: string, answer: string) {
    setCaptchaToken(id)
    setCaptchaAnswer(answer)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const user = await api<User>('/auth/register', {
        method: 'POST',
        body: {
          email,
          password,
          full_name: fullName || null,
          captcha_token: captchaToken,
          captcha_answer: captchaAnswer,
        },
      })
      setDone(user.email)
    } catch (err) {
      setError(errorMessage(err))
      captcha.current?.reset()
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="card narrow">
        <h1>Check your email</h1>
        <Alert kind="success">
          Account created. We sent an activation link to <strong>{done}</strong>.
        </Alert>
        <p className="muted">Open the link to activate your account, then log in.</p>
        <Link to="/login" className="btn btn-primary">
          Go to login
        </Link>
      </div>
    )
  }

  return (
    <div className="card narrow">
      <h1>Create account</h1>
      <Alert>
        {error && error.split('\n').map((line) => <div key={line}>{line}</div>)}
      </Alert>
      <form onSubmit={submit} className="form">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          <span>
            Full name <span className="muted">(optional)</span>
          </span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
        </label>
        <label>
          Password
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
          Confirm password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            aria-invalid={mismatch}
            required
          />
          {mismatch && <span className="field-error">Passwords do not match</span>}
        </label>
        {captchaRequired &&
          captchaConfig &&
          (captchaConfig.provider === 'image' ? (
            <ImageCaptcha ref={captcha} onChange={onImageCaptcha} onError={setError} />
          ) : (
            <Captcha
              ref={captcha}
              config={{ ...captchaConfig, provider: captchaConfig.provider }}
              onToken={setCaptchaToken}
              onError={setError}
            />
          ))}
        <button className="btn btn-primary" disabled={busy || !captchaReady}>
          {busy ? 'Creating…' : 'Sign up'}
        </button>
      </form>
      <p className="muted small center">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  )
}
