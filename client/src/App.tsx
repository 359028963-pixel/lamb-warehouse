import { useCallback, useEffect, useState } from 'react'
import { api, type User } from './api/client'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async () => {
    try {
      const { user } = await api.me()
      setUser(user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMe()
  }, [refreshMe])

  if (loading) {
    return (
      <div className="boot">
        <div className="spinner" />
        <p>加载中…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <LoginPage
        onSuccess={(u) => {
          setUser(u)
        }}
      />
    )
  }

  return (
    <Dashboard
      user={user}
      onLogout={() => {
        setUser(null)
      }}
    />
  )
}
