import { NavLink } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import logoSrc from '../assets/softretail-logo.png'

interface TopBarProps {
  role: 'admin' | 'teacher'
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }): JSX.Element {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 text-sm font-semibold transition-colors duration-150 border-b-2 whitespace-nowrap ${
          isActive
            ? 'border-accent text-accent'
            : 'border-transparent text-slate hover:text-ink hover:border-slate/30'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export function TopBar({ role }: TopBarProps): JSX.Element {
  const user = useAppStore((s) => s.user)
  const logout = useAppStore((s) => s.logout)
  const activeSession = useAppStore((s) => s.activeSession)

  const sessionLabel = activeSession
    ? [activeSession.title, activeSession.year, activeSession.semester].filter(Boolean).join(' · ')
    : 'No active session'

  return (
    <nav className="no-print h-14 bg-paper flex items-center px-6 gap-0 border-b border-divider shrink-0">
      {/* Brand logo & label */}
      <div className="flex items-center gap-3 mr-6 shrink-0">
        <img src={logoSrc} alt="Softretail" className="h-7 w-auto object-contain" />
        <div className="h-5 w-px bg-divider" />
        <span className="font-display font-semibold text-ink text-sm tracking-wide">
          {role === 'admin' ? 'Admin' : 'Examiner'}
        </span>
      </div>

      {/* Route links */}
      <div className="flex items-stretch h-full">
        {role === 'admin' ? (
          <>
            <NavItem to="/dashboard">Dashboard</NavItem>
            <NavItem to="/candidates">Candidates</NavItem>
            <NavItem to="/barcodes">Barcodes</NavItem>
            <NavItem to="/results">Results</NavItem>
            <NavItem to="/sessions">Sessions</NavItem>
            <NavItem to="/settings">Settings</NavItem>
          </>
        ) : (
          <>
            <NavItem to="/grade">Grade</NavItem>
            <NavItem to="/import">Import</NavItem>
            <NavItem to="/history">History</NavItem>
          </>
        )}
      </div>

      {/* Active session badge — center */}
      <div className="flex-1 flex justify-center px-4">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-md border text-xs font-mono tracking-wide ${activeSession ? 'bg-surface border-divider text-ink' : 'border-transparent text-slate/60 italic'}`}>
          {activeSession && <span className="w-2 h-2 rounded-full bg-brand-cyan" />}
          <span className="truncate max-w-xs">{sessionLabel}</span>
        </div>
      </div>

      {/* User + logout */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs font-medium text-slate hidden sm:block truncate max-w-[160px]">{user?.email}</span>
        <button
          onClick={logout}
          className="text-xs font-semibold text-slate hover:text-danger transition-colors duration-150 px-3 py-1.5 rounded-md border border-divider hover:border-danger/30 hover:bg-danger/5"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
