import { createContext, useContext, useEffect, useState } from 'react'
import { authApi, getToken, setToken } from '../lib/api'

const AuthContext = createContext(null)

function withTimeout(promise, milliseconds) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), milliseconds),
    ),
  ])
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function boot() {
      if (!getToken()) {
        setLoading(false)
        return
      }
      try {
        const me = await withTimeout(authApi.me(), 60000)
        if (active) setUser(me)
      } catch (error) {
        if (error?.status === 401) setToken(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    boot()
    return () => {
      active = false
    }
  }, [])

  async function login(email, password) {
    const data = await authApi.login(email, password)
    setToken(data.access_token)
    setUser(data.user)
    return data
  }

  async function register(email, password) {
    const data = await authApi.register(email, password)
    setToken(data.access_token)
    setUser(data.user)
    return data
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
