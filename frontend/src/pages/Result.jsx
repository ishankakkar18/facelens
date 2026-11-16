import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import Icon from '../components/Icons'
import { Alert, Badge, EmptyState, PageHeader, Spinner } from '../components/UI'
import { analysisApi, imageUrl, trackerApi } from '../lib/api'
import { formatDateTime } from '../lib/format'

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'user' },
  { key: 'acne', label: 'Acne & marks', icon: 'stethoscope' },
  { key: 'routine', label: 'Routine', icon: 'calendar' },
  { key: 'products', label: 'What to use', icon: 'sparkles' },
]

function Section({ title, icon, children, action }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Icon name={icon} className="h-4 w-4" />
            </span>
          )}
          <h2 className="font-semibold text-slate-900">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Detail({ label, value }) {
  if (!value) return null
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value}</p>
    </div>
  )
}

function severityTone(value) {
  const v = String(value || '').toLowerCase()
  if (v === 'severe' || v === 'high') return 'rose'
  if (v === 'moderate' || v === 'medium') return 'amber'
  if (v === 'mild' || v === 'low') return 'green'
  return 'slate'
}

function PhotoStrip({ previews }) {
  const photos = [
    { label: 'Front', src: previews.front },
    { label: 'Right', src: previews.right },
    { label: 'Left', src: previews.left },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo) => (
        <div key={photo.label} className="overflow-hidden rounded-xl bg-slate-100">
          {photo.src ? (
            <img
              src={photo.src}
              alt={`${photo.label} view`}
              loading="lazy"
              decoding="async"
              className="h-32 w-full object-cover"
            />
          ) : (
            <div className="flex h-32 items-center justify-center text-slate-400">
              <Icon name="user" className="h-8 w-8" />
            </div>
          )}
          <p className="py-1.5 text-center text-[11px] font-medium text-slate-500">{photo.label}</p>
        </div>
      ))}
    </div>
  )
}

