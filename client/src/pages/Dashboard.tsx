import { useCallback, useEffect, useState } from 'react'
import { api, fmtKg, type Stock, type User } from '../api/client'
import TodayPanel from '../components/TodayPanel'
import StatsPanel from '../components/StatsPanel'

type Props = { user: User; onLogout: () => void }
type Tab = 'today' | 'stats'

export default function Dashboard({ user, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('today')
  const [stock, setStock] = useState<Stock | null>(null)

  const refreshStock = useCallback(async () => {
    try {
      const s = await api.stock()
      setStock(s)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    refreshStock()
  }, [refreshStock])

  async function handleLogout() {
    try {
      await api.logout()
    } finally {
      onLogout()
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo-sm">🐑</span>
          <div>
            <div className="topbar-title">羊肉仓库</div>
            <div className="topbar-sub">{user.username} · 超级管理员</div>
          </div>
        </div>
        <div className="stock-pill" title="当前库存">
          <span className="stock-label">库存</span>
          <strong>{stock ? fmtKg(stock.stock) : '—'} kg</strong>
        </div>
        <button type="button" className="btn ghost" onClick={handleLogout}>
          退出
        </button>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={tab === 'today' ? 'tab active' : 'tab'}
          onClick={() => setTab('today')}
        >
          今日录入
        </button>
        <button
          type="button"
          className={tab === 'stats' ? 'tab active' : 'tab'}
          onClick={() => setTab('stats')}
        >
          统计
        </button>
      </nav>

      <main className="main">
        {tab === 'today' ? (
          <TodayPanel
            onStockChange={(s) => {
              setStock(s)
            }}
          />
        ) : (
          <StatsPanel stock={stock} />
        )}
      </main>
    </div>
  )
}
