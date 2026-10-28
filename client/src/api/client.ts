export type User = { id: number; username: string; role: string }

export type Stock = { inbound: number; outbound: number; stock: number }

export type Movement = {
  id: number
  type: 'in' | 'out'
  kilograms: number
  note: string | null
  moved_at: string
  created_at: string
}

export type DayStats = {
  date?: string
  startDate?: string
  endDate?: string
  year?: number
  month?: number
  inbound: number
  outbound: number
  net: number
  stock: number
  series?: Array<{
    date?: string
    month?: string
    label?: string
    inbound: number
    outbound: number
    net: number
  }>
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `请求失败 (${res.status})`)
  }
  return data as T
}

export const api = {
  login: (username: string, password: string) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ user: User }>('/api/auth/me'),
  stock: () => request<Stock>('/api/stock'),
  movements: (date: string) =>
    request<{ date: string; items: Movement[]; stock: Stock }>(
      `/api/movements?date=${encodeURIComponent(date)}`,
    ),
  addMovement: (body: {
    type: 'in' | 'out'
    kilograms: number
    note?: string
    moved_at?: string
  }) =>
    request<{ item: Movement; stock: Stock }>('/api/movements', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteMovement: (id: number, password: string) =>
    request<{ ok: boolean; stock: Stock }>(`/api/movements/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),
  statsToday: (date?: string) =>
    request<DayStats>(
      `/api/stats/today${date ? `?date=${encodeURIComponent(date)}` : ''}`,
    ),
  statsWeek: () => request<DayStats>('/api/stats/week'),
  statsMonth: (year?: number, month?: number) => {
    const q = new URLSearchParams()
    if (year) q.set('year', String(year))
    if (month) q.set('month', String(month))
    const s = q.toString()
    return request<DayStats>(`/api/stats/month${s ? `?${s}` : ''}`)
  },
  statsYear: (year?: number) =>
    request<DayStats>(`/api/stats/year${year ? `?year=${year}` : ''}`),
}

export function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fmtKg(n: number): string {
  return Number(n).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}
