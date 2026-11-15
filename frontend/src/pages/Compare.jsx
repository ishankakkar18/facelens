import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icons'
import { Alert, Badge, EmptyState, PageHeader, Spinner } from '../components/UI'
import { analysisApi, imageUrl, insightsApi } from '../lib/api'
import { formatDateTime } from '../lib/format'

function DiffGroup({ title, tone, items }) {
  if (!items?.length) return null
  const tones = {
    green: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800',
    rose: 'bg-rose-50 text-rose-800',
    slate: 'bg-slate-100 text-slate-700',
  }
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className={`rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Compare() {
  const [params] = useSearchParams()
  const [analyses, setAnalyses] = useState([])
  const [previous, setPrevious] = useState(params.get('previous') || '')
  const [current, setCurrent] = useState(params.get('current') || '')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    analysisApi
      .list(100, 0)
      .then((result) => {
        if (!active) return
        setAnalyses(result.items)
        if (!params.get('previous') && !params.get('current') && result.items.length >= 2) {
          setCurrent(String(result.items[0].id))
          setPrevious(String(result.items[1].id))
        }
      })
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [params])

  useEffect(() => {
    if (!previous || !current || previous === current) {
      setData(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    insightsApi
      .changes(previous, current)
      .then((result) => active && setData(result))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [previous, current])

  if (analyses.length < 2 && !loading) {
    return (
      <div>
        <PageHeader title="Compare" subtitle="See what changed between two analyses." />
        <EmptyState
          icon="chart"
          title="Not enough analyses"
          description="Save at least two analyses to compare them and see what changed."
          action={
            <Link to="/analyze" className="btn-primary">
              Analyze a selfie
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Compare" subtitle="See what changed between two check-ins." />

      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <label className="label">Earlier analysis</label>
          <select className="input" value={previous} onChange={(event) => setPrevious(event.target.value)}>
            <option value="">Select…</option>
            {analyses.map((item) => (
              <option key={item.id} value={item.id}>
                {formatDateTime(item.created_at)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Later analysis</label>
          <select className="input" value={current} onChange={(event) => setCurrent(event.target.value)}>
            <option value="">Select…</option>
            {analyses.map((item) => (
              <option key={item.id} value={item.id}>
                {formatDateTime(item.created_at)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Alert>{error}</Alert>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-brand-600">
          <Spinner className="h-7 w-7" />
        </div>
      ) : data ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Earlier', item: data.previous, tone: 'slate' },
              { label: 'Later', item: data.current, tone: 'brand' },
            ].map(({ label, item, tone }) => (
              <div key={label} className="card overflow-hidden">
                {item.image_url ? (
                  <img src={imageUrl(item.image_url)} alt={label} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center bg-slate-100 text-slate-400">
                    <Icon name="user" className="h-12 w-12" />
                  </div>
                )}
                <div className="p-4">
                  <Badge tone={tone}>{label}</Badge>
                  <p className="mt-2 text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-700">{item.result?.overall_description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Field-by-field changes</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <DiffGroup title="Improved" tone="green" items={[...data.diff.strengths_added, ...data.diff.concerns_removed]} />
              <DiffGroup title="New focus" tone="amber" items={[...data.diff.concerns_added, ...data.diff.focus_added]} />
              <DiffGroup title="Resolved focus" tone="green" items={data.diff.focus_removed} />
              <DiffGroup title="No longer mentioned" tone="slate" items={data.diff.strengths_removed} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tone</p>
                <p className="mt-1 text-sm text-slate-700">
                  {data.diff.skin_tone.previous || '—'} → <strong>{data.diff.skin_tone.current || '—'}</strong>
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Texture</p>
                <p className="mt-1 text-sm text-slate-700">
                  {data.diff.skin_texture.previous || '—'} → <strong>{data.diff.skin_texture.current || '—'}</strong>
                </p>
              </div>
            </div>
            {(data.diff.acne || data.diff.acne_marks || data.diff.hydration) && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {data.diff.acne && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Acne severity
                    </p>
                    <p className="mt-1 text-sm capitalize text-slate-700">
                      {data.diff.acne.previous_severity || '—'} →{' '}
                      <strong>{data.diff.acne.current_severity || '—'}</strong>
                    </p>
                  </div>
                )}
                {data.diff.acne_marks && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Acne marks
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {data.diff.acne_marks.previous_type || '—'} →{' '}
                      <strong>{data.diff.acne_marks.current_type || '—'}</strong>
                    </p>
                  </div>
                )}
                {data.diff.hydration && (
                  <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Hydration
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {data.diff.hydration.previous || '—'} →{' '}
                      <strong>{data.diff.hydration.current || '—'}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <Icon name="sparkles" className="h-5 w-5 text-brand-600" /> What changed, in plain language
            </h2>
            {data.ai ? (
              <div className="mt-3 space-y-4">
                <p className="text-sm leading-6 text-slate-700">{data.ai.summary}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DiffGroup title="Improving" tone="green" items={data.ai.improved} />
                  <DiffGroup title="Needs attention" tone="amber" items={data.ai.worsened} />
                  <DiffGroup title="Staying steady" tone="slate" items={data.ai.unchanged} />
                  <DiffGroup title="Next focus" tone="brand" items={data.ai.next_focus} />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                {data.ai_error || 'The AI summary is unavailable right now, but the field changes above still apply.'}
              </p>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          icon="chart"
          title="Pick two analyses"
          description="Choose an earlier and a later analysis above to see what changed."
        />
      )}
    </div>
  )
}
