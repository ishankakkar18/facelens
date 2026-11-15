import { useEffect, useRef, useState } from 'react'
import Icon from './Icons'
import { Spinner } from './UI'

const HINTS = {
  front: 'Look straight at the camera with a relaxed expression.',
  right: 'Turn your head so your right cheek faces the camera.',
  left: 'Turn your head so your left cheek faces the camera.',
}

export default function CameraCapture({ angle = 'front', onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera is not available in this browser. Please upload a photo instead.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setReady(true)
        }
      } catch {
        setError('Could not access the camera. Check permissions or upload a photo instead.')
      }
    }

    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `facelens-${angle}-${Date.now()}.jpg`, { type: 'image/jpeg' })
        stop()
        onCapture(file)
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {angle === 'front' ? 'Front photo' : angle === 'right' ? 'Right side' : 'Left side'}
            </p>
            <p className="text-xs text-slate-500">{HINTS[angle]}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-square bg-slate-900">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full scale-x-[-1] object-cover"
          />
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Spinner className="h-7 w-7" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
              {error}
            </div>
          )}
          <div className="pointer-events-none absolute inset-6 rounded-full border-2 border-white/30" />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={capture} disabled={!ready} className="btn-primary px-6">
            <Icon name="camera" className="h-4 w-4" /> Capture
          </button>
        </div>
      </div>
    </div>
  )
}
