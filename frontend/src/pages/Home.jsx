import { Link } from 'react-router-dom'
import Icon from '../components/Icons'
import { useAuth } from '../context/AuthContext'

const features = [
  {
    icon: 'camera',
    title: 'Upload a selfie',
    body: 'Get a warm, neutral read on your face, skin, and features — no scores, no judgement.',
  },
  {
    icon: 'calendar',
    title: 'Daily checklist',
    body: 'Every suggestion becomes a simple day-wise habit you can tick off and build a streak with.',
  },
  {
    icon: 'chart',
    title: 'See what changed',
    body: 'Compare check-ins over time and get a plain-language summary of what improved and what needs focus.',
  },
  {
    icon: 'stethoscope',
    title: 'Doctor support',
    body: 'Find a dermatologist, keep a question log, and track visits, prescriptions, and follow-ups.',
  },
]

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Icon name="sparkles" className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">FaceLens</span>
        </div>
        <nav className="flex items-center gap-2">
          {user ? (
            <Link to="/dashboard" className="btn-primary">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link to="/register" className="btn-primary">
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 via-white to-white" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="chip mb-5">
              <Icon name="spark" className="h-3.5 w-3.5" /> Skin + grooming, tracked daily
            </span>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Your face, understood.
              <br />
              <span className="text-brand-600">Your progress, tracked.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
              Upload a selfie, get a kind and practical skin and grooming report, then follow a daily
              checklist. Come back anytime to see exactly what changed.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={user ? '/analyze' : '/register'} className="btn-primary px-5 py-3">
                Start free <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
              <Link to="/login" className="btn-ghost px-5 py-3">
                I have an account
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
              <Icon name="info" className="h-3.5 w-3.5" />
              Photos are ephemeral by default. Not medical advice.
            </p>
          </div>

          <div className="relative">
            <div className="card mx-auto max-w-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Today</p>
                  <p className="text-lg font-bold text-slate-900">Your routine</p>
                </div>
                <span className="chip">
                  <Icon name="heart" className="h-3.5 w-3.5" /> 12 day streak
                </span>
              </div>
              <div className="mt-4 space-y-2.5">
                {[
                  ['Gentle cleanser + lukewarm water', true],
                  ['Moisturizer while skin is damp', true],
                  ['SPF 30+ before going out', false],
                  ['Hydration check: 2L water', false],
                ].map(([label, done]) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md ${
                        done ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-300'
                      }`}
                    >
                      {done && <Icon name="check" className="h-3.5 w-3.5" />}
                    </span>
                    <span className={done ? 'text-slate-400 line-through' : 'text-slate-700'}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-brand-50 p-3 text-xs text-brand-800">
                <strong>What changed:</strong> redness looks calmer than last week. Keep the barrier
                routine going.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          One app for the whole journey
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="card p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon name={feature.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="rounded-3xl bg-slate-900 px-6 py-10 text-center sm:px-12">
          <h2 className="text-2xl font-bold text-white">Kind, practical, and private</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            FaceLens never rates attractiveness. It focuses on skin health, grooming, and habits — and it
            always recommends a licensed dermatologist for anything medical.
          </p>
          <Link to={user ? '/dashboard' : '/register'} className="btn-primary mt-6 px-5 py-3">
            Create your tracker
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        FaceLens · General wellness analysis, not medical advice.
      </footer>
    </div>
  )
}
