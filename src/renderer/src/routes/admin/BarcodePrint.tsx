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
                onChange={(e) => setViewSessionId(e.target.value)}
              >
                <option value="">— Select session —</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} {s.year}{s.semester ? ` · ${s.semester}` : ''}{s.isActive ? ' ✓' : ''}
                  </option>
                ))}
              </select>
              {barcodes.length > 0 && (
                <Button onClick={() => window.print()}>
                  Print (Ctrl+P)
                </Button>
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
                      filterStatus === f ? 'bg-navy text-white' : 'bg-paper text-slate hover:bg-surface'
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

            {/* Barcode grid */}
            {filtered.length === 0 ? (
              <EmptyState title="No matches" description="Try adjusting your search or filter." />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((entry) => (
                  <BarcodeCard key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Printable area — only renders during Ctrl+P ─────────────────────── */}
      <div id="barcode-print-area">
        <div className="print-header hidden">
          <div style={{ textAlign: 'center', marginBottom: '8mm', borderBottom: '1px solid #0B1E3F', paddingBottom: '4mm' }}>
            <strong style={{ fontSize: '13pt', color: '#0B1E3F' }}>
              Lebanese Bar Association — {sessionLabel}
            </strong>
            <br />
            <span style={{ fontSize: '9pt', color: '#666' }}>نقابة المحامين في بيروت</span>
            <span style={{ fontSize: '8pt', color: '#999', marginLeft: '8mm' }}>
              Printed: {new Date().toLocaleDateString()}
            </span>
          </div>
        </div>
        <div id="barcode-print-grid">
          {barcodes.map((entry) => (
            <div key={`p-${entry.id}`} className="barcode-card">
              <Barcode value={entry.token} format="CODE128" displayValue={false} height={60} width={1.5} margin={4} />
              <div className="barcode-card-label">
                <p>{entry.student.externalId}</p>
                <p>{entry.student.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BarcodeCard({ entry }: { entry: AdminBarcode }): JSX.Element {
  return (
    <div className={`bg-paper border rounded-2xl overflow-hidden shadow-card transition-all duration-150 hover:shadow-card-lg ${entry.graded ? 'border-success/30' : 'border-divider'}`}>
      {/* Card header */}
      <div className={`px-4 pt-4 pb-2 ${entry.graded ? 'bg-emerald-50/50' : 'bg-surface'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-ink text-sm leading-tight truncate">{entry.student.name}</p>
            <p className="font-mono text-xs text-slate mt-0.5">{entry.student.externalId}</p>
          </div>
          <Badge variant={entry.graded ? 'success' : 'neutral'} className="shrink-0 mt-0.5">
            {entry.graded ? (entry.gradeValue !== null ? formatGrade(entry.gradeValue) : 'Graded') : 'Pending'}
          </Badge>
        </div>
      </div>

      {/* Barcode */}
      <div className="flex justify-center px-4 py-3 bg-paper">
        <Barcode
          value={entry.token}
          format="CODE128"
          displayValue={false}
          height={50}
          width={1.4}
          margin={0}
          background="transparent"
        />
      </div>

      {/* Token footer */}
      <div className="px-4 pb-3">
        <p className="font-mono text-xs text-slate/50 text-center tracking-wider truncate">
          ••••{entry.token.slice(-12)}
        </p>
      </div>
    </div>
  )
}
