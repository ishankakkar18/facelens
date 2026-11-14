import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icons'
import { Alert, Badge, EmptyState, PageHeader, Spinner } from '../components/UI'
import { doctorApi } from '../lib/api'
import { formatDate, todayISO } from '../lib/format'

const TABS = [
  { key: 'directory', label: 'Find a dermatologist', icon: 'stethoscope' },
  { key: 'questions', label: 'Questions', icon: 'info' },
  { key: 'visits', label: 'Visits & prescriptions', icon: 'calendar' },
]

const RED_FLAGS = [
  'A mole or spot that is new, changing, or bleeding',
  'Painful, spreading, or sudden breakouts',
  'A rash with fever or swelling',
  'Skin symptoms that do not improve after a few weeks of gentle care',
]

function DirectoryTab() {
  const [doctors, setDoctors] = useState([])
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    doctorApi
      .list()
      .then((data) => active && setDoctors(data))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const cities = useMemo(() => [...new Set(doctors.map((doctor) => doctor.city))].sort(), [doctors])
  const filtered = city ? doctors.filter((doctor) => doctor.city === city) : doctors

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-brand-600">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Alert>{error}</Alert>

      <div className="card p-5">
        <p className="text-sm font-semibold text-slate-900">When to see a professional</p>
        <ul className="mt-2 space-y-1.5">
          {RED_FLAGS.map((flag) => (
            <li key={flag} className="flex gap-2 text-sm text-slate-600">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              {flag}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          FaceLens cannot diagnose. This directory is demo data — verify credentials and licensing before
          booking.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={city === '' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setCity('')}
        >
          All cities
        </button>
        {cities.map((option) => (
          <button
            key={option}
            className={city === option ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setCity(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((doctor) => (
          <div key={doctor.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{doctor.name}</p>
                <p className="text-sm text-slate-500">{doctor.specialty}</p>
              </div>
              <Badge tone="slate">{doctor.city}</Badge>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              {doctor.address && (
                <p className="flex items-center gap-2">
                  <Icon name="home" className="h-4 w-4 text-slate-400" /> {doctor.address}
                </p>
              )}
              {doctor.phone && (
                <p className="flex items-center gap-2">
                  <Icon name="user" className="h-4 w-4 text-slate-400" /> {doctor.phone}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      {!filtered.length && (
        <EmptyState icon="stethoscope" title="No doctors in this city" description="Try another city." />
      )}
    </div>
  )
}

function QuestionsTab() {
  const [questions, setQuestions] = useState([])
  const [question, setQuestion] = useState('')
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const data = await doctorApi.questions()
    setQuestions(data)
  }

  useEffect(() => {
    let active = true
    load()
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  async function ask(event) {
    event.preventDefault()
    if (question.trim().length < 5) {
      setError('Write a little more detail (at least 5 characters).')
      return
    }
    setBusy('new')
    setError('')
    try {
      await doctorApi.ask(question.trim())
      setQuestion('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function answer(item) {
    const text = (drafts[item.id] || '').trim()
    if (!text) return
    setBusy(item.id)
    try {
      await doctorApi.answer(item.id, text)
      setDrafts((current) => ({ ...current, [item.id]: '' }))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function remove(item) {
    if (!window.confirm('Delete this question?')) return
    setBusy(item.id)
    try {
      await doctorApi.removeQuestion(item.id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <Alert>{error}</Alert>

      <div className="card p-5">
        <h2 className="font-semibold text-slate-900">Ask a question</h2>
        <p className="mt-1 text-xs text-slate-500">
          Keep a log of what you want to ask a dermatologist. You can add the answer after your visit.
        </p>
        <form onSubmit={ask} className="mt-3 space-y-3">
          <textarea
            className="input min-h-[90px]"
            placeholder="e.g. Should I pause retinol before a waxing appointment?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={busy === 'new'}>
            {busy === 'new' ? <Spinner /> : <Icon name="plus" className="h-4 w-4" />} Save question
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-brand-600">
          <Spinner className="h-6 w-6" />
        </div>
      ) : !questions.length ? (
        <EmptyState icon="info" title="No questions yet" description="Save your first question above." />
      ) : (
        <div className="space-y-3">
          {questions.map((item) => (
            <div key={item.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.question}</p>
                  <p className="mt-1 text-xs text-slate-400">Asked {formatDate(item.created_at)}</p>
                </div>
                <Badge tone={item.status === 'answered' ? 'green' : 'amber'}>{item.status}</Badge>
              </div>

              {item.answer ? (
                <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Answer</p>
                  <p className="mt-1 leading-6">{item.answer}</p>
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    className="input"
                    placeholder="Add the answer you received…"
                    value={drafts[item.id] || ''}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [item.id]: event.target.value }))
                    }
                  />
                  <button
                    className="btn-primary shrink-0"
                    onClick={() => answer(item)}
                    disabled={busy === item.id}
                  >
                    {busy === item.id ? <Spinner /> : 'Save answer'}
                  </button>
                </div>
              )}

              <button
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-rose-600"
                onClick={() => remove(item)}
                disabled={busy === item.id}
              >
                <Icon name="trash" className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VisitsTab() {
  const [visits, setVisits] = useState([])
  const [form, setForm] = useState({
    visit_date: todayISO(),
    doctor_name: '',
    clinic: '',
    prescription: '',
    notes: '',
    next_followup: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const data = await doctorApi.visits()
    setVisits(data)
  }

  useEffect(() => {
    let active = true
    load()
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function add(event) {
    event.preventDefault()
    if (!form.doctor_name.trim()) {
      setError('Doctor name is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await doctorApi.addVisit({
        ...form,
        clinic: form.clinic || null,
        prescription: form.prescription || null,
        notes: form.notes || null,
        next_followup: form.next_followup || null,
      })
      setForm({
        visit_date: todayISO(),
        doctor_name: '',
        clinic: '',
        prescription: '',
        notes: '',
        next_followup: '',
      })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this visit record?')) return
    setBusy(id)
    try {
      await doctorApi.removeVisit(id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card h-fit p-5">
        <h2 className="font-semibold text-slate-900">Log a visit</h2>
        <form onSubmit={add} className="mt-3 space-y-3">
          <Alert>{error}</Alert>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Visit date</label>
              <input
                type="date"
                className="input"
                value={form.visit_date}
                onChange={(event) => update('visit_date', event.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Follow-up</label>
              <input
                type="date"
                className="input"
                value={form.next_followup}
                onChange={(event) => update('next_followup', event.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Doctor</label>
            <input
              className="input"
              placeholder="Dr. …"
              value={form.doctor_name}
              onChange={(event) => update('doctor_name', event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Clinic</label>
            <input
              className="input"
              placeholder="Clinic or hospital"
              value={form.clinic}
              onChange={(event) => update('clinic', event.target.value)}
            />
          </div>
          <div>
            <label className="label">Prescription</label>
            <textarea
              className="input min-h-[70px]"
              placeholder="Medicines, strengths, how to use"
              value={form.prescription}
              onChange={(event) => update('prescription', event.target.value)}
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[70px]"
              placeholder="What the doctor said, things to avoid"
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? <Spinner /> : <Icon name="plus" className="h-4 w-4" />} Save visit
          </button>
        </form>
      </div>

      <div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-brand-600">
            <Spinner className="h-6 w-6" />
          </div>
        ) : !visits.length ? (
          <EmptyState icon="calendar" title="No visits logged" description="Add a visit to keep prescriptions and follow-ups in one place." />
        ) : (
          <div className="space-y-3">
            {visits.map((visit) => (
              <div key={visit.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{visit.doctor_name}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(visit.visit_date)}
                      {visit.clinic ? ` · ${visit.clinic}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(visit.id)}
                    disabled={busy === visit.id}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    {busy === visit.id ? <Spinner className="h-4 w-4" /> : <Icon name="trash" className="h-4 w-4" />}
                  </button>
                </div>
                {visit.prescription && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prescription</p>
                    <p className="mt-1 whitespace-pre-line">{visit.prescription}</p>
                  </div>
                )}
                {visit.notes && <p className="mt-2 text-sm text-slate-600">{visit.notes}</p>}
                {visit.next_followup && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand-700">
                    <Icon name="calendar" className="h-3.5 w-3.5" /> Follow-up {formatDate(visit.next_followup)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Doctor() {
  const [tab, setTab] = useState('directory')

  return (
    <div>
      <PageHeader
        title="Doctor hub"
        subtitle="Find a dermatologist, prepare questions, and track visits and prescriptions."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={tab === item.key ? 'btn-primary' : 'btn-ghost'}
          >
            <Icon name={item.icon} className="h-4 w-4" /> {item.label}
          </button>
        ))}
      </div>

      {tab === 'directory' && <DirectoryTab />}
      {tab === 'questions' && <QuestionsTab />}
      {tab === 'visits' && <VisitsTab />}
    </div>
  )
}
