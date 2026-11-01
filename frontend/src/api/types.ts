export type Role = 'user' | 'admin'

export interface User {
  id: number
  email: string
  full_name: string | null
  role: Role
  is_active: boolean
  is_verified: boolean
  mfa_enabled: boolean
  created_at: string
}

export interface AdminUser extends User {
  is_locked: boolean
  locked_until: string | null
  failed_login_attempts: number
}

export interface TokenOut {
  access_token: string
  token_type: string
  expires_in: number
}

export interface MfaChallengeOut {
  mfa_required: true
  mfa_token: string
  expires_in: number
  detail: string
}

export interface Message {
  detail: string
}

export interface CaptchaConfig {
  enabled: boolean
  provider: 'image' | 'turnstile' | 'recaptcha'
  site_key: string | null
}

export interface CaptchaImage {
  captcha_id: string
  image: string
  expires_in: number
}

export interface Product {
  id: number
  name: string
  description: string | null
  price: string
  stock: number
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'cancelled'

export interface OrderItem {
  product_id: number
  quantity: number
  price: string
}

export interface Order {
  id: number
  user_id: number
  status: OrderStatus
  created_at: string
  items: OrderItem[]
  total: string
}

export type LoginResult =
  | 'success'
  | 'invalid_credentials'
  | 'locked'
  | 'blocked'
  | 'not_verified'
  | 'ip_throttled'
  | 'mfa_pending'
  | 'mfa_failed'

export interface LoginAttempt {
  id: number
  user_id: number | null
  email: string
  ip_address: string | null
  user_agent: string | null
  method: 'password' | 'google'
  result: LoginResult
  success: boolean
  created_at: string
}

export interface LoginAttemptSummary {
  email: string
  user_id: number | null
  total: number
  failed: number
  last_attempt_at: string
}
