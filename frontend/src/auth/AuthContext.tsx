import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setAccessToken, setUnauthorizedHandler } from '../api/client'
import type { User } from '../api/types'

const STORAGE_KEY = 'access_token'

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (token: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthState | null>(null)

function readToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => readToken() !== null)

  const clear = useCallback(() => {
    setAccessToken(null)
    writeToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    setUser(await api<User>('/users/me'))
  }, [])

  const signIn = useCallback(
    async (token: string) => {
      setAccessToken(token)
      writeToken(token)
      try {
        await refreshUser()
      } catch (err) {
        clear()
        throw err
      }
    },
    [clear, refreshUser],
  )

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
    clear()
  }, [clear])

  useEffect(() => {
    setUnauthorizedHandler(clear)
    const token = readToken()
    if (token) {
      setAccessToken(token)
      refreshUser()
        .catch(clear)
        .finally(() => setLoading(false))
    }
    return () => setUnauthorizedHandler(null)
  }, [clear, refreshUser])

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, refreshUser, setUser }),
    [user, loading, signIn, signOut, refreshUser],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
