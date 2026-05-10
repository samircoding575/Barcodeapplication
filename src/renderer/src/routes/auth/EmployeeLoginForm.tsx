import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { Button } from '../../components/ui/Button'

type Mode = 'signin' | 'signup'

export function EmployeeLoginForm(): JSX.Element {
  const login = useAppStore((s) => s.login)
  const loadSessions = useAppStore((s) => s.loadSessions)
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const fn = mode === 'signin' ? window.api.auth.employeeLogin : window.api.auth.employeeSignup
      const res = await fn({ email: email.trim().toLowerCase(), password })
      if (res.success && res.user) {
        login(res.user)
        await loadSessions()
      } else {
        setError(res.error ?? 'Authentication failed')
      }
    } finally {
      setLoading(false)
    }
  }

  function switchMode(e: React.MouseEvent, m: Mode): void {
    e.preventDefault()
    setMode(m)
    setError('')
    setConfirmPassword('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">Email</label>
        <input
          type="email"
          className="input-base"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="examiner@example.com"
          autoFocus
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">Password</label>
        <input
          type="password"
          className="input-base"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
      </div>

      {mode === 'signup' && (
        <div className="animate-fade-in">
          <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">Confirm Password</label>
          <input
            type="password"
            className="input-base"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
      )}

      {error && (
        <p className="text-danger text-sm bg-red-50 border border-red-200 rounded-md px-4 py-2.5 animate-fade-in">
          {error}
        </p>
      )}

      <Button type="submit" loading={loading} className="w-full justify-center py-2.5 mt-2">
        {mode === 'signin' ? 'Sign in' : 'Create account'}
      </Button>

      <div className="text-center mt-2">
        <button
          type="button"
          onClick={(e) => switchMode(e, mode === 'signin' ? 'signup' : 'signin')}
          className="text-sm text-slate hover:text-brand-purple font-semibold transition-colors duration-150"
        >
          {mode === 'signin' ? 'Create new account' : 'Back to sign in'}
        </button>
      </div>
    </form>
  )
}
