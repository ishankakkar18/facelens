import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CameraCapture from '../components/CameraCapture'
import Icon from '../components/Icons'
import { Alert, PageHeader, Spinner } from '../components/UI'
import { analysisApi } from '../lib/api'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

const ANGLES = [
  { key: 'front', label: 'Front', hint: 'Look straight at the camera' },
  { key: 'right', label: 'Right side', hint: 'Turn to show your right cheek' },
  { key: 'left', label: 'Left side', hint: 'Turn to show your left cheek' },
]

export default function Analyze() {
  const navigate = useNavigate()
  const inputRefs = useRef({})
  const [photos, setPhotos] = useState({ front: null, right: null, left: null })
  const [cameraFor, setCameraFor] = useState(null)
  const [consent, setConsent] = useState(false)
  const [save, setSave] = useState(true)
  const [error, setError] = useState('')
  const [slotErrors, setSlotErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!submitting) {
      setSlow(false)
      return
    }
    const timer = setTimeout(() => setSlow(true), 6000)
    return () => clearTimeout(timer)
  }, [submitting])

  function setPhoto(key, file) {
    if (!file) return
    setError('')
    if (!ALLOWED.includes(file.type)) {
      setError('Please choose a JPG, PNG, or WEBP image for each photo.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Each photo must be smaller than 8 MB.')
      return
    }
    setPhotos((current) => {
      if (current[key]?.preview) URL.revokeObjectURL(current[key].preview)
      return { ...current, [key]: { file, preview: URL.createObjectURL(file) } }
    })
    setSlotErrors((current) => ({ ...current, [key]: undefined }))
  }

  function removePhoto(key) {
    setPhotos((current) => {
      if (current[key]?.preview) URL.revokeObjectURL(current[key].preview)
      return { ...current, [key]: null }
    })
  }

  const allPhotos = Boolean(photos.front && photos.right && photos.left)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!allPhotos) {
      setError('Add all three photos: front, right side, and left side.')
      return
    }
    if (!consent) {
      setError('Please confirm consent before analyzing.')
      return
    }
    setSubmitting(true)
    setError('')
    setSlotErrors({})
    try {
      const data = await analysisApi.analyze(
        {
          front: photos.front.file,
          right: photos.right.file,
          left: photos.left.file,
        },
        { consent, save },
      )
      const payload = { ...data, saved: save }
      sessionStorage.setItem('facelens_last_result', JSON.stringify(payload))
      navigate('/result', {
        state: {
          data: payload,
          previews: {
            front: photos.front.preview,
            right: photos.right.preview,
            left: photos.left.preview,
          },
        },
      })
    } catch (err) {
      setError(err.message)
      if (err.data?.photo_errors) {
        setSlotErrors(err.data.photo_errors)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Analyze 3 photos"
        subtitle="We check the angles first, then analyze skin, acne, and marks in detail."
      />

      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          {ANGLES.map((angle, index) => {
            const photo = photos[angle.key]
            const slotError = slotErrors[angle.key]
            return (
              <div
                key={angle.key}
                className={`card p-4 ${slotError ? 'ring-2 ring-rose-300' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{angle.label}</p>
                    <p className="text-xs text-slate-500">{angle.hint}</p>
                  </div>
                  <span className="chip">{index + 1}/3</span>
                </div>

                <div className="mt-3 aspect-[4/5] overflow-hidden rounded-xl bg-slate-100">
                  {photo ? (
                    <img
                      src={photo.preview}
                      alt={`${angle.label} selfie`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                      <Icon name="user" className="h-10 w-10" />
                      <span className="text-xs">{angle.label} photo</span>
                    </div>
                  )}
                </div>

                {slotError && <p className="mt-2 text-xs font-medium text-rose-600">{slotError}</p>}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="btn-ghost px-2"
                    onClick={() => inputRefs.current[angle.key]?.click()}
                  >
                    <Icon name="image" className="h-4 w-4" /> Upload
                  </button>
                  <button
                    type="button"
                    className="btn-primary px-2"
                    onClick={() => setCameraFor(angle.key)}
                  >
                    <Icon name="camera" className="h-4 w-4" /> Camera
                  </button>
                </div>

                {photo && (
                  <button
                    type="button"
                    onClick={() => removePhoto(angle.key)}
                    className="mt-2 text-xs font-medium text-slate-400 hover:text-rose-600"
                  >
                    Remove
                  </button>
                )}

                <input
                  ref={(element) => {
                    inputRefs.current[angle.key] = element
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => setPhoto(angle.key, event.target.files?.[0])}
                />
              </div>
            )
          })}
        </div>

        <div className="card mt-5 space-y-4 p-5">
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
                Stores all three photos and turns suggestions into daily habits.
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

          <button
            type="submit"
            className="btn-primary w-full py-3"
            disabled={submitting || !allPhotos}
          >
            {submitting ? (
              <>
                <Spinner /> Checking angles and analyzing…
              </>
            ) : (
              <>
                <Icon name="sparkles" className="h-4 w-4" /> Analyze my face
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-500">
            All three angles are checked first. If one is wrong, you'll be asked to retake it.
          </p>
        </div>
      </form>

      {cameraFor && (
        <CameraCapture
          angle={cameraFor}
          onCapture={(file) => {
            setPhoto(cameraFor, file)
            setCameraFor(null)
          }}
          onClose={() => setCameraFor(null)}
        />
      )}

      {submitting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-card ring-1 ring-slate-100">
            <Spinner className="mx-auto h-8 w-8 text-brand-600" />
            <p className="mt-4 font-semibold text-slate-900">Checking your three angles…</p>
            <p className="mt-1 text-sm text-slate-500">
              {slow
                ? 'This can take up to a minute while the free server wakes up.'
                : 'Then we analyze skin, acne, and marks in detail.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
