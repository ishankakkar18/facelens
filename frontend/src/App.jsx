import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { FullPageLoader } from './components/UI'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Register from './pages/Register'
import { warmUp } from './lib/api'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Analyze = lazy(() => import('./pages/Analyze'))
const Result = lazy(() => import('./pages/Result'))
const Tracker = lazy(() => import('./pages/Tracker'))
const Progress = lazy(() => import('./pages/Progress'))
const History = lazy(() => import('./pages/History'))
const Compare = lazy(() => import('./pages/Compare'))
const Doctor = lazy(() => import('./pages/Doctor'))
const Settings = lazy(() => import('./pages/Settings'))

export default function App() {
  useEffect(() => {
    warmUp()
  }, [])

  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/result" element={<Result />} />
            <Route path="/result/:id" element={<Result />} />
            <Route path="/tracker" element={<Tracker />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/history" element={<History />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/doctor" element={<Doctor />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
