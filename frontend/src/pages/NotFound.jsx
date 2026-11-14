import { Link } from 'react-router-dom'
import { EmptyState } from '../components/UI'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <EmptyState
        icon="spark"
        title="Page not found"
        description="That page does not exist or has moved."
        action={
          <Link to="/" className="btn-primary">
            Go home
          </Link>
        }
      />
    </div>
  )
}
