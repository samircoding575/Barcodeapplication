import { useEffect, useState } from 'react'
import type { GradeResult } from '@shared/types'
import { formatGrade, MIN_GRADE_HUNDREDTHS } from '@shared/types'
import { useAppStore } from '../../store/appStore'
import Papa from 'papaparse'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { StatCard } from '../../components/ui/StatCard'
import { EmptyState } from '../../components/ui/EmptyState'

export function Reports(): JSX.Element {
  const sessions = useAppStore((s) => s.sessions)
  const activeSession = useAppStore((s) => s.activeSession)
  const [viewSessionId, setViewSessionId] = useState(activeSession?.id ?? '')
  const [results, setResults] = useState<GradeResult[]>([])
  const [totalCandidates, setTotalCandidates] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)

  useEffect(() => {
    if (activeSession && !viewSessionId) setViewSessionId(activeSession.id)
  }, [activeSession])

  useEffect(() => {
    if (!viewSessionId) { setResults([]); setTotalCandidates(0); return }
    load()
  }, [viewSessionId])

  async function load(): Promise<void> {
    const [res, mv] = await Promise.all([
      window.api.admin.getResults({ sessionId: viewSessionId }),
      window.api.admin.getMasterView({ sessionId: viewSessionId }),
    ])
    setResults(res)
    setTotalCandidates(mv.length)
  }

  async function handleExport(): Promise<void> {
    if (!results.length || !viewSessionId) return
    setExporting(true)
    try {
      const viewingSession = sessions.find((s) => s.id === viewSessionId)
      const label = viewingSession ? `${viewingSession.title} ${viewingSession.year}${viewingSession.semester ? ` ${viewingSession.semester}` : ''}` : 'results'
      const rows = results.map((r) => ({
        external_id: r.barcode.student.externalId,
        name: r.barcode.student.name,
        grade: formatGrade(r.value),
        graded_at: new Date(r.gradedAt).toISOString(),
      }))
      const csv = Papa.unparse(rows)
      await window.api.file.saveCsv({ content: csv, defaultName: `${label.toLowerCase().replace(/\s+/g, '-')}-results.csv` })
    } finally {
      setExporting(false)
    }
  }

  async function handleExportAll(): Promise<void> {
    if (sessions.length === 0) return
    setExportingAll(true)
    try {
      let allRows: { session: string; external_id: string; name: string; grade: string }[] = []
      for (const s of sessions) {
        const sessionResults = await window.api.admin.getResults({ sessionId: s.id })
        const label = [s.title, s.year, s.semester].filter(Boolean).join(' · ')
        sessionResults.forEach((r) => {
          allRows.push({
            session: label,
            external_id: r.barcode.student.externalId,
            name: r.barcode.student.name,
            grade: formatGrade(r.value),
          })
        })
      }
      const csv = Papa.unparse(allRows)
      await window.api.file.saveCsv({ content: csv, defaultName: 'all-sessions-master-results.csv' })
    } finally {
      setExportingAll(false)
    }
  }

  const avg = results.length > 0 ? results.reduce((a, b) => a + b.value, 0) / results.length : null
  const viewingSession = sessions.find((s) => s.id === viewSessionId)

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      <PageHeader
        title="Results"
        subtitle={viewingSession ? `${viewingSession.title} ${viewingSession.year}${viewingSession.semester ? ` · ${viewingSession.semester}` : ''}` : undefined}
        actions={
          <div className="flex gap-3">
            <select className="input-base py-2 text-sm max-w-[220px]" value={viewSessionId} onChange={(e) => setViewSessionId(e.target.value)}>
              <option value="">— Select session —</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.title} {s.year}{s.semester ? ` · ${s.semester}` : ''}{s.isActive ? ' ✓' : ''}</option>
              ))}
            </select>
            <Button variant="secondary" onClick={load}>Refresh</Button>
            {results.length > 0 && (
              <Button onClick={handleExport} loading={exporting}>Export CSV</Button>
            )}
            <Button variant="secondary" onClick={handleExportAll} loading={exportingAll} disabled={sessions.length === 0}>
              Export All Sessions
            </Button>
          </div>
        }
      />

      {!viewSessionId ? (
        <EmptyState title="Select a session" description="Choose a session to view its results." />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard value={totalCandidates} label="Total Candidates" />
            <StatCard value={results.length} label="Graded" accent />
            <StatCard value={avg !== null ? formatGrade(avg) : '—'} label="Average Grade" accent={avg !== null} />
            <StatCard value={`${formatGrade(MIN_GRADE_HUNDREDTHS)} – ${formatGrade(viewingSession?.maxGrade ?? 2000)}`} label="Grade Range" />
          </div>

          {results.length === 0 ? (
            <EmptyState title="No grades recorded" description="Grades will appear here once examiners begin grading." />
          ) : (
            <div className="bg-paper rounded-2xl border border-divider shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface border-b border-divider">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Candidate ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Name</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Grade</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Graded At</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.id} className={`border-b border-divider/60 ${i % 2 === 0 ? 'bg-paper hover:bg-surface' : 'bg-surface/60 hover:bg-surface'} transition-all duration-150`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate">{r.barcode.student.externalId}</td>
                      <td className="px-4 py-3 font-medium text-ink">{r.barcode.student.name}</td>
                      <td className="px-4 py-3 text-right font-display font-bold text-brand-purple text-base">{formatGrade(r.value)}</td>
                      <td className="px-4 py-3 text-xs text-slate">{new Date(r.gradedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
