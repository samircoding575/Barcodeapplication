import { useEffect, useState, useMemo, useCallback } from 'react'
import type { MasterCandidate } from '@shared/types'
import { formatGrade } from '@shared/types'
import { useAppStore } from '../../store/appStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { StatCard } from '../../components/ui/StatCard'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'

type StatusFilter = 'all' | 'graded' | 'pending'
type AddMode = 'none' | 'import' | 'manual'

export function Students(): JSX.Element {
  const activeSession = useAppStore((s) => s.activeSession)
  const [viewSessionId, setViewSessionId] = useState<string>('')
  const sessions = useAppStore((s) => s.sessions)

  const [candidates, setCandidates] = useState<MasterCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<AddMode>('none')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Manual add form state
  const [manualExtId, setManualExtId] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualError, setManualError] = useState('')
  const [manualLoading, setManualLoading] = useState(false)

  // Use active session by default, allow browsing other sessions
  useEffect(() => {
    if (activeSession && !viewSessionId) setViewSessionId(activeSession.id)
  }, [activeSession])

  useEffect(() => {
    if (!viewSessionId) return
    load()
  }, [viewSessionId])

  const load = useCallback(async () => {
    if (!viewSessionId) return
    setCandidates(await window.api.admin.getMasterView({ sessionId: viewSessionId }))
  }, [viewSessionId])

  async function handleImport(): Promise<void> {
    if (!viewSessionId) return
    setLoading(true)
    setImportStatus(null)
    try {
      const res = await window.api.admin.importStudents({ sessionId: viewSessionId })
      if (res.success) {
        setImportStatus({ type: 'success', msg: `Imported ${res.count} candidate${res.count !== 1 ? 's' : ''} · ${res.barcodesGenerated} new barcode${res.barcodesGenerated !== 1 ? 's' : ''} generated` })
        await load()
      } else {
        setImportStatus({ type: 'error', msg: res.error ?? 'Import cancelled' })
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleManualAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!viewSessionId || !manualExtId.trim() || !manualName.trim()) { setManualError('Both fields are required'); return }
    setManualLoading(true)
    setManualError('')
    const res = await window.api.admin.addStudent({ externalId: manualExtId.trim(), name: manualName.trim(), sessionId: viewSessionId })
    if (res.success) {
      setManualExtId('')
      setManualName('')
      setAddMode('none')
      await load()
    } else {
      setManualError(res.error ?? 'Failed to add student')
    }
    setManualLoading(false)
  }

  async function handleDelete(id: string, name: string): Promise<void> {
    if (!confirm(`Delete "${name}"? This will remove all their barcodes and grades across all sessions.`)) return
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
      const matchSearch = !q || c.name.toLowerCase().includes(q) || c.externalId.toLowerCase().includes(q) || (c.token ?? '').includes(q)
      const matchStatus = statusFilter === 'all' || (statusFilter === 'graded' && c.graded) || (statusFilter === 'pending' && !c.graded)
      return matchSearch && matchStatus
    })
  }, [candidates, search, statusFilter])

  const totalGraded = candidates.filter((c) => c.graded).length
  const totalBarcodes = candidates.filter((c) => c.token !== null).length
  const selected = selectedId ? candidates.find((c) => c.id === selectedId) ?? null : null

  const isEditable = viewSessionId === activeSession?.id
  const viewingSession = sessions.find((s) => s.id === viewSessionId)

  return (
    <div className="p-8 max-w-screen-xl mx-auto">
      <PageHeader
        title="Candidates"
        subtitle={viewingSession ? `${viewingSession.title} ${viewingSession.year}${viewingSession.semester ? ` · ${viewingSession.semester}` : ''}` : undefined}
        actions={
          <div className="flex gap-3">
            {/* Session browser */}
            <select className="input-base py-2 text-sm max-w-[200px]" value={viewSessionId} onChange={(e) => setViewSessionId(e.target.value)}>
              <option value="">— Select session —</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.title} {s.year}{s.semester ? ` · ${s.semester}` : ''}{s.isActive ? ' ✓' : ''}</option>
              ))}
            </select>
            {isEditable && (
              <>
                <Button variant="secondary" onClick={() => setAddMode((m) => m === 'manual' ? 'none' : 'manual')}>
                  + Add Student
                </Button>
                <Button onClick={handleImport} loading={loading}>
                  Import File
                </Button>
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

          {/* Manual add form */}
          {addMode === 'manual' && (
            <Card className="mb-6 animate-fade-in">
              <CardHeader><p className="font-semibold text-sm text-ink">Add Student Manually</p></CardHeader>
              <CardBody>
                <form onSubmit={handleManualAdd} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">External ID</label>
                      <input className="input-base" value={manualExtId} onChange={(e) => setManualExtId(e.target.value)} placeholder="e.g. 2024001" autoFocus />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">Full Name</label>
                      <input className="input-base" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="e.g. Ahmad Karimi" />
                    </div>
                  </div>
                  {manualError && <p className="text-danger text-sm">{manualError}</p>}
                  <div className="flex gap-3">
                    <Button type="submit" loading={manualLoading}>Add & Generate Barcode</Button>
                    <Button type="button" variant="secondary" onClick={() => { setAddMode('none'); setManualError('') }}>Cancel</Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard value={candidates.length} label="Total Candidates" />
            <StatCard value={totalBarcodes} label="Barcodes Generated" />
            <StatCard value={totalGraded} label="Graded" accent />
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
                  <input type="search" className="input-base max-w-xs" placeholder="Search name, ID, token…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">ID</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Token</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Grade</th>
                        {isEditable && <th className="px-4 py-3" />}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c, i) => (
                        <tr key={c.id} onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                          className={`cursor-pointer border-b border-divider/60 transition-colors duration-100 ${c.id === selectedId ? 'bg-accent-50 border-l-2 border-brand-purple' : i % 2 === 0 ? 'bg-paper hover:bg-surface' : 'bg-surface/60 hover:bg-surface'}`}>
                          <td className="px-4 py-3 font-mono text-xs text-slate">{c.externalId}</td>
                          <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate/70">
                            {c.token ? `••••${c.token.slice(-8)}` : <span className="text-divider">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={c.graded ? 'success' : 'neutral'}>{c.graded ? 'Graded' : 'Pending'}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-display font-semibold text-ink">
                            {c.gradeValue !== null ? formatGrade(c.gradeValue) : <span className="text-divider">—</span>}
                          </td>
                          {isEditable && (
                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleDelete(c.id, c.name)}
                                disabled={deletingId === c.id}
                                className="text-xs text-danger hover:text-red-800 transition-colors px-2 py-1 rounded hover:bg-red-50"
                                title="Delete student"
                              >
                                {deletingId === c.id ? '…' : 'Delete'}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                      <Row label="Name" value={selected.name} />
                      <Row label="External ID" value={selected.externalId} mono />
                      <Row label="Token" value={selected.token ? `••••${selected.token.slice(-12)}` : '—'} mono />
                      <Row label="Status" value={selected.graded ? 'Graded' : 'Pending'} />
                      {selected.gradeValue !== null && <Row label="Grade" value={formatGrade(selected.gradeValue)} />}
                      {selected.gradedAt && <Row label="Graded At" value={new Date(selected.gradedAt).toLocaleString()} />}
                    </dl>
                    {isEditable && (
                      <div className="mt-5 pt-4 border-t border-divider">
                        <Button
                          variant="danger"
                          size="sm"
                          className="w-full justify-center"
                          loading={deletingId === selected.id}
                          onClick={() => handleDelete(selected.id, selected.name)}
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
