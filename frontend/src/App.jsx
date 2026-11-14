import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Analyze from './pages/Analyze'
import Compare from './pages/Compare'
import Dashboard from './pages/Dashboard'
import Doctor from './pages/Doctor'
import History from './pages/History'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Progress from './pages/Progress'
import Register from './pages/Register'
import Result from './pages/Result'
import Settings from './pages/Settings'
import Tracker from './pages/Tracker'

export default function App() {
  return (
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
  )
}
