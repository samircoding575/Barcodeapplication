import { useState } from 'react'
import { AdminLoginForm } from './AdminLoginForm'
import { EmployeeLoginForm } from './EmployeeLoginForm'
import logoSrc from '../../assets/softretail-logo.png'

type Role = 'examiner' | 'admin'

export function LoginPage(): JSX.Element {
  const [role, setRole] = useState<Role>('examiner')

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6 relative overflow-hidden">
      {/* Professional background - Subtle grid and premium gradient */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-brand-purple opacity-20 blur-[100px]"></div>
        <div className="absolute bottom-0 right-0 -z-10 h-[400px] w-[400px] rounded-full bg-brand-cyan opacity-10 blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md bg-paper rounded-2xl shadow-card-lg border border-divider overflow-hidden relative z-10 animate-fade-in">
        {/* Institutional header - White background to show logo colors */}
        <div className="px-8 py-8 text-center border-b border-divider">
          <div className="mb-6 flex justify-center">
            <img src={logoSrc} alt="Softretail" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="font-display text-xl font-bold text-ink leading-tight">
            Lebanese Bar Association
          </h1>
          <p className="text-slate text-xs mt-1.5 uppercase tracking-widest font-semibold">ScanGrade Portal</p>
        </div>

        <div className="px-8 pt-6 pb-8 bg-surface/30">
          {/* Role selector */}
          <div className="flex rounded-lg bg-divider/50 p-1 mb-6 border border-divider">
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
      className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors duration-150 ${
        active
          ? 'bg-paper text-brand-purple shadow-sm border border-divider/50'
          : 'text-slate hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}
