import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Icon from './Icons'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/analyze', label: 'Analyze', icon: 'camera' },
  { to: '/tracker', label: 'Tracker', icon: 'calendar' },
  { to: '/progress', label: 'Progress', icon: 'chart' },
  { to: '/history', label: 'History', icon: 'image' },
  { to: '/doctor', label: 'Doctor', icon: 'stethoscope' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

const mobileNav = navItems.filter((item) =>
  ['/dashboard', '/analyze', '/tracker', '/progress', '/doctor'].includes(item.to),
)

function logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
        <Icon name="sparkles" className="h-5 w-5" />
      </span>
      <span className="text-lg font-bold tracking-tight text-slate-900">FaceLens</span>
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex">
        <div className="px-2">{logo()}</div>
        <nav className="mt-8 flex-1 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="truncate text-sm font-medium text-slate-800">{user?.email}</p>
          <button
            onClick={logout}
            className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-rose-600"
          >
            <Icon name="logout" className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        {logo()}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Toggle menu"
        >
          <Icon name={menuOpen ? 'close' : 'menu'} className="h-5 w-5" />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-x-0 top-[57px] z-20 border-b border-slate-200 bg-white p-4 shadow-lg lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Icon name={item.icon} className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
          <button
            onClick={logout}
            className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            <Icon name="logout" className="h-4 w-4" /> Sign out ({user?.email})
          </button>
        </div>
      )}

      <main className="px-4 pb-24 pt-5 sm:px-6 lg:ml-64 lg:px-10 lg:pb-10 lg:pt-8">
        <div key={location.pathname} className="mx-auto max-w-5xl animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white lg:hidden">
        <div className="grid grid-cols-5">
          {mobileNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  isActive ? 'text-brand-600' : 'text-slate-500'
                }`
              }
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
