const RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'Uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'Digit', test: (p) => /\d/.test(p) },
  { label: 'Special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

const COMMON = ['password', 'qwerty', '123456', '12345678', 'letmein', 'admin', 'welcome', 'iloveyou', 'abc123']

const LEVELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']

function score(password: string): number {
  if (!password) return 0
  const lower = password.toLowerCase()
  if (COMMON.some((c) => lower.includes(c))) return 0
  let s = RULES.filter((r) => r.test(password)).length - 1
  if (password.length >= 12) s += 1
  if (password.length >= 16) s += 1
  return Math.max(0, Math.min(4, s))
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const s = score(password)
  const common = COMMON.some((c) => password.toLowerCase().includes(c))
  return (
    <div className="strength">
      <div className="strength-bar">
        {LEVELS.map((_, i) => (
          <span key={i} className={i <= s ? `on level-${s}` : ''} />
        ))}
      </div>
      <div className="strength-label">
        Strength: <strong>{LEVELS[s]}</strong>
        {common && <span className="muted"> — contains a common password</span>}
      </div>
      <ul className="rules">
        {RULES.map((r) => (
          <li key={r.label} className={r.test(password) ? 'ok' : 'bad'}>
            {r.test(password) ? '✓' : '✗'} {r.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
