import { Link } from 'react-router-dom'
import Icon from '../components/Icons'
import { PageHeader } from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../lib/format'

export default function Settings() {
  const { user, logout } = useAuth()

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your account and data preferences." />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900">Account</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-900">{user?.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Member since</dt>
              <dd className="font-medium text-slate-900">{formatDate(user?.created_at)}</dd>
            </div>
          </dl>
          <button onClick={logout} className="btn-danger mt-4 w-full">
            <Icon name="logout" className="h-4 w-4" /> Sign out
          </button>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900">Privacy</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            <li className="flex gap-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              Photos are only stored when you choose "Save to my history".
            </li>
            <li className="flex gap-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              You can delete any analysis or progress photo at any time.
            </li>
            <li className="flex gap-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              FaceLens is a wellness tool. It does not diagnose conditions.
            </li>
          </ul>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Shortcuts</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Link to="/history" className="btn-ghost justify-start">
              <Icon name="image" className="h-4 w-4" /> History
            </Link>
            <Link to="/progress" className="btn-ghost justify-start">
              <Icon name="chart" className="h-4 w-4" /> Progress
            </Link>
            <Link to="/doctor" className="btn-ghost justify-start">
              <Icon name="stethoscope" className="h-4 w-4" /> Doctor hub
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        FaceLens · General wellness analysis, not medical advice.
      </p>
    </div>
  )
}
