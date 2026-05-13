import { useEffect, useState } from 'react'
import type { GradeResult } from '@shared/types'
import { formatGrade } from '@shared/types'
import { useAppStore, useIsAdmin } from '../../store/appStore'
import Papa from 'papaparse'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { StatCard } from '../../components/ui/StatCard'
import { EmptyState } from '../../components/ui/EmptyState'

// ─── Grade Modify Modal ───────────────────────────────────────────────────────
function GradeModifyModal({
  result, onClose, onSuccess,
}: {
  result: GradeResult; onClose: () => void; onSuccess: () => void;
}): JSX.Element {
  const [newGradeStr, setNewGradeStr] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const currentGrade = formatGrade(result.value)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const value = Math.round(parseFloat(newGradeStr.replace(',', '.')) * 100)
    if (isNaN(value) || value < 0) { setError('Enter a valid grade'); return }
    if (value === result.value) { setError('New grade must be different from the current grade'); return }
    if (reason.trim().length < 3) { setError('Reason must be at least 3 characters'); return }
    setSaving(true)
    setError('')
    const res = await window.api.admin.modifyGrade({ barcodeId: result.barcodeId, newValue: value, reason: reason.trim() })
    if (res.success) { onSuccess() } else { setError(res.error ?? 'Failed'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-paper rounded-2xl shadow-xl border border-divider p-6 w-full max-w-lg animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <p className="font-semibold text-ink text-lg">Modify Grade</p>
          <button onClick={onClose} className="text-slate hover:text-ink text-sm px-2">✕</button>
        </div>

        {/* Barcode info */}
        <div className="bg-surface rounded-xl border border-divider px-4 py-3 mb-5">
          <p className="text-xs text-slate font-semibold uppercase tracking-wide mb-1">Barcode</p>
          <p className="font-mono text-sm text-ink font-bold">{result.barcode.token}</p>
          <p className="text-xs text-slate mt-0.5">{result.barcode.examName}</p>
        </div>

        {/* Current → New grade side by side */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex-1 bg-surface rounded-xl border border-divider p-4 text-center">
            <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Current Grade</p>
            <p className="text-3xl font-display font-bold text-ink">{currentGrade}</p>
          </div>
          <div className="shrink-0 text-2xl text-slate/40 font-light">→</div>
          <div className="flex-1 bg-surface rounded-xl border-2 border-brand-purple/30 p-4 text-center">
            <p className="text-xs font-semibold text-brand-purple uppercase tracking-wide mb-2">New Grade</p>
            <input
              type="number"
              className="w-full text-3xl font-display font-bold text-brand-purple text-center bg-transparent border-none outline-none focus:ring-0 p-0"
              value={newGradeStr}
              onChange={(e) => setNewGradeStr(e.target.value)}
              step="0.25"
              min="0"
              placeholder={currentGrade}
              autoFocus
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">
              Reason <span className="normal-case font-normal text-slate/60">(required)</span>
            </label>
            <textarea
              className="input-base min-h-[80px] resize-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Transcription error — original sheet shows 14.50"
            />
          </div>
          {error && <p className="text-danger text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={!newGradeStr}>Apply Change</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function Reports(): JSX.Element {
  const sessions = useAppStore((s) => s.sessions)
  const activeSession = useAppStore((s) => s.activeSession)
  const isPrimaryAdmin = useIsAdmin()

  const [viewSessionId, setViewSessionId] = useState(activeSession?.id ?? '')
  const [viewExamId, setViewExamId] = useState('')
  const [results, setResults] = useState<GradeResult[]>([])
  const [totalCandidates, setTotalCandidates] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportingXlsx, setExportingXlsx] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)
  const [modifyTarget, setModifyTarget] = useState<GradeResult | null>(null)

  const viewingSession = sessions.find((s) => s.id === viewSessionId)
  const exams = viewingSession?.exams ?? []

  useEffect(() => {
    if (activeSession && !viewSessionId) setViewSessionId(activeSession.id)
  }, [activeSession])

  useEffect(() => { setViewExamId('') }, [viewSessionId])

  useEffect(() => {
    if (!viewSessionId) { setResults([]); setTotalCandidates(0); return }
    load()
  }, [viewSessionId, viewExamId])

  async function load(): Promise<void> {
    const [res, mv] = await Promise.all([
      window.api.admin.getResults({ sessionId: viewSessionId, examId: viewExamId || undefined }),
      window.api.admin.getMasterView({ sessionId: viewSessionId, examId: viewExamId || undefined }),
    ])
    setResults(res)
    setTotalCandidates(mv.length)
  }

  async function handleExportCsv(): Promise<void> {
    if (!results.length || !viewSessionId) return
    setExporting(true)
    try {
      const label = viewingSession ? `${viewingSession.title} ${viewingSession.year}${viewingSession.semester ? ` ${viewingSession.semester}` : ''}` : 'results'
      const rows = results.map((r) => ({
        external_id: r.barcode.student.externalId,
        name: r.barcode.student.name,
        exam: r.barcode.examName,
        grade: formatGrade(r.value),
      }))
      const csv = '\uFEFF' + Papa.unparse(rows)
      await window.api.file.saveCsv({ content: csv, defaultName: `${label.toLowerCase().replace(/\s+/g, '-')}-results.csv` })
    } finally {
      setExporting(false)
    }
  }

  async function handleExportXlsx(): Promise<void> {
    if (!viewSessionId) return
    setExportingXlsx(true)
    try {
      const label = viewingSession ? `${viewingSession.title} ${viewingSession.year}${viewingSession.semester ? ` ${viewingSession.semester}` : ''}` : 'results'
      const res = await window.api.admin.exportXlsx({ sessionId: viewSessionId, sessionLabel: label })
      if (!res.success && res.error) console.error('[export-xlsx]', res.error)
    } finally {
      setExportingXlsx(false)
    }
  }

  async function handleExportAll(): Promise<void> {
    if (sessions.length === 0) return
    setExportingAll(true)
    try {
      const allRows: { session: string; external_id: string; name: string; exam: string; grade: string }[] = []
      for (const s of sessions) {
        const sessionResults = await window.api.admin.getResults({ sessionId: s.id })
        const label = [s.title, s.year, s.semester].filter(Boolean).join(' · ')
        sessionResults.forEach((r) => {
          allRows.push({
            session: label,
            external_id: r.barcode.student.externalId,
            name: r.barcode.student.name,
            exam: r.barcode.examName,
            grade: formatGrade(r.value),
          })
        })
      }
      const csv = '\uFEFF' + Papa.unparse(allRows)
      await window.api.file.saveCsv({ content: csv, defaultName: 'all-sessions-master-results.csv' })
    } finally {
      setExportingAll(false)
    }
  }

  const avg = results.length > 0 ? results.reduce((a, b) => a + b.value, 0) / results.length : null
  const modifiedCount = results.filter((r) => r.isModified).length

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      {/* Title row */}
      <div className="mb-5">
        <h2 className="text-2xl font-display font-bold text-ink">Results</h2>
        <div className="h-1 w-10 bg-brand-purple mt-2 rounded-full" />
        {viewingSession && (
          <p className="text-sm text-slate mt-1.5">{viewingSession.title} {viewingSession.year}{viewingSession.semester ? ` · ${viewingSession.semester}` : ''}</p>
        )}
      </div>

      {/* Controls row — visually separated */}
      <div className="flex flex-wrap items-center gap-3 mb-7 p-4 bg-surface rounded-xl border border-divider">
        <select className="input-base py-2 text-sm max-w-[220px]" value={viewSessionId} onChange={(e) => setViewSessionId(e.target.value)}>
          <option value="">— Select session —</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.title} {s.year}{s.semester ? ` · ${s.semester}` : ''}{s.isActive ? ' ✓' : ''}</option>
          ))}
        </select>
        {viewSessionId && exams.length > 0 && (
          <select className="input-base py-2 text-sm max-w-[160px]" value={viewExamId} onChange={(e) => setViewExamId(e.target.value)}>
            <option value="">All Exams</option>
            {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        )}
        <div className="w-px h-6 bg-divider mx-1 hidden sm:block" />
        <Button variant="secondary" onClick={load}>Refresh</Button>
        {results.length > 0 && (
          <Button variant="secondary" onClick={handleExportCsv} loading={exporting}>Export CSV</Button>
        )}
        {viewSessionId && (
          <Button onClick={handleExportXlsx} loading={exportingXlsx}>Export Excel</Button>
        )}
        <Button variant="secondary" onClick={handleExportAll} loading={exportingAll} disabled={sessions.length === 0}>
          Export All Sessions
        </Button>
      </div>

      {!viewSessionId ? (
        <EmptyState title="Select a session" description="Choose a session to view its results." />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard value={totalCandidates} label="Total Candidates" />
            <StatCard value={results.length} label="Graded" accent />
            <StatCard value={avg !== null ? formatGrade(avg) : '—'} label="Average Grade" accent={avg !== null} />
            <StatCard value={modifiedCount} label="Modified Grades" />
          </div>

          {results.length === 0 ? (
            <EmptyState title="No grades recorded" description="Grades will appear here once users begin grading." />
          ) : (
            <div className="bg-paper rounded-2xl border border-divider shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface border-b border-divider">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Barcode Token</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Exam</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Grade</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Graded At</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.id} className={`border-b border-divider/60 ${i % 2 === 0 ? 'bg-paper hover:bg-surface' : 'bg-surface/60 hover:bg-surface'} transition-all duration-150`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate">{r.barcode.token}</td>
                      <td className="px-4 py-3 text-xs text-slate">{r.barcode.examName}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.isModified && (
                            <span
                              title={`Changed by: ${r.modifiedById ?? 'admin'} — ${r.modifiedReason ?? ''}`}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-warning border border-amber-200 cursor-help"
                            >
                              Changed
                            </span>
                          )}
                          <span className="font-display font-bold text-brand-purple text-base">{formatGrade(r.value)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate">{new Date(r.gradedAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setModifyTarget(r)}
                          className="text-xs font-semibold text-slate hover:text-brand-purple transition-colors px-2 py-1 rounded hover:bg-surface"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modifyTarget && (
        <GradeModifyModal
          result={modifyTarget}
          onClose={() => setModifyTarget(null)}
          onSuccess={() => { setModifyTarget(null); load() }}
        />
      )}
    </div>
  )
}
