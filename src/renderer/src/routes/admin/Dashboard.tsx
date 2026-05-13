import { useEffect, useState, useCallback } from 'react'
import type { DashboardData, GradeLogEntry } from '@shared/types'
import { formatGrade } from '@shared/types'
import { useAppStore, useIsAdmin } from '../../store/appStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Badge } from '../../components/ui/Badge'

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
  value, label, color = 'neutral', onClick,
}: { value: string | number; label: string; color?: 'neutral' | 'green' | 'amber' | 'red' | 'purple'; onClick?: () => void }): JSX.Element {
  const colors = { neutral: 'text-ink', green: 'text-success', amber: 'text-warning', red: 'text-danger', purple: 'text-brand-purple' }
  return (
    <div
      className={`bg-paper border border-divider rounded-xl p-5 flex flex-col gap-1 shadow-sm transition-all duration-150 ${onClick ? 'cursor-pointer hover:border-brand-purple/40 hover:shadow-md active:scale-[0.98]' : ''}`}
      onClick={onClick}
    >
      <p className={`text-3xl font-display font-bold ${colors[color]}`}>{value}</p>
      <p className="text-xs font-semibold text-slate uppercase tracking-wide">{label}</p>
      {onClick && <p className="text-[10px] text-brand-purple font-semibold mt-1">Click to view →</p>}
    </div>
  )
}

