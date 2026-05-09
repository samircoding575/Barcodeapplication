import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { Button } from '../../components/ui/Button'

export function AdminLoginForm(): JSX.Element {
  const login = useAppStore((s) => s.login)
  const loadSessions = useAppStore((s) => s.loadSessions)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await window.api.auth.adminLogin({ email: email.trim(), password })
      if (res.success && res.user) {
        login(res.user)
        await loadSessions()
      } else {
        setError(res.error ?? 'Login failed')
      }
    } finally {
      setLoading(false)
    }
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
          placeholder="admin@lba.lb"
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

      {error && (
        <p className="text-danger text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 animate-fade-in">
          {error}
        </p>
      )}

      <Button type="submit" loading={loading} className="w-full justify-center py-2.5 mt-2">
        Sign in
      </Button>
    </form>
  )
}
