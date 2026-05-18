import { useEffect, useState, useMemo } from 'react'
import Barcode from 'react-barcode'
import type { AdminBarcode } from '@shared/types'
import { formatGrade } from '@shared/types'
import { useAppStore } from '../../store/appStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { StatCard } from '../../components/ui/StatCard'
import { EmptyState } from '../../components/ui/EmptyState'

type FilterStatus = 'all' | 'graded' | 'pending'

export function BarcodePrint(): JSX.Element {
  const sessions = useAppStore((s) => s.sessions)
  const activeSession = useAppStore((s) => s.activeSession)
  const [viewSessionId, setViewSessionId] = useState(activeSession?.id ?? '')
  const [viewExamId, setViewExamId] = useState('')
  const [barcodes, setBarcodes] = useState<AdminBarcode[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (activeSession && !viewSessionId) setViewSessionId(activeSession.id)
  }, [activeSession])

  useEffect(() => {
    if (!viewSessionId) { setBarcodes([]); setViewExamId(''); return }
    setLoading(true)
    window.api.admin.listBarcodes({ sessionId: viewSessionId, examId: viewExamId || undefined })
      .then(setBarcodes)
      .finally(() => setLoading(false))
  }, [viewSessionId, viewExamId])

  const viewingSession = sessions.find((s) => s.id === viewSessionId)
  const exams = viewingSession?.exams ?? []

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return barcodes.filter((b) => {
      const matchSearch =
        !q ||
        b.token.toLowerCase().includes(q)
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'graded' && b.graded) ||
        (filterStatus === 'pending' && !b.graded)
      return matchSearch && matchStatus
    })
  }, [barcodes, search, filterStatus])

  useEffect(() => {
    setPage(1)
  }, [search, filterStatus, viewSessionId, viewExamId])

  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  const gradedCount = barcodes.filter((b) => b.graded).length
  const sessionLabel = viewingSession
    ? [viewingSession.title, viewingSession.year, viewingSession.semester].filter(Boolean).join(' · ')
    : 'Unknown Session'

  async function handleExportWord() {
    const list = selectedIds.size > 0
      ? barcodes.filter((b) => selectedIds.has(b.id))
      : filtered
    const records = list.map((b) => ({
      token: b.token,
      studentName: b.student.name,
      externalId: b.student.externalId,
      examName: b.examName,
    }))
    setExporting(true)
    try {
      await window.api.admin.exportBarcodesDocx({ records })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div className="p-8">
        <PageHeader
          title="Barcodes"
          subtitle={viewingSession ? sessionLabel : 'Select a session to view barcodes'}
          actions={
            <div className="flex gap-3 flex-wrap">
              <select
                className="input-base py-2 text-sm max-w-[220px]"
                value={viewSessionId}
                onChange={(e) => { setViewSessionId(e.target.value); setSelectedIds(new Set()) }}
              >
                <option value="">— Select session —</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} {s.year}{s.semester ? ` · ${s.semester}` : ''}{s.isActive ? ' ✓' : ''}
                  </option>
                ))}
              </select>
              {viewSessionId && exams.length > 0 && (
                <select
                  className="input-base py-2 text-sm max-w-[180px]"
                  value={viewExamId}
                  onChange={(e) => { setViewExamId(e.target.value); setSelectedIds(new Set()) }}
                >
                  <option value="">All Exams</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              )}
            </div>
          }
        />

        {!viewSessionId ? (
          <EmptyState title="Select a session" description="Choose an exam session to view its barcodes." />
        ) : loading ? (
          <p className="text-center text-slate py-16">Loading…</p>
        ) : barcodes.length === 0 ? (
          <EmptyState title="No barcodes" description="Import candidates to generate barcodes for this session." />
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard value={barcodes.length} label="Total Barcodes" />
              <StatCard value={gradedCount} label="Graded" accent />
              <StatCard value={barcodes.length - gradedCount} label="Pending" />
              <StatCard value={`${Math.round((gradedCount / barcodes.length) * 100)}%`} label="Completion" />
            </div>

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <input
                  type="search"
                  className="input-base max-w-xs"
                  placeholder="Search token…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="flex bg-surface p-1 rounded-xl border border-divider gap-1">
                  {(['all', 'pending', 'graded'] as FilterStatus[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterStatus(f)}
                      className={`px-4 py-1.5 text-xs font-semibold capitalize rounded-lg transition-colors duration-150 ${
                        filterStatus === f ? 'bg-white text-brand-purple shadow-sm ring-1 ring-slate/10' : 'text-slate hover:bg-paper'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {(search || filterStatus !== 'all') && (
                  <span className="text-xs text-slate">{filtered.length} of {barcodes.length}</span>
                )}
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-3">
                  {selectedIds.size > 0 && (
                    <Button variant="secondary" onClick={() => setSelectedIds(new Set())}>
                      Clear ({selectedIds.size})
                    </Button>
                  )}
                  <Button onClick={handleExportWord} loading={exporting}>
                    {exporting
                      ? 'Generating Word…'
                      : selectedIds.size > 0
                      ? `Export Word (${selectedIds.size})`
                      : `Export Word (${filtered.length})`}
                  </Button>
                </div>
                <p className="text-xs text-slate">
                  Opens in Word. Resize cells, margins, or fonts directly in the document before printing.
                </p>
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState title="No matches" description="Try adjusting your search or filter." />
            ) : (
              <div className="bg-paper border border-divider rounded-xl shadow-sm overflow-hidden mt-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-surface border-b border-divider">
                        <th className="px-4 py-3 text-center w-12">
                          <input
                            type="checkbox"
                            className="rounded border-slate/30 text-brand-purple focus:ring-brand-purple w-4 h-4"
                            checked={filtered.length > 0 && selectedIds.size === filtered.length}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds(new Set(filtered.map((b) => b.id)))
                              else setSelectedIds(new Set())
                            }}
                          />
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider">Barcode</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider">Exam</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((entry, i) => (
                        <tr
                          key={entry.id}
                          onClick={() => {
                            const next = new Set(selectedIds)
                            if (next.has(entry.id)) next.delete(entry.id)
                            else next.add(entry.id)
                            setSelectedIds(next)
                          }}
                          className={`cursor-pointer border-b border-divider/60 transition-colors duration-150 hover:bg-surface/50 ${
                            i % 2 === 0 ? 'bg-paper' : 'bg-surface/30'
                          } ${selectedIds.has(entry.id) ? 'bg-brand-purple/5' : ''}`}
                        >
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded border-slate/30 text-brand-purple focus:ring-brand-purple w-4 h-4 cursor-pointer"
                              checked={selectedIds.has(entry.id)}
                              onChange={(e) => {
                                const next = new Set(selectedIds)
                                if (e.target.checked) next.add(entry.id)
                                else next.delete(entry.id)
                                setSelectedIds(next)
                              }}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-3">
                              <div className="shrink-0 bg-white rounded border border-divider/50 p-1">
                                <Barcode value={entry.token} format="CODE128" displayValue={false} height={20} width={1} margin={0} />
                              </div>
                              <p className="font-mono text-xs text-ink tracking-wider">{entry.token}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-slate font-medium">{entry.examName}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge variant={entry.graded ? 'success' : 'neutral'}>
                              {entry.graded ? (entry.gradeValue !== null ? formatGrade(entry.gradeValue) : 'Graded') : 'Pending'}
                            </Badge>
                          </td>
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
            )}
          </>
        )}
      </div>
    </div>
  )
}
