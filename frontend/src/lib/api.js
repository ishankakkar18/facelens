const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const TOKEN_KEY = 'facelens_token'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let payload
  if (form) {
    payload = form
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError('Could not reach the server. Is the backend running?', 0)
  }

  if (!response.ok) {
    let detail = response.statusText
    try {
      const data = await response.json()
      if (Array.isArray(data.detail)) {
        detail = data.detail.map((d) => d.msg || d).join(', ')
      } else if (data.detail) {
        detail = data.detail
      }
    } catch {
      /* ignore parse errors */
    }
    throw new ApiError(detail || 'Something went wrong.', response.status)
  }

  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return response.json()
  return response
}

export function imageUrl(path) {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

export const API_URL = API_BASE

// --- Auth ---
export const authApi = {
  register: (email, password) => request('/api/auth/register', { method: 'POST', body: { email, password } }),
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/api/auth/me'),
}

// --- Analysis ---
export const analysisApi = {
  analyze: (file, { consent = true, save = false } = {}) => {
    const form = new FormData()
    form.append('file', file)
    form.append('consent', String(consent))
    form.append('save', String(save))
    return request('/api/analyze', { method: 'POST', form })
  },
  list: (limit = 50, offset = 0) => request(`/api/analyses?limit=${limit}&offset=${offset}`),
  get: (id) => request(`/api/analyses/${id}`),
  remove: (id) => request(`/api/analyses/${id}`, { method: 'DELETE' }),
  pdf: async (id) => {
    const token = getToken()
    const response = await fetch(`${API_BASE}/api/analyses/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) throw new ApiError('Could not download the report.', response.status)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `facelens-report-${id}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },
}

// --- Tracker ---
export const trackerApi = {
  summary: () => request('/api/tracker/summary'),
  habits: (includeInactive = false) => request(`/api/tracker/habits?include_inactive=${includeInactive}`),
  createHabit: (title, category) => request('/api/tracker/habits', { method: 'POST', body: { title, category } }),
  updateHabit: (id, patch) => request(`/api/tracker/habits/${id}`, { method: 'PATCH', body: patch }),
  removeHabit: (id) => request(`/api/tracker/habits/${id}`, { method: 'DELETE' }),
  logs: (from, to) => request(`/api/tracker/logs?from=${from}&to=${to}`),
  upsertLog: (habitId, logDate, completed, notes) =>
    request('/api/tracker/logs', {
      method: 'POST',
      body: { habit_id: habitId, log_date: logDate, completed, notes },
    }),
}

// --- Progress photos ---
export const progressApi = {
  list: () => request('/api/progress/photos'),
  upload: (file, { photoDate, notes, runAnalysis } = {}) => {
    const form = new FormData()
    form.append('file', file)
    if (photoDate) form.append('photo_date', photoDate)
    if (notes) form.append('notes', notes)
    form.append('run_analysis', String(Boolean(runAnalysis)))
    return request('/api/progress/photos', { method: 'POST', form })
  },
  remove: (id) => request(`/api/progress/photos/${id}`, { method: 'DELETE' }),
}

// --- Insights ---
export const insightsApi = {
  changes: (previousId, currentId) => {
    const params = new URLSearchParams()
    if (previousId) params.set('previous_id', previousId)
    if (currentId) params.set('current_id', currentId)
    const query = params.toString()
    return request(`/api/insights/changes${query ? `?${query}` : ''}`)
  },
}

// --- Doctors ---
export const doctorApi = {
  list: (city) => request(`/api/doctors${city ? `?city=${encodeURIComponent(city)}` : ''}`),
  cities: () => request('/api/doctors/cities'),
  questions: () => request('/api/doctors/questions'),
  ask: (question) => request('/api/doctors/questions', { method: 'POST', body: { question } }),
  answer: (id, answer) => request(`/api/doctors/questions/${id}`, { method: 'PATCH', body: { answer } }),
  removeQuestion: (id) => request(`/api/doctors/questions/${id}`, { method: 'DELETE' }),
  visits: () => request('/api/doctors/visits'),
  addVisit: (visit) => request('/api/doctors/visits', { method: 'POST', body: visit }),
  updateVisit: (id, patch) => request(`/api/doctors/visits/${id}`, { method: 'PATCH', body: patch }),
  removeVisit: (id) => request(`/api/doctors/visits/${id}`, { method: 'DELETE' }),
}