// ─── Modified Grades Modal ────────────────────────────────────────────────────
function ModifiedGradesModal({
  sessionId, examId, onClose,
}: { sessionId: string; examId?: string; onClose: () => void }): JSX.Element {
  const [entries, setEntries] = useState<GradeLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const data = await window.api.admin.getGradeLog({ sessionId, examId })
      setEntries(data)
      setLoading(false)
    }
    load()
  }, [sessionId, examId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-paper rounded-2xl shadow-xl border border-divider w-full max-w-2xl max-h-[80vh] flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider">
          <div>
            <p className="font-semibold text-ink text-lg">Modified Grades</p>
            <p className="text-xs text-slate mt-0.5">Barcodes with manually changed grades</p>
          </div>
          <button onClick={onClose} className="text-slate hover:text-ink text-lg px-2">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-slate py-8 animate-pulse">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-center text-slate py-8">No modified grades found.</p>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="bg-surface rounded-xl border border-divider p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-ink font-semibold">••••{entry.token.slice(-8)}</p>
                    <p className="text-xs text-slate mt-0.5">{entry.examName}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[9px] text-slate uppercase tracking-wider font-semibold">Initial</span>
                      <span className="font-mono text-sm text-slate line-through">{formatGrade(entry.originalValue)}</span>
                    </div>
                    <span className="text-slate/40 mt-3">→</span>
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-[9px] text-warning uppercase tracking-wider font-semibold">New</span>
                      <Badge variant="warning">
                        <span className="font-mono font-bold">{formatGrade(entry.newValue)}</span>
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate">{new Date(entry.modifiedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Exam summary table ───────────────────────────────────────────────────────
function ExamSummaryTable({ exams }: { exams: DashboardData['exams'] }): JSX.Element {
  return (
    <div className="bg-paper rounded-2xl border border-divider shadow-card overflow-hidden">
      <div className="px-5 py-3 bg-surface border-b border-divider">
        <p className="text-sm font-semibold text-ink">Exam Breakdown</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-surface border-b border-divider">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Exam</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Total</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Attended</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Absent</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Modified</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Passed</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Failed</th>
          </tr>
        </thead>
        <tbody>
          {exams.map((ex, i) => {
            const absent = ex.totalCandidates - ex.attendedCount
            return (
              <tr key={ex.examId} className={`border-b border-divider/60 ${i % 2 === 0 ? 'bg-paper' : 'bg-surface/40'}`}>
                <td className="px-4 py-3 font-medium text-ink">{ex.examName}</td>
                <td className="px-4 py-3 text-right text-slate">{ex.totalCandidates}</td>
                <td className="px-4 py-3 text-right text-brand-purple font-semibold">{ex.attendedCount}</td>
                <td className="px-4 py-3 text-right text-slate">{absent > 0 ? absent : '—'}</td>
                <td className="px-4 py-3 text-right">
                  {ex.modifiedGradeCount > 0
                    ? <span className="text-warning font-semibold">{ex.modifiedGradeCount}</span>
                    : <span className="text-slate">0</span>}
                </td>
                <td className="px-4 py-3 text-right text-success font-semibold">{ex.passedCount}</td>
                <td className="px-4 py-3 text-right text-danger font-semibold">{ex.failedCount}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function Dashboard(): JSX.Element {
  const sessions = useAppStore((s) => s.sessions)
  const activeSession = useAppStore((s) => s.activeSession)
  const isPrimaryAdmin = useIsAdmin()

  const [viewSessionId, setViewSessionId] = useState(activeSession?.id ?? '')
  const [viewExamId, setViewExamId] = useState('')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showModified, setShowModified] = useState(false)

  const viewingSession = sessions.find((s) => s.id === viewSessionId)
  const exams = viewingSession?.exams ?? []

  useEffect(() => {
    if (activeSession && !viewSessionId) setViewSessionId(activeSession.id)
  }, [activeSession])

  useEffect(() => { setViewExamId('') }, [viewSessionId])

  const loadData = useCallback(async () => {
    if (!viewSessionId) { setData(null); return }
    setLoading(true)
    try {
      const result = await window.api.admin.getDashboardData({ sessionId: viewSessionId, examId: viewExamId || undefined })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [viewSessionId, viewExamId])

  useEffect(() => { loadData() }, [loadData])

  const passed = data ? (data.admittedCount + data.eligibleNotAdmittedCount) : 0
  const absent = data ? (data.totalCandidates - data.attendedCount) : 0
  const showMultiExam = !viewExamId && (data?.exams ?? []).length > 1

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      <PageHeader
        title="Dashboard"
        subtitle={viewingSession
          ? `${viewingSession.title} ${viewingSession.year}${viewingSession.semester ? ` · ${viewingSession.semester}` : ''}`
          : 'Select a session to view analytics'}
        actions={
          <div className="flex gap-3 flex-wrap">
            <select className="input-base py-2 text-sm max-w-[240px]" value={viewSessionId} onChange={(e) => setViewSessionId(e.target.value)}>
              <option value="">— Select session —</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.title} {s.year}{s.semester ? ` · ${s.semester}` : ''}{s.isActive ? ' ✓' : ''}</option>
              ))}
            </select>
            {viewSessionId && exams.length > 0 && (
              <select className="input-base py-2 text-sm max-w-[180px]" value={viewExamId} onChange={(e) => setViewExamId(e.target.value)}>
                <option value="">All Exams</option>
                {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            )}
            <Button variant="secondary" onClick={loadData} loading={loading}>Refresh</Button>
          </div>
        }
      />

      {!viewSessionId ? (
        <EmptyState title="Select a session" description="Choose an exam session above to view its dashboard." />
      ) : loading && !data ? (
        <div className="flex items-center justify-center py-32 text-slate animate-pulse">Loading…</div>
      ) : data ? (
        <div className="flex flex-col gap-6 animate-fade-in">

          {/* KPI row */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard value={data.totalCandidates} label="Total Participants" color="neutral" />
            <KpiCard value={data.attendedCount} label="Attended" color="purple" />
            <KpiCard value={passed} label="Passed" color="green" />
            <KpiCard
              value={data.modifiedGradeCount}
              label="Modified Grades"
              color={data.modifiedGradeCount > 0 ? 'amber' : 'neutral'}
              onClick={data.modifiedGradeCount > 0 ? () => setShowModified(true) : undefined}
            />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <KpiCard value={absent} label="Absent" color={absent > 0 ? 'red' : 'neutral'} />
            <KpiCard value={data.failedCount} label="Failed" color="red" />
          </div>

          {/* Exam summary table */}
          {showMultiExam && <ExamSummaryTable exams={data.exams} />}

        </div>
      ) : null}

      {/* Modified grades modal */}
      {showModified && viewSessionId && (
        <ModifiedGradesModal
          sessionId={viewSessionId}
          examId={viewExamId || undefined}
          onClose={() => setShowModified(false)}
        />
      )}
    </div>
  )
}
