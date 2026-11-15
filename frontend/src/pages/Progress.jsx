import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ActivityHeatmap from '../components/ActivityHeatmap'
import Icon from '../components/Icons'
import { Alert, Badge, EmptyState, PageHeader, Spinner } from '../components/UI'
import { imageUrl, progressApi, trackerApi } from '../lib/api'
import { compressImage } from '../lib/image'
import { formatDate, isoDaysAgo, todayISO } from '../lib/format'

function HeatmapSkeleton() {
  return (
    <div className="flex gap-[3px] overflow-hidden">
      {Array.from({ length: 30 }).map((_, index) => (
        <div key={index} className="flex shrink-0 flex-col gap-[3px]">
          {Array.from({ length: 7 }).map((__, day) => (
            <div key={day} className="h-3 w-3 animate-pulse rounded-[3px] bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function Progress() {
  const inputRef = useRef(null)
  const [photos, setPhotos] = useState([])
  const [heatmapDays, setHeatmapDays] = useState([])
  const [habits, setHabits] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [dayLogs, setDayLogs] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [file, setFile] = useState(null)
  const [photoDate, setPhotoDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [runAnalysis, setRunAnalysis] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function load() {
    const [photoData, heatmap, habitData] = await Promise.all([
      progressApi.list(),
      trackerApi.heatmap(isoDaysAgo(364), todayISO()),
      trackerApi.habits(true),
    ])
    setPhotos(photoData)
    setHeatmapDays(heatmap)
    setHabits(habitData)
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

  async function selectDay(day) {
    setSelectedDay(day)
    setDayLogs([])
    setDetailLoading(true)
    try {
      const logs = await trackerApi.logs(day.date, day.date)
      setDayLogs(logs)
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const dayHabits = useMemo(() => {
    if (!selectedDay) return []
    return habits.filter((habit) => habit.created_at.slice(0, 10) <= selectedDay.date)
  }, [habits, selectedDay])

  const completedIds = new Set(dayLogs.filter((log) => log.completed).map((log) => log.habit_id))
  const completedTasks = dayHabits.filter((habit) => completedIds.has(habit.id))
  const pendingTasks = dayHabits.filter((habit) => !completedIds.has(habit.id))
  const totalCompleted = heatmapDays.reduce((sum, day) => sum + day.completed, 0)
  const todayDay = heatmapDays.find((day) => day.date === todayISO())

  async function handleUpload(event) {
    event.preventDefault()
    if (!file) {
      setError('Choose a photo first.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const compressed = await compressImage(file)
      await progressApi.upload(compressed, { photoDate, notes, runAnalysis })
      setFile(null)
      setNotes('')
      setPhotoDate(todayISO())
      if (inputRef.current) inputRef.current.value = ''
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this progress photo?')) return
    setBusyId(id)
    try {
      await progressApi.remove(id)
      setPhotos((current) => current.filter((photo) => photo.id !== id))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Progress"
        subtitle="Your task calendar and skin photo timeline — all in one place."
        action={
          <Link to="/tracker" className="btn-ghost">
            <Icon name="calendar" className="h-4 w-4" /> Open tracker
          </Link>
        }
      />

      <Alert>{error}</Alert>

      <div className="card mb-5 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <Icon name="calendar" className="h-5 w-5 text-brand-600" /> Activity map
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Last 12 months of completed tasks. Click any day to see its checklist.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="green">{totalCompleted} tasks completed</Badge>
            {todayDay && (
              <button
                type="button"
                className="btn-ghost px-3 py-2 text-xs"
                onClick={() => selectDay(todayDay)}
              >
                Today
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <HeatmapSkeleton />
        ) : (
          <ActivityHeatmap
            days={heatmapDays}
            selectedDate={selectedDay?.date}
            onSelect={selectDay}
          />
        )}

        {selectedDay && (
          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">{formatDate(selectedDay.date)}</p>
              <Badge tone={selectedDay.total > 0 && selectedDay.ratio === 1 ? 'green' : 'slate'}>
                {selectedDay.total > 0
                  ? `${selectedDay.completed}/${selectedDay.total} completed`
                  : `${selectedDay.completed} completed`}
              </Badge>
            </div>

            {detailLoading ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <Spinner className="h-4 w-4" /> Loading that day…
              </div>
            ) : dayHabits.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No habits were active on this day.
              </p>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Completed
                  </p>
                  {completedTasks.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {completedTasks.map((habit) => (
                        <li key={habit.id} className="flex items-center gap-2 text-sm text-slate-700">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500 text-white">
                            <Icon name="check" className="h-3.5 w-3.5" />
                          </span>
                          {habit.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Nothing completed.</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Not completed
                  </p>
                  {pendingTasks.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {pendingTasks.map((habit) => (
                        <li key={habit.id} className="flex items-center gap-2 text-sm text-slate-500">
                          <span className="h-5 w-5 rounded-md bg-white ring-1 ring-slate-300" />
                          {habit.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-emerald-700">All done — nice work!</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card h-fit p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Icon name="image" className="h-5 w-5 text-brand-600" /> Add a progress photo
          </h2>
          <form onSubmit={handleUpload} className="mt-3 space-y-3">
            <div>
              <label className="label" htmlFor="photo">
                Photo
              </label>
              <input
                id="photo"
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </div>
            <div>
              <label className="label" htmlFor="photo-date">
                Date
              </label>
              <input
                id="photo-date"
                type="date"
                className="input"
                value={photoDate}
                max={todayISO()}
                onChange={(event) => setPhotoDate(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="notes">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                className="input min-h-[80px]"
                placeholder="How does your skin feel today?"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={runAnalysis}
                onChange={(event) => setRunAnalysis(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs leading-5 text-slate-600">
                <strong className="block text-sm text-slate-800">Analyze this photo too</strong>
                Adds an AI check-in to your history and feeds "what changed".
              </span>
            </label>
            <button type="submit" className="btn-primary w-full" disabled={uploading || !file}>
              {uploading ? <Spinner /> : <Icon name="plus" className="h-4 w-4" />} Add photo
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Photo timeline</h2>
            <span className="text-xs text-slate-500">{photos.length} photos</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="card h-48 animate-pulse bg-slate-100" />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <EmptyState
              icon="image"
              title="Your timeline is empty"
              description="Add your first progress photo to start seeing change over time."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) => (
                <div key={photo.id} className="card group overflow-hidden">
                  <div className="relative">
                    <img
                      src={imageUrl(photo.image_url)}
                      alt={`Progress on ${photo.photo_date}`}
                      loading="lazy"
                      decoding="async"
                      className="h-40 w-full object-cover"
                    />
                    <button
                      onClick={() => remove(photo.id)}
                      disabled={busyId === photo.id}
                      className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-slate-500 opacity-0 shadow transition hover:text-rose-600 group-hover:opacity-100"
                      title="Delete photo"
                    >
                      {busyId === photo.id ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <Icon name="trash" className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-slate-900">{formatDate(photo.photo_date)}</p>
                    {photo.notes && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{photo.notes}</p>
                    )}
                    {photo.analysis_id && (
                      <Link
                        to={`/result/${photo.analysis_id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600"
                      >
                        View analysis <Icon name="arrowRight" className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
