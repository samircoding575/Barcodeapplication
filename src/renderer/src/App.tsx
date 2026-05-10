import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAppStore } from './store/appStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'
import { LoginPage } from './routes/auth/LoginPage'
import { Students } from './routes/admin/Students'
import { BarcodePrint } from './routes/admin/BarcodePrint'
import { Reports } from './routes/admin/Reports'
import { Dashboard } from './routes/admin/Dashboard'
import { Grade } from './routes/teacher/Grade'
import { Import } from './routes/teacher/Import'
import { History } from './routes/teacher/History'
import { Sessions } from './routes/admin/Sessions'
import { Settings } from './routes/admin/Settings'

function PreloadError(): JSX.Element {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="bg-paper border border-divider rounded-2xl shadow-card p-8 max-w-md text-center">
        <p className="text-danger font-semibold text-lg mb-2">Preload script failed to load</p>
        <p className="text-slate text-sm mb-2"><code>window.api</code> is undefined.</p>
        <p className="text-slate/60 text-xs">Check the DevTools console (Ctrl+Shift+I) for details.</p>
      </div>
    </div>
  )
}

function AnimatedMain({ children }: { children: React.ReactNode }): JSX.Element {
  const location = useLocation()
  return (
    <main key={location.pathname} className="flex-1 overflow-auto motion-safe:animate-fade-in">
      <ErrorBoundary>{children}</ErrorBoundary>
    </main>
  )
}

function AdminShell(): JSX.Element {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopBar role="admin" />
      <AnimatedMain>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/candidates" element={<Students />} />
          <Route path="/barcodes" element={<BarcodePrint />} />
          <Route path="/results" element={<Reports />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AnimatedMain>
    </div>
  )
}

function ExaminerShell(): JSX.Element {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopBar role="teacher" />
      <AnimatedMain>
        <Routes>
          <Route path="/grade" element={<Grade />} />
          <Route path="/import" element={<Import />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Navigate to="/grade" replace />} />
        </Routes>
      </AnimatedMain>
    </div>
  )
}

export function App(): JSX.Element {
  if (typeof window.api === 'undefined') {
    return <PreloadError />
  }

  const user = useAppStore((s) => s.user)

  if (!user) {
    return (
      <HashRouter>
        <LoginPage />
      </HashRouter>
    )
  }

  const isAdmin = user.role === 'ADMIN'

  return (
    <HashRouter>
      {isAdmin ? <AdminShell /> : <ExaminerShell />}
    </HashRouter>
  )
}
