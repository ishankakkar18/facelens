import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/Icons'
import { Alert, Badge, EmptyState, PageHeader, Spinner } from '../components/UI'
import { analysisApi, imageUrl } from '../lib/api'
import { formatDateTime } from '../lib/format'

export default function History() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const data = await analysisApi.list(100, 0)
      setItems(data.items)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function toggleSelect(id) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      if (current.length >= 2) return [current[1], id]
      return [...current, id]
    })
  }

  async function remove(id) {
    if (!window.confirm('Delete this analysis? The photo will be removed too.')) return
    setBusyId(id)
    try {
      await analysisApi.remove(id)
      setItems((current) => current.filter((item) => item.id !== id))
      setSelected((current) => current.filter((item) => item !== id))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  function compare() {
    if (selected.length !== 2) return
    const [a, b] = selected
    const older = items.find((item) => item.id === a)
    const newer = items.find((item) => item.id === b)
    const previous = new Date(older.created_at) <= new Date(newer.created_at) ? a : b
    const current = previous === a ? b : a
    navigate(`/compare?previous=${previous}&current=${current}`)
  }

  return (
    <div>
      <PageHeader
        title="History"
        subtitle="Every saved analysis, so you can look back and compare."
        action={
          <Link to="/analyze" className="btn-primary">
            <Icon name="camera" className="h-4 w-4" /> New analysis
          </Link>
        }
      />

      <Alert>{error}</Alert>

      {selected.length === 2 && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-slate-600">Two analyses selected for comparison.</p>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setSelected([])}>
              Clear
            </button>
            <button className="btn-primary" onClick={compare}>
              Compare <Icon name="arrowRight" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-brand-600">
          <Spinner className="h-7 w-7" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="image"
          title="No analyses yet"
          description="Run your first analysis to start building a history and a daily routine."
          action={
            <Link to="/analyze" className="btn-primary">
              Analyze a selfie
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const result = item.result_json || {}
            const isSelected = selected.includes(item.id)
            return (
              <div
                key={item.id}
                className={`card flex flex-col gap-4 p-4 transition sm:flex-row sm:items-center ${
                  isSelected ? 'ring-2 ring-brand-300' : ''
                }`}
              >
                <button
                  onClick={() => toggleSelect(item.id)}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                    isSelected ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-300'
                  }`}
                  aria-label={isSelected ? 'Unselect analysis' : 'Select analysis for comparison'}
                >
                  {isSelected && <Icon name="check" className="h-4 w-4" />}
                </button>

                {item.image_url ? (
                  <img
                    src={imageUrl(item.image_url)}
                    alt="Analysis"
                    className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-slate-100"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    <Icon name="user" className="h-7 w-7" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{formatDateTime(item.created_at)}</p>
                    {result.facial_shape && <Badge tone="slate">{result.facial_shape}</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                    {result.overall_description || 'No summary available.'}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link to={`/result/${item.id}`} className="btn-ghost">
                    View
                  </Link>
                  <button
                    className="btn-ghost"
                    onClick={() => analysisApi.pdf(item.id)}
                    title="Download PDF"
                  >
                    <Icon name="download" className="h-4 w-4" />
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => remove(item.id)}
                    disabled={busyId === item.id}
                    title="Delete analysis"
                  >
                    {busyId === item.id ? <Spinner className="h-4 w-4" /> : <Icon name="trash" className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {items.length >= 2 && (
        <p className="mt-4 text-center text-xs text-slate-500">
          Select any two analyses to compare them side by side.
        </p>
      )}
    </div>
  )
}
