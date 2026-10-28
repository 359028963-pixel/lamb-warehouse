import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  api,
  fmtKg,
  todayLocal,
  type Movement,
  type Stock,
} from '../api/client'

type Props = { onStockChange: (s: Stock) => void }

export default function TodayPanel({ onStockChange }: Props) {
  const onStockChangeRef = useRef(onStockChange)
  useEffect(() => {
    onStockChangeRef.current = onStockChange
  }, [onStockChange])

  const [date, setDate] = useState(todayLocal())
  const [items, setItems] = useState<Movement[]>([])
  const [stock, setStock] = useState<Stock | null>(null)
  const [inKg, setInKg] = useState('')
  const [inNote, setInNote] = useState('')
  const [outKg, setOutKg] = useState('')
  const [outNote, setOutNote] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pendingDelete, setPendingDelete] = useState<Movement | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.movements(date)
      setItems(data.items)
      setStock(data.stock)
      onStockChangeRef.current(data.stock)
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '加载失败' })
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  async function submit(type: 'in' | 'out') {
    setMsg(null)
    const kg = Number(type === 'in' ? inKg : outKg)
    if (!Number.isFinite(kg) || kg <= 0) {
      setMsg({ type: 'err', text: '请输入大于 0 的公斤数' })
      return
    }
    setBusy(true)
    try {
      const res = await api.addMovement({
        type,
        kilograms: kg,
        note: (type === 'in' ? inNote : outNote).trim() || undefined,
        moved_at: date,
      })
      setStock(res.stock)
      onStockChangeRef.current(res.stock)
      if (type === 'in') {
        setInKg('')
        setInNote('')
      } else {
        setOutKg('')
        setOutNote('')
      }
      setMsg({ type: 'ok', text: type === 'in' ? '入库已保存' : '出库已保存' })
      await load()
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '保存失败' })
    } finally {
      setBusy(false)
    }
  }

  function askDelete(item: Movement) {
    setMsg(null)
    setPendingDelete(item)
    setDeletePassword('')
  }

  function cancelDelete() {
    if (deleteBusy) return
    setPendingDelete(null)
    setDeletePassword('')
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    if (!deletePassword.trim()) {
      setMsg({ type: 'err', text: '请输入登录密码以确认删除' })
      return
    }
    setDeleteBusy(true)
    setMsg(null)
    try {
      const res = await api.deleteMovement(pendingDelete.id, deletePassword)
      onStockChangeRef.current(res.stock)
      setPendingDelete(null)
      setDeletePassword('')
      setMsg({ type: 'ok', text: '已删除该记录' })
      await load()
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '删除失败' })
    } finally {
      setDeleteBusy(false)
    }
  }

  const dayIn = items.filter((i) => i.type === 'in').reduce((s, i) => s + i.kilograms, 0)
  const dayOut = items.filter((i) => i.type === 'out').reduce((s, i) => s + i.kilograms, 0)

  function onInSubmit(e: FormEvent) {
    e.preventDefault()
    submit('in')
  }
  function onOutSubmit(e: FormEvent) {
    e.preventDefault()
    submit('out')
  }

  return (
    <div className="panel">
      <div className="hero-stock">
        <div className="hero-label">当前库存</div>
        <div className="hero-value">{stock ? fmtKg(stock.stock) : '—'} <small>kg</small></div>
        <div className="hero-meta">
          累计入库 {stock ? fmtKg(stock.inbound) : '—'} · 累计出库{' '}
          {stock ? fmtKg(stock.outbound) : '—'}
        </div>
      </div>

      <div className="date-row">
        <label>
          业务日期
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button type="button" className="btn ghost" onClick={() => setDate(todayLocal())}>
          回到今天
        </button>
      </div>

      {msg && <div className={`alert ${msg.type === 'ok' ? 'ok' : 'error'}`}>{msg.text}</div>}

      <div className="forms-grid">
        <form className="card form-card in" onSubmit={onInSubmit}>
          <h3>入库</h3>
          <label>
            公斤数
            <input
              inputMode="decimal"
              value={inKg}
              onChange={(e) => setInKg(e.target.value)}
              placeholder="例如 120.5"
              required
            />
          </label>
          <label>
            备注（可选）
            <input value={inNote} onChange={(e) => setInNote(e.target.value)} placeholder="供应商/批次" />
          </label>
          <button type="submit" className="btn success block" disabled={busy}>
            保存入库
          </button>
        </form>

        <form className="card form-card out" onSubmit={onOutSubmit}>
          <h3>出库</h3>
          <label>
            公斤数
            <input
              inputMode="decimal"
              value={outKg}
              onChange={(e) => setOutKg(e.target.value)}
              placeholder="例如 45"
              required
            />
          </label>
          <label>
            备注（可选）
            <input value={outNote} onChange={(e) => setOutNote(e.target.value)} placeholder="去向/用途" />
          </label>
          <button type="submit" className="btn warn block" disabled={busy}>
            保存出库
          </button>
        </form>
      </div>

      <section className="card">
        <div className="section-head">
          <h3>{date} 当日记录</h3>
          <div className="chips">
            <span className="chip in">入 {fmtKg(dayIn)} kg</span>
            <span className="chip out">出 {fmtKg(dayOut)} kg</span>
            <span className="chip net">净 {fmtKg(dayIn - dayOut)} kg</span>
          </div>
        </div>
        {loading ? (
          <p className="muted">加载中…</p>
        ) : items.length === 0 ? (
          <p className="muted empty">暂无记录，请在上方录入</p>
        ) : (
          <ul className="record-list">
            {items.map((item) => (
              <li key={item.id} className="record">
                <span className={`badge ${item.type}`}>{item.type === 'in' ? '入库' : '出库'}</span>
                <div className="record-body">
                  <strong>
                    {item.type === 'in' ? '+' : '−'}
                    {fmtKg(item.kilograms)} kg
                  </strong>
                  {item.note && <span className="muted">{item.note}</span>}
                  <span className="muted tiny">{item.created_at}</span>
                </div>
                <button type="button" className="btn ghost danger" onClick={() => askDelete(item)}>
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingDelete && (
        <div className="modal-backdrop" role="presentation" onClick={cancelDelete}>
          <div
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-title">确认删除</h3>
            <p className="muted">
              将删除这条{pendingDelete.type === 'in' ? '入库' : '出库'}记录：
              <strong>
                {' '}
                {pendingDelete.type === 'in' ? '+' : '−'}
                {fmtKg(pendingDelete.kilograms)} kg
              </strong>
              。请输入登录密码确认。
            </p>
            <label>
              登录密码
              <input
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmDelete()
                }}
                placeholder="输入当前账号密码"
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={cancelDelete} disabled={deleteBusy}>
                取消
              </button>
              <button type="button" className="btn danger-solid" onClick={confirmDelete} disabled={deleteBusy}>
                {deleteBusy ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
