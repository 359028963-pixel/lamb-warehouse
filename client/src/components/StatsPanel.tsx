import { useEffect, useState } from 'react'
import { api, fmtKg, type DayStats, type Stock } from '../api/client'

type Props = { stock: Stock | null }
type Mode = 'day' | 'week' | 'month' | 'year'

export default function StatsPanel({ stock }: Props) {
  const [mode, setMode] = useState<Mode>('day')
  const [data, setData] = useState<DayStats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        let res: DayStats
        if (mode === 'day') res = await api.statsToday()
        else if (mode === 'week') res = await api.statsWeek()
        else if (mode === 'month') res = await api.statsMonth()
        else res = await api.statsYear()
        if (!cancelled) setData(res)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode])

  const maxBar = Math.max(
    1,
    ...(data?.series || []).map((s) => Math.max(s.inbound, s.outbound)),
  )

  return (
    <div className="panel">
      <div className="segment">
        {(
          [
            ['day', '今日'],
            ['week', '近7天'],
            ['month', '本月'],
            ['year', '本年'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={mode === k ? 'seg active' : 'seg'}
            onClick={() => setMode(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="alert error">{error}</div>}
      {loading && <p className="muted">加载统计中…</p>}

      {!loading && data && (
        <>
          <div className="stat-cards">
            <div className="stat-card in">
              <div className="stat-label">入库合计</div>
              <div className="stat-value">{fmtKg(data.inbound)} <small>kg</small></div>
            </div>
            <div className="stat-card out">
              <div className="stat-label">出库合计</div>
              <div className="stat-value">{fmtKg(data.outbound)} <small>kg</small></div>
            </div>
            <div className="stat-card net">
              <div className="stat-label">净变化</div>
              <div className="stat-value">
                {data.net >= 0 ? '+' : ''}
                {fmtKg(data.net)} <small>kg</small>
              </div>
            </div>
            <div className="stat-card stock">
              <div className="stat-label">当前库存</div>
              <div className="stat-value">
                {fmtKg(data.stock ?? stock?.stock ?? 0)} <small>kg</small>
              </div>
            </div>
          </div>

          {mode === 'day' && (
            <p className="muted center">统计日期：{data.date}</p>
          )}
          {mode === 'week' && (
            <p className="muted center">
              {data.startDate} ～ {data.endDate}
            </p>
          )}

          {data.series && data.series.length > 0 && (
            <section className="card">
              <h3 className="section-title">
                {mode === 'year' ? '各月明细' : '每日明细'}
              </h3>
              <div className="bars">
                {data.series.map((row) => {
                  const key = row.date || row.month || row.label || ''
                  const label =
                    row.label ||
                    (row.date ? row.date.slice(5) : row.month?.slice(5) + '月') ||
                    key
                  return (
                    <div key={key} className="bar-row">
                      <div className="bar-label">{label}</div>
                      <div className="bar-tracks">
                        <div className="bar-track">
                          <div
                            className="bar fill-in"
                            style={{ width: `${(row.inbound / maxBar) * 100}%` }}
                            title={`入库 ${row.inbound}`}
                          />
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar fill-out"
                            style={{ width: `${(row.outbound / maxBar) * 100}%` }}
                            title={`出库 ${row.outbound}`}
                          />
                        </div>
                      </div>
                      <div className="bar-nums">
                        <span className="c-in">+{fmtKg(row.inbound)}</span>
                        <span className="c-out">−{fmtKg(row.outbound)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="legend">
                <span>
                  <i className="dot in" /> 入库
                </span>
                <span>
                  <i className="dot out" /> 出库
                </span>
              </div>
            </section>
          )}

          {mode !== 'day' && (
            <div className="table-wrap card">
              <table>
                <thead>
                  <tr>
                    <th>{mode === 'year' ? '月份' : '日期'}</th>
                    <th>入库 (kg)</th>
                    <th>出库 (kg)</th>
                    <th>净变化</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.series || [])
                    .filter((r) => r.inbound > 0 || r.outbound > 0)
                    .map((r) => (
                      <tr key={r.date || r.month}>
                        <td>{r.label || r.date || r.month}</td>
                        <td className="c-in">{fmtKg(r.inbound)}</td>
                        <td className="c-out">{fmtKg(r.outbound)}</td>
                        <td>
                          {r.net >= 0 ? '+' : ''}
                          {fmtKg(r.net)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {(data.series || []).every((r) => r.inbound === 0 && r.outbound === 0) && (
                <p className="muted empty">该时段暂无进出库数据</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
