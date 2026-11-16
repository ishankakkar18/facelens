import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ActivityHeatmap from '../components/ActivityHeatmap'
import Icon from '../components/Icons'
import { Alert, Badge, EmptyState, PageHeader, Spinner } from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { analysisApi, insightsApi, trackerApi } from '../lib/api'
import { formatDate, greeting, isoDaysAgo, todayISO } from '../lib/format'

const TIME_GROUPS = [
  { key: 'morning', label: 'Morning', icon: 'sparkles' },
  { key: 'evening', label: 'Evening', icon: 'heart' },
  { key: 'weekly', label: 'Weekly', icon: 'calendar' },
  { key: 'anytime', label: 'Anytime', icon: 'check' },
]

function ProgressRing({ value }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 1))
  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#4f46e5"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-slate-900">
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [changes, setChanges] = useState(null)
  const [heatmap, setHeatmap] = useState([])
  const [latestAnalysis, setLatestAnalysis] = useState(null)
  const [changesNote, setChangesNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyHabit, setBusyHabit] = useState(null)

  const groupedHabits = useMemo(() => {
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

  async function loadSummary() {
    const data = await trackerApi.summary()
    setSummary(data)
  }

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [data, analysisPage, heatmapDays] = await Promise.all([
          trackerApi.summary(),
          analysisApi.list(2, 0).catch(() => ({ items: [], total: 0 })),
          trackerApi.heatmap(isoDaysAgo(83), todayISO()).catch(() => []),
        ])
        if (!active) return
        setSummary(data)
        setHeatmap(heatmapDays)
        setLatestAnalysis(analysisPage.items?.[0] || null)
        if (analysisPage.total >= 2) {
          try {
            const insight = await insightsApi.changes()
            if (active) setChanges(insight)
          } catch (err) {
            if (active) setChangesNote(err.message)
          }
        } else if (active) {
          setChangesNote('')
        }
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  async function toggleHabit(item) {
    if (!summary) return
    setBusyHabit(item.habit.id)
    try {
      await trackerApi.upsertLog(item.habit.id, summary.today, !item.completed)
      await loadSummary()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyHabit(null)
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
        title={`${greeting()}, ${user?.email?.split('@')[0] || 'there'}`}
        subtitle={formatDate(new Date(), { weekday: 'long' })}
        action={
          <Link to="/analyze" className="btn-primary">
            <Icon name="camera" className="h-4 w-4" /> New analysis
          </Link>
        }
      />

      <Alert>{error}</Alert>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-4 p-5">
          <ProgressRing value={summary?.completion_rate || 0} />
          <div>
            <p className="section-title">Today</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {summary?.completed_count || 0}/{summary?.total_count || 0}
            </p>
            <p className="text-xs text-slate-500">habits complete</p>
          </div>
        </div>

        <div className="card p-5">
          <p className="section-title">Streak</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{summary?.streak || 0}</p>
          <p className="text-xs text-slate-500">consecutive complete days</p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-brand-700">
            <Icon name="heart" className="h-4 w-4" />
            Keep the routine gentle and consistent.
          </div>
        </div>

        <div className="card p-5">
          <p className="section-title">Quick links</p>
          <div className="mt-3 space-y-2">
            <Link to="/progress" className="flex items-center justify-between text-sm font-medium text-slate-700 hover:text-brand-700">
              Log a progress photo <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
            <Link to="/doctor" className="flex items-center justify-between text-sm font-medium text-slate-700 hover:text-brand-700">
              Doctor hub <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
            <Link to="/history" className="flex items-center justify-between text-sm font-medium text-slate-700 hover:text-brand-700">
              Past analyses <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {latestAnalysis?.result_json?.biggest_issue && (
        <div className="card mt-6 border-l-4 border-rose-400 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">
                Focus now
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {latestAnalysis.result_json.biggest_issue}
              </p>
              {latestAnalysis.result_json.biggest_win && (
                <p className="mt-1 text-sm text-slate-500">
                  <strong className="text-slate-700">Quickest win:</strong>{' '}
                  {latestAnalysis.result_json.biggest_win}
                </p>
              )}
            </div>
            <Link to={`/result/${latestAnalysis.id}`} className="btn-ghost shrink-0">
              Open report <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Today's checklist</h2>
            <Link to="/tracker" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Manage habits
            </Link>
          </div>

          {!summary?.habits?.length ? (
            <EmptyState
              icon="calendar"
              title="No habits yet"
              description="Run an analysis and we'll turn its suggestions into a daily checklist automatically."
              action={
                <Link to="/analyze" className="btn-primary">
                  Analyze a selfie
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {groupedHabits.map((group) => (
                <div key={group.key}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <Icon name={group.icon} className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {group.label}
                    </p>
                    <Badge tone="slate">
                      {group.items.filter((item) => item.completed).length}/{group.items.length}
                    </Badge>
                  </div>
                  <ul className="space-y-2">
                    {group.items.map((item) => (
                      <li key={item.habit.id}>
                        <button
                          onClick={() => toggleHabit(item)}
                          disabled={busyHabit === item.habit.id}
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
                            <span className="text-xs capitalize text-slate-400">
                              {item.habit.category}
                            </span>
                          </span>
                          {busyHabit === item.habit.id && <Spinner className="h-4 w-4 text-slate-400" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">What changed</h2>
          {changes ? (
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <div className="flex flex-wrap gap-2">
                <Badge tone="green">{changes.diff.improved?.length || changes.diff.concerns_removed?.length || 0} improvements</Badge>
                <Badge tone="amber">{changes.diff.focus_added?.length || 0} new focus</Badge>
              </div>
              <p className="leading-6">
                {changes.ai?.summary ||
                  'Two check-ins are available. Open the comparison to see the details.'}
              </p>
              {changes.ai?.next_focus?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Next focus
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                    {changes.ai.next_focus.slice(0, 3).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Link to="/compare" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                View full comparison <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm leading-6 text-slate-500">
                {changesNote ||
                  'Save two analyses and FaceLens will show a plain-language summary of what changed between them.'}
              </p>
              <Link to="/analyze" className="btn-ghost mt-4 w-full">
                Run another analysis
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Your activity</h2>
            <p className="text-xs text-slate-500">Last 12 weeks of completed tasks</p>
          </div>
          <Link to="/progress" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
            Open calendar
          </Link>
        </div>
        <ActivityHeatmap
          days={heatmap}
          limitWeeks={12}
          showMonths={false}
          showLegend={false}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link to="/tracker" className="card flex items-center gap-4 p-5 transition hover:ring-brand-200">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon name="calendar" className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-semibold text-slate-900">Build your streak</span>
            <span className="text-sm text-slate-500">Day-wise checklist and custom habits</span>
          </span>
        </Link>
        <Link to="/progress" className="card flex items-center gap-4 p-5 transition hover:ring-brand-200">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon name="chart" className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-semibold text-slate-900">Track visible progress</span>
            <span className="text-sm text-slate-500">Daily selfies and before/after timeline</span>
          </span>
        </Link>
      </div>
    </div>
  )
}
