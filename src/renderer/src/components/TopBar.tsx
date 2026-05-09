import { NavLink } from 'react-router-dom'
import { useAppStore } from '../store/appStore'

interface TopBarProps {
  role: 'admin' | 'teacher'
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }): JSX.Element {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 whitespace-nowrap ${
          isActive
            ? 'border-gold text-white'
            : 'border-transparent text-white/60 hover:text-white hover:border-white/30'
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
    <nav className="no-print h-14 bg-navy flex items-center px-6 gap-0 border-b border-navy-dark shrink-0">
      {/* Brand */}
      <span className="font-display font-semibold text-white text-sm tracking-wide mr-6 shrink-0">
        {role === 'admin' ? 'LBA Admin' : 'Examiner Portal'}
      </span>

      {/* Route links */}
      <div className="flex items-stretch h-full">
        {role === 'admin' ? (
          <>
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
        <span className={`text-xs font-mono tracking-wide truncate max-w-xs ${activeSession ? 'text-gold/80' : 'text-white/30 italic'}`}>
          {sessionLabel}
        </span>
      </div>

      {/* User + logout */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-white/40 hidden sm:block truncate max-w-[160px]">{user?.email}</span>
        <button
          onClick={logout}
          className="text-xs text-white/40 hover:text-white/80 transition-colors duration-150 px-2.5 py-1.5 rounded border border-white/10 hover:border-white/30"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
