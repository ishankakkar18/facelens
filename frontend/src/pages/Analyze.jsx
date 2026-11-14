import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icons'
import { Alert, PageHeader, Spinner } from '../components/UI'
import { analysisApi } from '../lib/api'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

export default function Analyze() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [consent, setConsent] = useState(false)
  const [save, setSave] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function pickFile(candidate) {
    if (!candidate) return
    setError('')
    if (!ALLOWED.includes(candidate.type)) {
      setError('Please choose a JPG, PNG, or WEBP image.')
      return
    }
    if (candidate.size > MAX_BYTES) {
      setError('That image is larger than 8 MB. Please choose a smaller one.')
      return
    }
    setFile(candidate)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!file) {
      setError('Choose a selfie first.')
      return
    }
    if (!consent) {
      setError('Please confirm consent before analyzing.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const data = await analysisApi.analyze(file, { consent, save })
      sessionStorage.setItem(
        'facelens_last_result',
        JSON.stringify({ id: data.id, result: data.result, image_url: data.image_url, saved: save }),
      )
      navigate('/result')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Analyze a selfie"
        subtitle="Good light, no filters, and a relaxed, front-facing expression works best."
      />

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              pickFile(event.dataTransfer.files?.[0])
            }}
            className={`card flex min-h-[320px] flex-col items-center justify-center p-6 text-center transition ${
              dragging ? 'ring-2 ring-brand-400' : ''
            }`}
          >
            {preview ? (
              <div className="w-full">
                <img
                  src={preview}
                  alt="Selected selfie"
                  className="mx-auto max-h-[360px] w-auto rounded-2xl object-contain"
                />
                <div className="mt-4 flex justify-center gap-2">
                  <button type="button" className="btn-ghost" onClick={() => inputRef.current?.click()}>
                    Choose another
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setFile(null)}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Icon name="camera" className="h-7 w-7" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">Drop a selfie here</h2>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  JPG, PNG, or WEBP up to 8 MB. Face the camera directly with even lighting.
                </p>
                <button type="button" className="btn-primary mt-5" onClick={() => inputRef.current?.click()}>
                  Choose photo
                </button>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => pickFile(event.target.files?.[0])}
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card space-y-4 p-5">
            <Alert>{error}</Alert>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={save}
                onChange={(event) => setSave(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">Save to my history</span>
                <span className="text-xs text-slate-500">
                  Stores the photo and turns suggestions into daily habits.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                required
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  I consent to photo analysis
                </span>
                <span className="text-xs text-slate-500">
                  I'm 13+ and understand this is a wellness tool, not medical advice.
                </span>
              </span>
            </label>

            <button type="submit" className="btn-primary w-full py-3" disabled={submitting || !file}>
              {submitting ? (
                <>
                  <Spinner /> Analyzing your photo…
                </>
              ) : (
                <>
                  <Icon name="sparkles" className="h-4 w-4" /> Analyze my face
                </>
              )}
            </button>

            <div className="rounded-xl bg-brand-50 p-3 text-xs leading-5 text-brand-800">
              <strong>Privacy:</strong> photos are not kept unless you save them. Everything is processed
              for this analysis only.
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