function RoutineCard({ title, icon, items, tone = 'brand' }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : []
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone === 'green' ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600'}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>
      {list.length ? (
        <ol className="space-y-2 text-sm text-slate-700">
          {list.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                {index + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate-500">No steps.</p>
      )}
    </div>
  )
}

export default function Result() {
  const { id } = useParams()
  const location = useLocation()
  const passed = location.state?.data
  const passedPreviews = location.state?.previews

  const [tab, setTab] = useState('overview')
  const [data, setData] = useState(() => {
    if (passed) return passed
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
  const [adding, setAdding] = useState(false)
  const [addMessage, setAddMessage] = useState('')
  const [addError, setAddError] = useState('')

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
          front_image_url: analysis.front_image_url,
          right_image_url: analysis.right_image_url,
          left_image_url: analysis.left_image_url,
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

  const previews = useMemo(
    () => ({
      front: data?.front_image_url || data?.image_url
        ? imageUrl(data.front_image_url || data.image_url)
        : passedPreviews?.front || null,
      right: data?.right_image_url
        ? imageUrl(data.right_image_url)
        : passedPreviews?.right || null,
      left: data?.left_image_url
        ? imageUrl(data.left_image_url)
        : passedPreviews?.left || null,
    }),
    [
      data?.front_image_url,
      data?.right_image_url,
      data?.left_image_url,
      data?.image_url,
      passedPreviews,
    ],
  )

  const result = data?.result
  const skin = result?.skin || {}
  const acne = skin.acne || {}
  const acneMarks = skin.acne_marks || {}
  const routine = result?.routine || null
  const ingredients = result?.suggestions?.ingredients || []
  const professional = result?.suggestions?.professional || []

  async function addRoutineToTracker() {
    if (!routine) return
    setAdding(true)
    setAddError('')
    setAddMessage('')
    try {
      const existing = await trackerApi.habits(true)
      const titles = new Set(existing.map((habit) => habit.title.trim().toLowerCase()))
      const steps = [...(routine.am || []), ...(routine.pm || []), ...(routine.weekly || [])]
      let addedCount = 0
      for (const step of steps) {
        const title = String(step || '').trim()
        if (!title || titles.has(title.toLowerCase())) continue
        await trackerApi.createHabit(title.slice(0, 255), 'skincare')
        titles.add(title.toLowerCase())
        addedCount += 1
      }
      setAddMessage(
        addedCount
          ? `Added ${addedCount} routine steps to your daily tracker.`
          : 'Those routine steps are already in your tracker.',
      )
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

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
          description="Run a new analysis with three photos to see your face profile and recommendations."
          action={
            <Link to="/analyze" className="btn-primary">
              Analyze 3 photos
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Your skin report"
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

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={tab === item.key ? 'btn-primary shrink-0' : 'btn-ghost shrink-0'}
          >
            <Icon name={item.icon} className="h-4 w-4" /> {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <section className="card p-5">
            <PhotoStrip previews={previews} />
            <div className="mt-4 flex flex-wrap gap-2">
              {result.facial_shape && <Badge>{result.facial_shape}</Badge>}
              {result.estimated_age_range && <Badge tone="slate">{result.estimated_age_range}</Badge>}
              {result.photo_quality && <Badge tone="slate">Photo: {result.photo_quality}</Badge>}
              {result.confidence && <Badge tone="slate">Confidence: {result.confidence}</Badge>}
              {data.saved ? <Badge tone="green">Saved</Badge> : <Badge tone="amber">Ephemeral</Badge>}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{result.overall_description}</p>
            {result.symmetry_notes && (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                <strong className="text-slate-600">Symmetry:</strong> {result.symmetry_notes}
              </p>
            )}
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card border-l-4 border-rose-400 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">
                Biggest issue
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {result.biggest_issue || 'No major issue detected — focus on maintenance.'}
              </p>
            </div>
            <div className="card border-l-4 border-emerald-400 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Biggest win
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {result.biggest_win || 'Stay consistent with cleansing, moisturizer, and SPF.'}
              </p>
            </div>
          </div>

          {result.reality_check && (
            <Section title="Reality check" icon="info">
              <p className="text-sm leading-6 text-slate-700">{result.reality_check}</p>
            </Section>
          )}

          {(result.clinical_impression || result.medical_notes) && (
            <Section title="Clinical impression" icon="stethoscope">
              <p className="text-sm leading-6 text-slate-700">
                {result.clinical_impression || result.medical_notes}
              </p>
            </Section>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Section title="Strengths" icon="heart">
              {result.strengths?.length ? (
                <ul className="space-y-2 text-sm text-slate-700">
                  {result.strengths.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No standout strengths yet — the routine is the priority.</p>
              )}
            </Section>
            <Section title="Focus areas" icon="spark">
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
      )}

      {tab === 'acne' && (
        <div className="space-y-5">
          <Section title="Acne assessment" icon="stethoscope">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Severity</p>
                <div className="mt-1">
                  <Badge tone={severityTone(acne.severity)}>{acne.severity || 'not assessed'}</Badge>
                </div>
              </div>
              <Detail label="Grade" value={acne.grade} />
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Scarring risk</p>
                <div className="mt-1">
                  <Badge tone={severityTone(acne.scarring_risk)}>
                    {acne.scarring_risk || 'unknown'}
                  </Badge>
                </div>
              </div>
              <Detail label="Inflammation" value={acne.inflammation} />
            </div>

            {acne.types?.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Types
                </p>
                <div className="flex flex-wrap gap-2">
                  {acne.types.map((type) => (
                    <span key={type} className="chip">{type}</span>
                  ))}
                </div>
              </div>
            )}
            {acne.locations?.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                <strong className="text-slate-600">Locations:</strong> {acne.locations.join(', ')}
              </p>
            )}
          </Section>

          <Section title="Acne marks" icon="spark">
            <div className="grid gap-3 sm:grid-cols-3">
              <Detail label="Type" value={acneMarks.type} />
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Severity</p>
                <div className="mt-1">
                  <Badge tone={severityTone(acneMarks.severity)}>
                    {acneMarks.severity || 'none'}
                  </Badge>
                </div>
              </div>
              <Detail label="Locations" value={acneMarks.locations?.join(', ')} />
            </div>
            {acneMarks.note && (
              <p className="mt-3 text-sm leading-6 text-slate-700">{acneMarks.note}</p>
            )}
          </Section>

          <Section title="Skin metrics" icon="chart">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Tone" value={skin.tone} />
              <Detail label="Texture" value={skin.texture} />
              <Detail label="Hydration" value={skin.hydration} />
              <Detail label="Pores" value={skin.pores} />
              <Detail label="Oiliness" value={skin.oiliness} />
              <Detail label="Erythema" value={skin.erythema} />
              <Detail label="Barrier" value={skin.barrier} />
            </div>
            {skin.concerns?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {skin.concerns.map((concern) => (
                  <span key={concern} className="chip">{concern}</span>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {tab === 'routine' && (
        <div className="space-y-5">
          {routine ? (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <RoutineCard title="Morning" icon="sparkles" items={routine.am} />
                <RoutineCard title="Evening" icon="heart" items={routine.pm} tone="green" />
                <RoutineCard title="Weekly" icon="calendar" items={routine.weekly} />
              </div>

              {routine.avoid?.length > 0 && (
                <Section title="Avoid" icon="info">
                  <ul className="space-y-2 text-sm text-slate-700">
                    {routine.avoid.map((item) => (
                      <li key={item} className="flex gap-2">
                        <Icon name="close" className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {routine.timeline && (
                <Section title="Expected timeline" icon="clock">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {Object.entries(routine.timeline).map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {key.replace('_', ' ')}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">{value}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <div className="card p-5">
                <Alert type="success">{addMessage}</Alert>
                <Alert>{addError}</Alert>
                <button
                  type="button"
                  className="btn-primary w-full"
                  onClick={addRoutineToTracker}
                  disabled={adding}
                >
                  {adding ? <Spinner /> : <Icon name="plus" className="h-4 w-4" />}
                  Add this routine to my tracker
                </button>
                <p className="mt-2 text-center text-xs text-slate-500">
                  Creates daily habits from the morning, evening, and weekly steps.
                </p>
              </div>
            </>
          ) : (
            <EmptyState
              icon="calendar"
              title="No personalized routine yet"
              description="Re-run the analysis to generate an AM/PM routine based on your skin."
              action={<Link to="/analyze" className="btn-primary">Analyze again</Link>}
            />
          )}
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-5">
          <Section title="What to use" icon="sparkles">
            {ingredients.length ? (
              <ul className="space-y-2 text-sm text-slate-700">
                {ingredients.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No specific ingredient suggestions for this analysis.</p>
            )}
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              Patch test new products, start slowly, and see a dermatologist if acne is painful,
              cystic, or leaving scars.
            </p>
          </Section>

          {result.suggestions?.skincare?.length > 0 && (
            <Section title="Skincare steps" icon="sparkles">
              <ul className="space-y-2 text-sm text-slate-700">
                {result.suggestions.skincare.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Icon name="arrowRight" className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {result.suggestions?.grooming?.length > 0 && (
            <Section title="Grooming" icon="user">
              <ul className="space-y-2 text-sm text-slate-700">
                {result.suggestions.grooming.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Icon name="arrowRight" className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {result.suggestions?.lifestyle?.length > 0 && (
            <Section title="Lifestyle" icon="heart">
              <ul className="space-y-2 text-sm text-slate-700">
                {result.suggestions.lifestyle.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {professional.length > 0 && (
            <Section title="When to see a professional" icon="stethoscope">
              <ul className="space-y-2 text-sm text-slate-700">
                {professional.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      <div className="card mt-5 p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Icon name="info" className="h-4 w-4" /> Disclaimer
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {result.disclaimer || 'This is a general wellness analysis, not medical advice.'}
        </p>
      </div>
    </div>
  )
}
