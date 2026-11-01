import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../api/client'
import type { CaptchaImage } from '../api/types'
import type { CaptchaHandle } from './Captcha'

interface Props {
  onChange: (captchaId: string, answer: string) => void
  onError?: (message: string) => void
}

export const ImageCaptcha = forwardRef<CaptchaHandle, Props>(function ImageCaptcha({ onChange, onError }, ref) {
  const [challenge, setChallenge] = useState<CaptchaImage | null>(null)
  const [answer, setAnswer] = useState('')
  const callbacks = useRef({ onChange, onError })
  useLayoutEffect(() => {
    callbacks.current = { onChange, onError }
  })

  const load = useCallback(() => {
    api<CaptchaImage>('/auth/captcha')
      .then((c) => {
        setChallenge(c)
        setAnswer('')
        callbacks.current.onChange(c.captcha_id, '')
      })
      .catch((err) => callbacks.current.onError?.(errorMessage(err)))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useImperativeHandle(ref, () => ({ reset: load }), [load])

  function change(value: string) {
    const v = value.toUpperCase().replace(/\s/g, '').slice(0, 10)
    setAnswer(v)
    callbacks.current.onChange(challenge?.captcha_id ?? '', v)
  }

  return (
    <div className="captcha-image">
      <div className="captcha-picture">
        {challenge ? (
          <img src={challenge.image} alt="CAPTCHA: type the characters shown" width={220} height={80} />
        ) : (
          <div className="captcha-placeholder" />
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={load} title="Show another image">
          <RefreshIcon /> New image
        </button>
      </div>
      <label>
        Type the characters from the image
        <input
          className="captcha-input"
          value={answer}
          onChange={(e) => change(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="e.g. 7KQ4P"
          required
        />
      </label>
    </div>
  )
})

function RefreshIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}
