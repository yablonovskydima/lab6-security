import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import type { CaptchaConfig } from '../api/types'

interface WidgetApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string | number
  reset: (id?: string | number) => void
}

declare global {
  interface Window {
    turnstile?: WidgetApi
    grecaptcha?: WidgetApi & { ready?: (cb: () => void) => void }
    onCaptchaLoad?: () => void
  }
}

const SCRIPTS = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onCaptchaLoad',
  recaptcha: 'https://www.google.com/recaptcha/api.js?render=explicit&onload=onCaptchaLoad',
}

let loading: Promise<void> | null = null

type WidgetProvider = keyof typeof SCRIPTS

function widgetFor(provider: WidgetProvider): WidgetApi | undefined {
  return provider === 'turnstile' ? window.turnstile : window.grecaptcha
}

function loadScript(provider: WidgetProvider): Promise<void> {
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    window.onCaptchaLoad = () => resolve()
    const script = document.createElement('script')
    script.src = SCRIPTS[provider]
    script.async = true
    script.onerror = () => {
      loading = null
      reject(new Error('Failed to load CAPTCHA'))
    }
    document.head.appendChild(script)
  })
  return loading
}

export interface CaptchaHandle {
  reset: () => void
}

interface Props {
  config: CaptchaConfig & { provider: WidgetProvider }
  onToken: (token: string) => void
  onError?: (message: string) => void
}

export const Captcha = forwardRef<CaptchaHandle, Props>(function Captcha({ config, onToken, onError }, ref) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | number | null>(null)
  const callbacks = useRef({ onToken, onError })
  useLayoutEffect(() => {
    callbacks.current = { onToken, onError }
  })

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current !== null) widgetFor(config.provider)?.reset(widgetId.current)
      callbacks.current.onToken('')
    },
  }))

  useEffect(() => {
    if (!config.site_key) return
    let cancelled = false
    loadScript(config.provider)
      .then(() => {
        const w = widgetFor(config.provider)
        if (cancelled || !w || !container.current || widgetId.current !== null) return
        widgetId.current = w.render(container.current, {
          sitekey: config.site_key,
          callback: (token: string) => callbacks.current.onToken(token),
          'expired-callback': () => callbacks.current.onToken(''),
          'error-callback': () => callbacks.current.onError?.('CAPTCHA error, try again'),
        })
      })
      .catch((err: Error) => callbacks.current.onError?.(err.message))
    return () => {
      cancelled = true
    }
  }, [config.provider, config.site_key])

  return <div ref={container} className="captcha" />
})
