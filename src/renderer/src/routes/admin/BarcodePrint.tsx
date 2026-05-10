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
  const [barcodes, setBarcodes] = useState<AdminBarcode[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (activeSession && !viewSessionId) setViewSessionId(activeSession.id)
  }, [activeSession])

  useEffect(() => {
    if (!viewSessionId) { setBarcodes([]); return }
    setLoading(true)
    window.api.admin.listBarcodes({ sessionId: viewSessionId })
      .then(setBarcodes)
      .finally(() => setLoading(false))
  }, [viewSessionId])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return barcodes.filter((b) => {
      const matchSearch =
        !q ||
        b.student.name.toLowerCase().includes(q) ||
        b.student.externalId.toLowerCase().includes(q) ||
        b.token.toLowerCase().includes(q)
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'graded' && b.graded) ||
        (filterStatus === 'pending' && !b.graded)
      return matchSearch && matchStatus
    })
  }, [barcodes, search, filterStatus])

  const gradedCount = barcodes.filter((b) => b.graded).length
  const viewingSession = sessions.find((s) => s.id === viewSessionId)
  const sessionLabel = viewingSession
    ? [viewingSession.title, viewingSession.year, viewingSession.semester].filter(Boolean).join(' · ')
    : 'Unknown Session'

  return (
    <div>
      {/* Screen controls */}
      <div className="no-print p-8">
        <PageHeader
          title="Barcodes"
          subtitle={viewingSession ? sessionLabel : 'Select a session to view barcodes'}
          actions={
            <div className="flex gap-3">
              <select
                className="input-base py-2 text-sm max-w-[220px]"
                value={viewSessionId}
                onChange={(e) => {
                  setViewSessionId(e.target.value)
                  setSelectedIds(new Set())
                }}
              >
                <option value="">— Select session —</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} {s.year}{s.semester ? ` · ${s.semester}` : ''}{s.isActive ? ' ✓' : ''}
                  </option>
                ))}
              </select>
              {barcodes.length > 0 && (
                <div className="flex items-center gap-3">
                  {selectedIds.size > 0 && (
                    <Button variant="secondary" onClick={() => setSelectedIds(new Set())}>
                      Clear ({selectedIds.size})
                    </Button>
                  )}
                  <Button onClick={() => window.print()}>
                    {selectedIds.size > 0 ? `Print ${selectedIds.size} Selected` : 'Print All (Ctrl+P)'}
                  </Button>
                </div>
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
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard value={barcodes.length} label="Total Barcodes" />
              <StatCard value={gradedCount} label="Graded" accent />
              <StatCard value={barcodes.length - gradedCount} label="Pending" />
              <StatCard value={`${Math.round((gradedCount / barcodes.length) * 100)}%`} label="Completion" />
            </div>

            {/* Search & filter toolbar */}
            <div className="flex items-center gap-3 mb-5">
              <input
                type="search"
                className="input-base max-w-xs"
                placeholder="Search name, ID, token…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex rounded-xl overflow-hidden border border-divider">
                {(['all', 'pending', 'graded'] as FilterStatus[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterStatus(f)}
                    className={`px-3 py-2 text-xs font-semibold capitalize transition-colors duration-150 ${
                      filterStatus === f ? 'bg-brand-purple text-white shadow-sm' : 'bg-paper text-slate hover:bg-surface'
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

            {/* Barcode table */}
            {filtered.length === 0 ? (
              <EmptyState title="No matches" description="Try adjusting your search or filter." />
            ) : (
              <div className="bg-paper border border-divider rounded-xl shadow-sm overflow-hidden mt-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-surface border-b border-divider">
                        <th className="px-4 py-3 text-center w-12">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate/30 text-brand-purple focus:ring-brand-purple w-4 h-4"
                            checked={filtered.length > 0 && selectedIds.size === filtered.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(new Set(filtered.map(b => b.id)))
                              } else {
                                setSelectedIds(new Set())
                              }
                            }}
                          />
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider w-1/4">Student Name</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider w-1/6">Student ID</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider w-1/4">Barcode Image</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider w-1/6">Token ID</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider text-right w-1/6">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((entry, i) => (
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
                          <td className="px-4 py-3">
                            <p className="font-semibold text-ink text-sm truncate">{entry.student.name}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs text-slate">{entry.student.externalId}</p>
                          </td>
                          <td className="px-4 py-2 align-middle">
                            <div className="inline-flex items-center justify-center bg-white px-1.5 py-0.5 rounded shadow-sm border border-divider">
                              <Barcode
                                value={entry.token}
                                format="CODE128"
                                displayValue={false}
                                height={24}
                                width={0.6}
                                margin={0}
                                background="transparent"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs text-slate tracking-wider">
                              ••••{entry.token.slice(-12)}
                            </p>
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
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Printable area — only renders during Ctrl+P ─────────────────────── */}
      <div id="barcode-print-area" className="hidden print:block">
        <div className="print-header hidden">
          <div style={{ textAlign: 'center', marginBottom: '8mm', borderBottom: '1px solid #0E2841', paddingBottom: '4mm' }}>
            <strong style={{ fontSize: '13pt', color: '#0E2841' }}>
              Lebanese Bar Association — {sessionLabel}
            </strong>
            <br />
            <span style={{ fontSize: '9pt', color: '#666' }}>نقابة المحامين في بيروت</span>
            <span style={{ fontSize: '8pt', color: '#999', marginLeft: '8mm' }}>
              Printed: {new Date().toLocaleDateString()}
            </span>
            <div style={{ fontSize: '9pt', color: '#ef4444', marginTop: '3mm', fontWeight: 'bold' }}>
              IMPORTANT: Ensure print scale is set to "100%" or "Actual Size" in your printer dialog.
            </div>
          </div>
        </div>
        <div id="barcode-print-grid">
          {(selectedIds.size > 0 ? barcodes.filter(b => selectedIds.has(b.id)) : barcodes).map((entry) => (
            <div key={`p-${entry.id}`} className="barcode-card">
              <Barcode value={entry.token} format="CODE128" displayValue={false} height={60} width={1.5} margin={4} />
              <div className="barcode-card-label">
                <p style={{ fontWeight: 'bold', marginBottom: '1mm' }}>{entry.student.externalId}</p>
                <p>{entry.student.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
