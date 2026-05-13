import { useEffect, useState } from 'react'
import type { GradeLogEntry } from '@shared/types'
import { formatGrade } from '@shared/types'
import { useAppStore } from '../../store/appStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Badge } from '../../components/ui/Badge'

export function GradeLog(): JSX.Element {
  const activeSession = useAppStore((s) => s.activeSession)
  const sessions = useAppStore((s) => s.sessions)

  const [entries, setEntries] = useState<GradeLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<string>('all')

  useEffect(() => { load() }, [sessionFilter])

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const sessionId = sessionFilter === 'all' ? undefined : sessionFilter
      const data = await window.api.admin.getGradeLog({ sessionId })
      setEntries(data)
    } finally {
      setLoading(false)
    }
  }

  const displaySessions = sessions

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      <PageHeader
        title="Grade Audit Log"
        subtitle={`All manually modified grades${entries.length > 0 ? ` · ${entries.length} record${entries.length === 1 ? '' : 's'}` : ''}`}
        actions={
          <Button variant="secondary" onClick={load} loading={loading}>Refresh</Button>
        }
      />

      {/* Session filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSessionFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            sessionFilter === 'all' ? 'bg-brand-purple text-white shadow-sm' : 'bg-surface text-slate border border-divider hover:text-ink'
          }`}
        >
          All Sessions
        </button>
        {displaySessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setSessionFilter(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              sessionFilter === s.id ? 'bg-brand-purple text-white shadow-sm' : 'bg-surface text-slate border border-divider hover:text-ink'
            }`}
          >
            {s.title} {s.year}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate text-sm py-8 text-center">Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No modified grades"
          description="When an admin manually changes a submitted grade, it will appear here with the reason and audit trail."
        />
      ) : (
        <div className="bg-paper rounded-2xl border border-divider shadow-card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface border-b border-divider">
                <th className="px-5 py-3.5 text-xs font-semibold text-slate uppercase tracking-wider">Barcode Token</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate uppercase tracking-wider">Exam</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate uppercase tracking-wider">Original</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate uppercase tracking-wider">New Grade</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate uppercase tracking-wider">Reason</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate uppercase tracking-wider">Modified By</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`border-b border-divider/60 transition-colors hover:bg-accent-50/30 ${
                    i % 2 === 0 ? 'bg-paper' : 'bg-surface/30'
                  }`}
                >
                  <td className="px-5 py-4">
                    <p className="font-mono text-sm text-ink font-semibold">••••{entry.token.slice(-8)}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate">{entry.examName}</td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-sm text-slate line-through">{formatGrade(entry.originalValue)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant="warning">
                      <span className="font-mono font-bold">{formatGrade(entry.newValue)}</span>
                    </Badge>
                  </td>
                  <td className="px-5 py-4 max-w-[240px]">
                    <p className="text-sm text-ink italic truncate" title={entry.modifiedReason}>
                      "{entry.modifiedReason}"
                    </p>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate font-medium">{entry.modifiedByEmail}</td>
                  <td className="px-5 py-4 text-xs text-slate whitespace-nowrap">
                    {new Date(entry.modifiedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
