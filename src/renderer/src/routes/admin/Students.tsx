import { useEffect, useState, useMemo, useCallback } from 'react'
import type { MasterCandidate } from '@shared/types'
import { formatGrade } from '@shared/types'
import { useAppStore, useIsAdmin } from '../../store/appStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { StatCard } from '../../components/ui/StatCard'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'

type StatusFilter = 'all' | 'graded' | 'pending'

export function Students(): JSX.Element {
  const activeSession = useAppStore((s) => s.activeSession)
  const sessions = useAppStore((s) => s.sessions)
  const isAnyAdmin = useIsAdmin()

  const [viewSessionId, setViewSessionId] = useState<string>('')
  const [viewExamId, setViewExamId] = useState<string>('')

  const [candidates, setCandidates] = useState<MasterCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  useEffect(() => {
    if (activeSession && !viewSessionId) setViewSessionId(activeSession.id)
  }, [activeSession])

  const viewingSession = sessions.find((s) => s.id === viewSessionId)
  const exams = viewingSession?.exams ?? []

  // Reset exam filter when session changes
  useEffect(() => {
    setViewExamId('')
    setCandidates([])
  }, [viewSessionId])

  useEffect(() => {
    if (!viewSessionId) return
    load()
  }, [viewSessionId, viewExamId])

  const load = useCallback(async () => {
    if (!viewSessionId) return
    setCandidates(await window.api.admin.getMasterView({ sessionId: viewSessionId, examId: viewExamId || undefined }))
  }, [viewSessionId, viewExamId])

  async function handleImport(): Promise<void> {
    if (!viewSessionId) return
    const examIds = exams.map((e) => e.id)
    if (examIds.length === 0) { setImportStatus({ type: 'error', msg: 'No exams in this session. Create exams first.' }); return }
    setLoading(true)
    setImportStatus(null)
    try {
      const res = await window.api.admin.importStudents({ sessionId: viewSessionId, examIds })
      if (res.success) {
        setImportStatus({ type: 'success', msg: `Imported ${res.count} candidate${res.count !== 1 ? 's' : ''} · ${res.barcodesGenerated} barcode${res.barcodesGenerated !== 1 ? 's' : ''} generated` })
        await load()
      } else {
        setImportStatus({ type: 'error', msg: res.error ?? 'Import cancelled' })
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm(`Delete this candidate? This will remove all their barcodes and grades.`)) return
    setDeletingId(id)
    const res = await window.api.admin.deleteStudent({ id })
    if (res.success) {
      setCandidates((prev) => prev.filter((c) => c.id !== id))
      if (selectedId === id) setSelectedId(null)
    }
    setDeletingId(null)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return candidates.filter((c) => {
      const tokens = c.barcodes.map((b) => b.token).join(' ')
      const matchSearch = !q || tokens.includes(q)
      const anyGraded = c.barcodes.some((b) => b.graded)
      const matchStatus = statusFilter === 'all' || (statusFilter === 'graded' && anyGraded) || (statusFilter === 'pending' && !anyGraded)
      return matchSearch && matchStatus
    })
  }, [candidates, search, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, viewSessionId, viewExamId])

  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  const totalGraded = candidates.filter((c) => c.barcodes.some((b) => b.graded)).length
  const totalBarcodes = candidates.reduce((sum, c) => sum + c.barcodes.length, 0)
  const selected = selectedId ? candidates.find((c) => c.id === selectedId) ?? null : null

  const isEditable = isAnyAdmin && viewSessionId === activeSession?.id

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Candidates"
        subtitle={viewingSession ? `${viewingSession.title} ${viewingSession.year}${viewingSession.semester ? ` · ${viewingSession.semester}` : ''}` : undefined}
        actions={
          <div className="flex gap-3 flex-wrap">
            <select className="input-base py-2 text-sm max-w-[200px]" value={viewSessionId} onChange={(e) => setViewSessionId(e.target.value)}>
              <option value="">— Select session —</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.title} {s.year}{s.semester ? ` · ${s.semester}` : ''}{s.isActive ? ' ✓' : ''}</option>
              ))}
            </select>
            {viewSessionId && exams.length > 0 && (
              <select className="input-base py-2 text-sm max-w-[180px]" value={viewExamId} onChange={(e) => setViewExamId(e.target.value)}>
                <option value="">All Exams</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            )}
            {isEditable && (
              <>
                <Button onClick={handleImport} loading={loading}>Import File</Button>
              </>
            )}
          </div>
        }
      />

      {!viewSessionId && (
        <EmptyState title="Select a session" description="Choose an exam session above to view candidates." />
      )}

      {viewSessionId && (
        <>
          {importStatus && (
            <div className={`mb-5 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in ${importStatus.type === 'success' ? 'bg-emerald-50 text-success border border-emerald-200' : 'bg-red-50 text-danger border border-red-200'}`}>
              {importStatus.msg}
            </div>
          )}



          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard value={candidates.length} label="Total Candidates" />
            <StatCard value={totalBarcodes} label="Barcodes Generated" />
            <StatCard value={totalGraded} label="Graded (any exam)" accent />
            <StatCard value={candidates.length - totalGraded} label="Pending" />
          </div>

          {candidates.length === 0 ? (
            <EmptyState
              title="No candidates"
              description={isEditable ? 'Import a file or add students manually.' : 'No candidates in this session.'}
              action={isEditable ? <Button onClick={handleImport} loading={loading}>Import CSV / Excel</Button> : undefined}
            />
          ) : (
            <div className="flex gap-5">
              {/* Table */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <input type="search" className="input-base max-w-xs" placeholder="Search token…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <div className="flex rounded-xl overflow-hidden border border-divider">
                    {(['all', 'graded', 'pending'] as StatusFilter[]).map((f) => (
                      <button key={f} onClick={() => setStatusFilter(f)}
                        className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors duration-150 ${statusFilter === f ? 'bg-brand-purple text-white shadow-sm' : 'bg-paper text-slate hover:bg-surface'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                  {(search || statusFilter !== 'all') && <span className="text-xs text-slate">{filtered.length} shown</span>}
                </div>

                <div className="bg-paper rounded-2xl border border-divider shadow-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-surface border-b border-divider">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Candidate</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Exams</th>
                        {isEditable && <th className="px-4 py-3" />}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((c, i) => (
                        <tr key={c.id} onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                          className={`cursor-pointer border-b border-divider/60 transition-colors duration-100 ${c.id === selectedId ? 'bg-accent-50 border-l-2 border-brand-purple' : i % 2 === 0 ? 'bg-paper hover:bg-surface' : 'bg-surface/60 hover:bg-surface'}`}>
                          <td className="px-4 py-3 font-medium text-ink">Candidate {i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5 flex-wrap">
                              {c.barcodes.map((b) => (
                                <span key={b.examId} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${b.graded ? 'bg-emerald-100 text-success' : 'bg-surface text-slate border border-divider'}`}>
                                  {b.examName}
                                  {b.isModified && <span className="text-warning" title="Grade modified">✎</span>}
                                  {b.graded && b.gradeValue !== null && <span className="font-bold ml-1">{formatGrade(b.gradeValue)}</span>}
                                </span>
                              ))}
                            </div>
                          </td>
                          {isEditable && (
                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleDelete(c.id)}
                                disabled={deletingId === c.id}
                                className="text-xs text-danger hover:text-red-800 transition-colors px-2 py-1 rounded hover:bg-red-50"
                              >
                                {deletingId === c.id ? '…' : 'Delete'}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between px-4 py-3 bg-surface border-t border-divider">
                      <span className="text-xs text-slate font-medium">
                        Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={page === 1}
                          onClick={() => setPage((p) => p - 1)}
                          className="px-3 py-1.5 text-xs font-semibold bg-paper border border-divider rounded-lg hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Previous
                        </button>
                        <button
                          disabled={page * PAGE_SIZE >= filtered.length}
                          onClick={() => setPage((p) => p + 1)}
                          className="px-3 py-1.5 text-xs font-semibold bg-paper border border-divider rounded-lg hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Detail drawer */}
              {selected && (
                <div className="w-72 shrink-0 animate-fade-in">
                  <div className="bg-paper rounded-2xl border border-divider shadow-card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="font-semibold text-sm text-ink">Detail</p>
                      <button onClick={() => setSelectedId(null)} className="text-slate hover:text-ink text-xs">✕</button>
                    </div>
                    <dl className="space-y-3 text-sm">

                    </dl>
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Exam Barcodes</p>
                      <div className="space-y-2">
                        {selected.barcodes.map((b) => (
                          <div key={b.examId} className="bg-surface rounded-lg p-2.5 border border-divider">
                            <p className="text-xs font-semibold text-ink">{b.examName}</p>
                            <p className="font-mono text-xs text-slate/70 mt-0.5">••••{b.token.slice(-12)}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={b.graded ? 'success' : 'neutral'}>{b.graded ? 'Graded' : 'Pending'}</Badge>
                              {b.gradeValue !== null && <span className="text-xs font-bold text-brand-purple">{formatGrade(b.gradeValue)}</span>}
                              {b.isModified && <Badge variant="warning">Changed</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {isEditable && (
                      <div className="mt-5 pt-4 border-t border-divider">
                        <Button
                          variant="danger"
                          size="sm"
                          className="w-full justify-center"
                          loading={deletingId === selected.id}
                          onClick={() => handleDelete(selected.id)}
                        >
                          Delete Student
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate uppercase tracking-wide">{label}</dt>
      <dd className={`mt-0.5 text-ink break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}
