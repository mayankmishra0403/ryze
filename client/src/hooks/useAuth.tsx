import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { http, setToken } from '../api/client'
import { connectSocket, disconnectSocket } from '../lib/socket'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, role?: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await http.post<{ accessToken: string; user: User }>(
        '/auth/refresh',
      )
      setToken(data.accessToken)
      setUser(data.user)
    } catch {
      setToken(null)
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    if (user) connectSocket()
    else disconnectSocket()
  }, [user])

  const login = useCallback(async (email: string, password: string) => {
    const data = await http.post<{ accessToken: string; user: User }>(
      '/auth/login',
      { email, password },
    )
    setToken(data.accessToken)
    setUser(data.user)
  }, [])

  const register = useCallback(
    async (name: string, email: string, password: string, role?: string) => {
      const data = await http.post<{ accessToken: string; user: User }>(
        '/auth/register',
        { name, email, password, role },
      )
      setToken(data.accessToken)
      setUser(data.user)
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await http.post('/auth/logout')
    } catch {
      // ignore — token clearing below is what matters
    }
    setToken(null)
    setUser(null)
    disconnectSocket()
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
