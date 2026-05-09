import { useState } from 'react'
import { AdminLoginForm } from './AdminLoginForm'
import { EmployeeLoginForm } from './EmployeeLoginForm'

type Role = 'examiner' | 'admin'

export function LoginPage(): JSX.Element {
  const [role, setRole] = useState<Role>('examiner')

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-paper rounded-2xl shadow-card-lg border border-divider overflow-hidden">
        {/* Institutional header */}
        <div className="bg-navy px-8 py-8 text-center">
          <p className="text-gold text-xs font-semibold uppercase tracking-widest mb-1">نقابة المحامين في بيروت</p>
          <h1 className="font-display text-2xl font-semibold text-white leading-tight">
            Lebanese Bar Association
          </h1>
          <p className="text-white/60 text-xs mt-2 uppercase tracking-widest">ScanGrade</p>
        </div>

        <div className="px-8 pt-6 pb-8">
          {/* Role selector */}
          <div className="flex rounded-lg bg-surface p-1 mb-6">
            <RoleBtn label="Examiner" active={role === 'examiner'} onClick={() => setRole('examiner')} />
            <RoleBtn label="Admin" active={role === 'admin'} onClick={() => setRole('admin')} />
          </div>

          {role === 'examiner' ? <EmployeeLoginForm /> : <AdminLoginForm />}
        </div>
      </div>
    </div>
  )
}

function RoleBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-150 ${
        active
          ? 'bg-paper text-navy shadow-sm'
          : 'text-slate hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}
