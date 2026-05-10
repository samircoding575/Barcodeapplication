import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { Badge } from '../../components/ui/Badge'
import { useAppStore } from '../../store/appStore'

export function History(): JSX.Element {
  const activeSession = useAppStore((s) => s.activeSession)
  const [progress, setProgress] = useState<{ token: string; graded: boolean }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!activeSession) return
    load()
  }, [activeSession])

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const data = await window.api.teacher.listProgress()
      setProgress(data)
    } finally {
      setLoading(false)
    }
  }

  const gradedCount = progress.filter(p => p.graded).length
  const totalCount = progress.length

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      <PageHeader 
        title="Grading History" 
        subtitle="Review progress for the active session without seeing candidate identities." 
        actions={
          <button onClick={load} className="px-4 py-2 text-sm font-medium bg-surface text-ink rounded-lg border border-divider hover:bg-paper transition-colors">
            Refresh
          </button>
        }
      />

      {!activeSession ? (
        <EmptyState title="No active session" description="An admin must activate a session before grading begins." />
      ) : loading && progress.length === 0 ? (
        <p className="text-center text-slate py-12">Loading progress...</p>
      ) : progress.length === 0 ? (
        <EmptyState title="No barcodes generated" description="No barcodes are available in the current active session." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard value={totalCount} label="Total Exam Sheets" />
            <StatCard value={gradedCount} label="Graded Sheets" accent />
            <StatCard value={totalCount - gradedCount} label="Remaining" />
          </div>

          <div className="bg-paper rounded-2xl border border-divider shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-divider">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate uppercase tracking-wide">Sheet Token</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider/60">
                {progress.map((p, i) => (
                  <tr key={i} className="hover:bg-surface/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate">
                      ••••{p.token.slice(-12)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Badge variant={p.graded ? 'success' : 'neutral'}>{p.graded ? 'Graded' : 'Pending'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
