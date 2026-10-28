import { useState } from 'react'
import type { FormEvent } from 'react'
import { api, type User } from '../api/client'

type Props = { onSuccess: (user: User) => void }

export default function LoginPage({ onSuccess }: Props) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { user } = await api.login(username.trim(), password)
      onSuccess(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <span className="logo" aria-hidden>
            🐑
          </span>
          <h1>羊肉仓库</h1>
          <p className="muted">进出库与库存管理</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            <span>用户名</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="管理员账号"
              required
            />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </label>
          {error && <div className="alert error">{error}</div>}
          <button type="submit" className="btn primary block" disabled={busy}>
            {busy ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="hint">
          首次使用默认账号：<strong>admin</strong> / <strong>admin123</strong>
        </p>
      </div>
    </div>
  )
}
