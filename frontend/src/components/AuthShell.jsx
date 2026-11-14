import { Link } from 'react-router-dom'
import Icon from './Icons'

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-5 py-5">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Icon name="sparkles" className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">FaceLens</span>
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-md">
          <div className="card p-6 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          <p className="mt-5 text-center text-sm text-slate-500">{footer}</p>
        </div>
      </div>
    </div>
  )
}
