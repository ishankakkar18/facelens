import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icons'
import { Alert, EmptyState, PageHeader, Spinner } from '../components/UI'
import { imageUrl, progressApi } from '../lib/api'
import { formatDate, todayISO } from '../lib/format'

export default function Progress() {
  const inputRef = useRef(null)
  const [photos, setPhotos] = useState([])
  const [file, setFile] = useState(null)
  const [photoDate, setPhotoDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [runAnalysis, setRunAnalysis] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function load() {
    const data = await progressApi.list()
    setPhotos(data)
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

  async function handleUpload(event) {
    event.preventDefault()
    if (!file) {
      setError('Choose a photo first.')
      return
    }
    setUploading(true)
    setError('')
    try {
      await progressApi.upload(file, { photoDate, notes, runAnalysis })
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
        subtitle="A visual timeline of your skin. Compare new photos with older ones."
      />

      <Alert>{error}</Alert>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card h-fit p-5">
          <h2 className="font-semibold text-slate-900">Add a progress photo</h2>
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
          {loading ? (
            <div className="flex items-center justify-center py-20 text-brand-600">
              <Spinner className="h-7 w-7" />
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
                      className="h-40 w-full object-cover"
                    />
                    <button
                      onClick={() => remove(photo.id)}
                      disabled={busyId === photo.id}
                      className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-slate-500 opacity-0 shadow transition hover:text-rose-600 group-hover:opacity-100"
                      title="Delete photo"
                    >
                      {busyId === photo.id ? <Spinner className="h-4 w-4" /> : <Icon name="trash" className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-slate-900">{formatDate(photo.photo_date)}</p>
                    {photo.notes && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{photo.notes}</p>}
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
