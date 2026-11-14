import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icons'
import { Alert, Badge, EmptyState, PageHeader, Spinner } from '../components/UI'
import { analysisApi, imageUrl } from '../lib/api'
import { formatDateTime } from '../lib/format'

const SUGGESTION_GROUPS = [
  { key: 'skincare', label: 'Skincare', icon: 'sparkles' },
  { key: 'grooming', label: 'Grooming', icon: 'user' },
  { key: 'lifestyle', label: 'Lifestyle', icon: 'heart' },
  { key: 'professional', label: 'When to see a professional', icon: 'stethoscope' },
]

function Section({ title, icon, children }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default function Result() {
  const { id } = useParams()
  const [data, setData] = useState(() => {
    if (id) return null
    try {
      const raw = sessionStorage.getItem('facelens_last_result')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    analysisApi
      .get(id)
      .then((analysis) => {
        if (!active) return
        setData({
          id: analysis.id,
          result: analysis.result_json,
          image_url: analysis.image_url,
          saved: true,
          created_at: analysis.created_at,
        })
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id])

  const storageKey = `facelens_routine_${data?.id || 'last'}`
  const [checked, setChecked] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try {
      setChecked(JSON.parse(localStorage.getItem(storageKey)) || {})
    } catch {
      setChecked({})
    }
  }, [storageKey])

  function toggleCheck(key) {
    const next = { ...checked, [key]: !checked[key] }
    setChecked(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  const result = data?.result
  const groups = useMemo(() => {
    if (!result?.suggestions) return []
    return SUGGESTION_GROUPS.map((group) => ({
      ...group,
      items: result.suggestions[group.key] || [],
    })).filter((group) => group.items.length)
  }, [result])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-brand-600">
        <Spinner className="h-7 w-7" />
      </div>
    )
  }

  if (!result) {
    return (
      <div>
        <Alert>{error}</Alert>
        <EmptyState
          icon="camera"
          title="No analysis to show"
          description="Run a new analysis to see your face profile and recommendations."
          action={
            <Link to="/analyze" className="btn-primary">
              Analyze a selfie
            </Link>
          }
        />
      </div>
    )
  }

  const skin = result.skin || {}
  const features = result.features || {}
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0)
  const doneItems = groups.reduce(
    (sum, group) => sum + group.items.filter((_, index) => checked[`${group.key}-${index}`]).length,
    0,
  )

  return (
    <div>
      <PageHeader
        title="Your face profile"
        subtitle={data.created_at ? `Analyzed ${formatDateTime(data.created_at)}` : 'Fresh analysis'}
        action={
          <div className="flex flex-wrap gap-2">
            {data.id && (
              <button className="btn-ghost" onClick={() => analysisApi.pdf(data.id)}>
                <Icon name="download" className="h-4 w-4" /> PDF
              </button>
            )}
            <Link to="/analyze" className="btn-primary">
              <Icon name="camera" className="h-4 w-4" /> New analysis
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <section className="card overflow-hidden">
            <div className="flex flex-col gap-4 p-5 sm:flex-row">
              {data.image_url ? (
                <img
                  src={imageUrl(data.image_url)}
                  alt="Analyzed selfie"
                  className="h-40 w-40 shrink-0 rounded-2xl object-cover ring-1 ring-slate-100"
                />
              ) : (
                <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Icon name="user" className="h-12 w-12" />
                </div>
              )}
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap gap-2">
                  {result.facial_shape && <Badge>{result.facial_shape}</Badge>}
                  {result.estimated_age_range && <Badge tone="slate">{result.estimated_age_range}</Badge>}
                  {data.saved ? <Badge tone="green">Saved</Badge> : <Badge tone="amber">Ephemeral</Badge>}
                </div>
                <p className="text-sm leading-6 text-slate-700">{result.overall_description}</p>
                {result.symmetry_notes && (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    <strong className="text-slate-600">Symmetry:</strong> {result.symmetry_notes}
                  </p>
                )}
              </div>
            </div>
          </section>

          <Section title="Skin" icon="sparkles">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tone</p>
                <p className="mt-1 text-sm text-slate-700">{skin.tone || '—'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Texture</p>
                <p className="mt-1 text-sm text-slate-700">{skin.texture || '—'}</p>
              </div>
            </div>
            {skin.concerns?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {skin.concerns.map((concern) => (
                  <span key={concern} className="chip">
                    {concern}
                  </span>
                ))}
              </div>
            )}
          </Section>

          <Section title="Features" icon="user">
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(features).map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-sm text-slate-700">{value}</p>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid gap-5 sm:grid-cols-2">
            <Section title="Strengths" icon="heart">
              <ul className="space-y-2 text-sm text-slate-700">
                {(result.strengths || []).map((item) => (
                  <li key={item} className="flex gap-2">
                    <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Gentle focus areas" icon="spark">
              <ul className="space-y-2 text-sm text-slate-700">
                {(result.areas_to_improve || []).map((item) => (
                  <li key={item} className="flex gap-2">
                    <Icon name="arrowRight" className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Your routine</h2>
              {totalItems > 0 && (
                <Badge tone="green">
                  {doneItems}/{totalItems} done
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Tick these off today. Saved analyses add the same steps to your daily tracker.
            </p>

            <div className="mt-4 space-y-4">
              {groups.map((group) => (
                <div key={group.key}>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <Icon name={group.icon} className="h-3.5 w-3.5" /> {group.label}
                  </p>
                  <ul className="space-y-1.5">
                    {group.items.map((item, index) => {
                      const key = `${group.key}-${index}`
                      const isDone = Boolean(checked[key])
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => toggleCheck(key)}
                            className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                          >
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                                isDone ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-300'
                              }`}
                            >
                              {isDone && <Icon name="check" className="h-3.5 w-3.5" />}
                            </span>
                            <span
                              className={`text-sm leading-5 ${
                                isDone ? 'text-slate-400 line-through' : 'text-slate-700'
                              }`}
                            >
                              {item}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Icon name="info" className="h-4 w-4" /> Disclaimer
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {result.disclaimer || 'This is a general wellness analysis, not medical advice.'}
            </p>
          </div>

          <Link to="/tracker" className="btn-ghost w-full">
            Open daily tracker <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
