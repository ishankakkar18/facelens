import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icons'
import { Alert, Badge, EmptyState, PageHeader, Spinner } from '../components/UI'
import { trackerApi } from '../lib/api'
import { formatDate, todayISO } from '../lib/format'

const CATEGORIES = ['skincare', 'grooming', 'lifestyle', 'professional']

const TIME_GROUPS = [
  { key: 'morning', label: 'Morning', icon: 'sparkles' },
  { key: 'evening', label: 'Evening', icon: 'heart' },
  { key: 'weekly', label: 'Weekly', icon: 'calendar' },
  { key: 'anytime', label: 'Anytime', icon: 'check' },
]

function weekdayNarrow(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })
}

function isoDaysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10)
}

export default function Tracker() {
  const [summary, setSummary] = useState(null)
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('skincare')
  const [timeOfDay, setTimeOfDay] = useState('morning')
  const [adding, setAdding] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  async function load() {
    const [summaryData, habitData, logData] = await Promise.all([
      trackerApi.summary(),
      trackerApi.habits(true),
      trackerApi.logs(isoDaysAgo(6), todayISO()),
    ])
    setSummary(summaryData)
    setHabits(habitData)
    setLogs(logData)
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    load()
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const activeHabits = habits.filter((habit) => habit.active)
  const visibleHabits = showInactive ? habits : activeHabits

  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const iso = isoDaysAgo(6 - index)
      const dayLogs = logs.filter((log) => log.log_date === iso && log.completed)
      return {
        iso,
        count: dayLogs.length,
        ratio: activeHabits.length ? dayLogs.length / activeHabits.length : 0,
      }
    })
    return days
  }, [logs, activeHabits.length])

  const grouped = useMemo(() => {
    const map = {}
    for (const item of summary?.habits || []) {
      const key = item.habit.time_of_day || 'anytime'
      map[key] = map[key] || []
      map[key].push(item)
    }
    return TIME_GROUPS.map((group) => ({ ...group, items: map[group.key] || [] })).filter(
      (group) => group.items.length,
    )
  }, [summary])

  async function toggleHabit(habit) {
    if (!summary) return
    const item = summary.habits.find((h) => h.habit.id === habit.id)
    setBusy(habit.id)
    try {
      await trackerApi.upsertLog(habit.id, summary.today, !item?.completed)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function addHabit(event) {
    event.preventDefault()
    if (!title.trim()) return
    setAdding(true)
    setError('')
    try {
      await trackerApi.createHabit(title.trim(), category, timeOfDay)
      setTitle('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function removeHabit(habit) {
    if (!window.confirm(`Delete "${habit.title}"? Its history will be removed too.`)) return
    setBusy(habit.id)
    try {
      await trackerApi.removeHabit(habit.id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function toggleActive(habit) {
    setBusy(habit.id)
    try {
      await trackerApi.updateHabit(habit.id, { active: !habit.active })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-brand-600">
        <Spinner className="h-7 w-7" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Daily tracker"
        subtitle="A gentle routine, one day at a time. Tick habits off as you go."
      />

      <Alert>{error}</Alert>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="section-title">Today</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {summary?.completed_count || 0}
            <span className="text-base font-semibold text-slate-400">/{summary?.total_count || 0}</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${Math.round((summary?.completion_rate || 0) * 100)}%` }}
            />
          </div>
        </div>
        <div className="card p-5">
          <p className="section-title">Streak</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{summary?.streak || 0} days</p>
          <p className="mt-1 text-xs text-slate-500">Complete every active habit to extend it.</p>
        </div>
        <div className="card p-5">
          <p className="section-title">This week</p>
          <div className="mt-3 flex items-end gap-1.5">
            {week.map((day) => (
              <div key={day.iso} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-16 w-full items-end overflow-hidden rounded-md bg-slate-100">
                  <div
                    className="w-full rounded-md bg-brand-500"
                    style={{ height: `${Math.max(day.ratio * 100, day.count ? 12 : 0)}%` }}
                    title={`${day.count} completed`}
                  />
                </div>
                <span className="text-[10px] text-slate-400">{weekdayNarrow(day.iso)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Today's checklist</h2>
            <Badge tone="slate">{formatDate(summary?.today || todayISO())}</Badge>
          </div>

          {!activeHabits.length ? (
            <EmptyState
              icon="calendar"
              title="No active habits"
              description="Add a habit on the right, or save an analysis to auto-create a routine."
            />
          ) : (
            <div className="space-y-5">
              {grouped.map((group) => {
                const done = group.items.filter((item) => item.completed).length
                return (
                  <div key={group.key}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <Icon name={group.icon} className="h-3.5 w-3.5" />
                      </span>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {group.label}
                      </p>
                      <Badge tone="slate">
                        {done}/{group.items.length}
                      </Badge>
                    </div>
                    <ul className="space-y-2">
                      {group.items.map((item) => (
                        <li key={item.habit.id}>
                          <button
                            onClick={() => toggleHabit(item.habit)}
                            disabled={busy === item.habit.id}
                            title={item.habit.reason || undefined}
                            className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-left transition hover:bg-slate-100 disabled:opacity-60"
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                                item.completed ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-300'
                              }`}
                            >
                              {item.completed && <Icon name="check" className="h-4 w-4" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block truncate text-sm font-medium ${
                                  item.completed ? 'text-slate-400 line-through' : 'text-slate-800'
                                }`}
                              >
                                {item.habit.title}
                              </span>
                              <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                                <span className="capitalize">{item.habit.category}</span>
                                {item.habit.reason && (
                                  <span className="truncate">· {item.habit.reason}</span>
                                )}
                              </span>
                            </span>
                            {busy === item.habit.id && <Spinner className="h-4 w-4 text-slate-400" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-5 lg:col-span-2">
          <div className="card p-5">
            <h2 className="font-semibold text-slate-900">Add a habit</h2>
            <form onSubmit={addHabit} className="mt-3 space-y-3">
              <input
                className="input"
                placeholder="e.g. Moisturize after washing"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={255}
              />
              <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
                {CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
              <select className="input" value={timeOfDay} onChange={(event) => setTimeOfDay(event.target.value)}>
                {TIME_GROUPS.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary w-full" disabled={adding || !title.trim()}>
                {adding ? <Spinner /> : <Icon name="plus" className="h-4 w-4" />} Add habit
              </button>
            </form>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Manage habits</h2>
              <button
                className="text-xs font-semibold text-brand-600"
                onClick={() => setShowInactive((value) => !value)}
              >
                {showInactive ? 'Hide inactive' : 'Show inactive'}
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {visibleHabits.map((habit) => (
                <li
                  key={habit.id}
                  className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${habit.active ? 'text-slate-800' : 'text-slate-400'}`}>
                      {habit.title}
                    </p>
                    <p className="text-xs capitalize text-slate-400">
                      {habit.category} · {habit.time_of_day || 'anytime'} ·{' '}
                      {habit.source === 'ai' ? 'from analysis' : 'custom'}
                      {!habit.active && ' · inactive'}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleActive(habit)}
                    disabled={busy === habit.id}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                    title={habit.active ? 'Pause habit' : 'Resume habit'}
                  >
                    <Icon name={habit.active ? 'clock' : 'check'} className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => removeHabit(habit)}
                    disabled={busy === habit.id}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"
                    title="Delete habit"
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {!visibleHabits.length && (
                <li className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                  Nothing here yet.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
