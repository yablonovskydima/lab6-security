import { useEffect, useState } from 'react'

export function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const left = Math.max(0, Math.round((until - now) / 1000))
  if (left === 0) return <span className="text-error">expired</span>
  const m = Math.floor(left / 60)
  const s = String(left % 60).padStart(2, '0')
  return (
    <span>
      {m}:{s}
    </span>
  )
}
