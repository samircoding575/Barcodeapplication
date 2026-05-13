import { useEffect, useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
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

  // 'rendering' = SVGs mounting, 'saving' = PDF generation in progress
  const [printState, setPrintState] = useState<'idle' | 'rendering' | 'saving'>('idle')
  const printListRef = useRef<AdminBarcode[]>([])

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

  // Wait for SVGs to render, then generate PDF via Electron
  useEffect(() => {
    if (printState !== 'rendering') return
    const id = setTimeout(async () => {
      setPrintState('saving')
      try {
        await window.api.admin.printBarcodePdf()
      } finally {
        setPrintState('idle')
      }
    }, 500)
    return () => clearTimeout(id)
  }, [printState])

  function handlePrint() {
    printListRef.current = selectedIds.size > 0
      ? barcodes.filter((b) => selectedIds.has(b.id))
      : filtered
    setPrintState('rendering')
  }

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
  const printLabel = viewExamId
    ? `${sessionLabel} — ${exams.find((e) => e.id === viewExamId)?.name ?? ''}`
    : sessionLabel

  const isPrinting = printState !== 'idle'

  return (
    <div>
      {/* Screen controls */}
      <div className="no-print p-8">
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
              
              <div className="flex items-center gap-3">
                {selectedIds.size > 0 && (
                  <Button variant="secondary" onClick={() => setSelectedIds(new Set())}>
                    Clear ({selectedIds.size})
                  </Button>
                )}
                <Button onClick={handlePrint} loading={isPrinting}>
                  {printState === 'saving'
                    ? 'Generating PDF…'
                    : printState === 'rendering'
                    ? 'Preparing…'
                    : selectedIds.size > 0
                    ? `Print ${selectedIds.size}`
                    : `Print All ${filtered.length}`}
                </Button>
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

      {/* ── Print portal — APLI Ref. 01282: 4×17 stickers, 48.5×16.9mm, A4 zero-margin ── */}
      {isPrinting && createPortal(
        <div id="barcode-print-area" dir="ltr" style={{ display: 'block', width: '210mm' }}>
          {(() => {
            const chunks: AdminBarcode[][] = []
            for (let i = 0; i < printListRef.current.length; i += RECORDS_PER_PAGE) {
              chunks.push(printListRef.current.slice(i, i + RECORDS_PER_PAGE))
            }

            return chunks.map((chunk, pageIdx) => (
              <div key={`page-${pageIdx}`} style={PAGE_STYLE}>
                {chunk.map((entry, i) => {
                  const row = Math.floor(i / RECORDS_PER_ROW)
                  const col = i % RECORDS_PER_ROW
                  const top = SHEET_TOP_MARGIN_MM + row * STICKER_H_MM
                  const left = SHEET_LEFT_MARGIN_MM + col * SLOT_W_MM

                  const name = entry.student.name || ''
                  const half = name.length / 2
                  const isDuplicated = name.length > 0 && name.length % 2 === 0 && name.slice(0, half) === name.slice(half)
                  const cleanName = isDuplicated ? name.slice(0, half) : name

                  return (
                    <div key={`rec-${entry.id}`} style={{ ...SLOT_STYLE, top: `${top}mm`, left: `${left}mm` }}>
                      <div style={BARCODE_CELL_STYLE}>
                        <ConstrainedBarcode value={entry.token} />
                        <p style={TOKEN_TEXT_STYLE}>{entry.token}</p>
                      </div>
                      <div style={TEXT_CELL_STYLE} dir="rtl">
                        <p style={LABEL_NAME_STYLE}>{cleanName}</p>
                        <p style={LABEL_META_STYLE}>ID: {entry.student.externalId}</p>
                        <p style={LABEL_META_STYLE}>{entry.examName}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          })()}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── APLI Ref. 01282 sheet geometry ────────────────────────────────────────────
// A4 (210×297mm) → 17 rows × 4 stickers, each 48.5×16.9mm
// One logical record = 2 adjacent stickers (barcode + text) = 97mm × 16.9mm
// Page math: 8 + (2 × 97) + 8 = 210mm   ·   4.85 + (17 × 16.9) + 4.85 = 297mm
const STICKER_W_MM = 48.5
const STICKER_H_MM = 16.9
const SLOT_W_MM = STICKER_W_MM * 2   // 97mm per logical record (barcode + text)
const SHEET_TOP_MARGIN_MM = 4.85
const SHEET_LEFT_MARGIN_MM = 8.0
const RECORDS_PER_ROW = 2
const ROWS_PER_PAGE = 17
const RECORDS_PER_PAGE = RECORDS_PER_ROW * ROWS_PER_PAGE  // 34

// ─── All layout in inline styles — mode-agnostic (screen + print identical) ───
// This avoids @media print dependency: printToPDF re-layouts with print CSS,
// but any intermediate screen snapshot would see broken flow if styles were
// CSS-only. Inline styles apply unconditionally in both rendering contexts.

const PAGE_STYLE: React.CSSProperties = {
  position: 'relative',
  width: '210mm',
  height: '297mm',
  overflow: 'hidden',
  background: 'white',
  pageBreakAfter: 'always',
  margin: 0,
  padding: 0,
  boxSizing: 'border-box',
}

const SLOT_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: `${SLOT_W_MM}mm`,
  height: `${STICKER_H_MM}mm`,
  maxHeight: `${STICKER_H_MM}mm`,
  display: 'flex',
  flexDirection: 'row',
  overflow: 'hidden',
  // top/left injected per-slot at render time
}

const BARCODE_CELL_STYLE: React.CSSProperties = {
  width: `${STICKER_W_MM}mm`,
  height: `${STICKER_H_MM}mm`,
  maxHeight: `${STICKER_H_MM}mm`,
  flexShrink: 0,
  overflow: 'hidden',
  padding: '1mm 1.5mm',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  // flex-end pushes the SVG+token group to the bottom of the cell so the
  // token text sits immediately under the bars with no drift from top padding
  justifyContent: 'flex-end',
  gap: '0.3mm',
  boxSizing: 'border-box',
  // Each physical sticker cell gets its own visible outline
  boxShadow: 'inset 0 0 0 0.35mm rgba(30, 30, 100, 0.30)',
}

// Token text beneath barcode SVG
const TOKEN_TEXT_STYLE: React.CSSProperties = {
  margin: 0,
  padding: 0,
  width: '100%',
  fontSize: '6.5pt',
  fontWeight: 'bold',
  fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  color: '#000',
  textAlign: 'center',
  lineHeight: 1,
  letterSpacing: '0.3px',
  maxHeight: '3mm',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
}

const TEXT_CELL_STYLE: React.CSSProperties = {
  width: `${STICKER_W_MM}mm`,
  height: `${STICKER_H_MM}mm`,
  maxHeight: `${STICKER_H_MM}mm`,
  flexShrink: 0,
  overflow: 'hidden',
  padding: '1mm 2mm',
  display: 'flex',
  flexDirection: 'column',
  // space-evenly distributes ~1.55mm between each of the 3 lines and at the edges,
  // which is well above the ~0.3mm threshold PDF readers use to merge adjacent lines.
  justifyContent: 'space-evenly',
  direction: 'rtl',
  textAlign: 'right',
  boxSizing: 'border-box',
  // Matching outline — each physical sticker cell is its own highlighted box
  boxShadow: 'inset 0 0 0 0.35mm rgba(30, 30, 100, 0.30)',
}

const LABEL_NAME_STYLE: React.CSSProperties = {
  margin: 0,   // flex gap handled by space-evenly, not explicit margins
  padding: 0,
  width: '100%',
  fontSize: '7.5pt',
  fontWeight: 'bold',
  fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  color: '#000',
  lineHeight: 1.2,
  maxHeight: '4mm',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const LABEL_META_STYLE: React.CSSProperties = {
  margin: 0,   // flex gap handled by space-evenly, not explicit margins
  padding: 0,
  width: '100%',
  fontSize: '6.5pt',
  fontWeight: 'normal',
  fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  color: '#333',
  lineHeight: 1.2,
  maxHeight: '3.5mm',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

// Scales the react-barcode SVG to exactly 45×11mm via SVG attribute mutation.
//
// react-barcode (jsbarcode) already emits viewBox="0 0 W H" (unitless integers)
// AND width="Wpx" height="Hpx" (with "px" suffix).  The correct strategy is:
//   1. Leave the existing viewBox UNTOUCHED — it is already correct.
//   2. Add preserveAspectRatio so bars scale uniformly when dimensions change.
//   3. Overwrite width/height attrs with "45mm"/"11mm".
// DO NOT re-read width/height and rebuild viewBox — getAttribute('width') returns
// "300px" (with suffix), and setting viewBox="0 0 300px 50px" is invalid SVG,
// which was the root cause of the previous broken-barcode regression.
function ConstrainedBarcode({ value }: { value: string }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const svg = ref.current?.querySelector('svg')
    if (!svg) return
    // react-barcode already set viewBox correctly — do not overwrite it
    // xMidYMax: bars pin to the BOTTOM of the SVG box so they are immediately
    // above the token text with no gap from vertical blank space.
    svg.setAttribute('preserveAspectRatio', 'xMidYMax meet')
    svg.setAttribute('width', '45mm')
    svg.setAttribute('height', '11mm')
  }, [value])
  return (
    <div ref={ref} style={{ width: '45mm', height: '11mm', overflow: 'hidden', flexShrink: 0 }}>
      {/* width={0.7}: ~209px natural width → aspect ratio 4.18:1 ≈ container 4.09:1,
          so bars fill ~10.77mm of the 11mm SVG height (only 0.23mm blank at top) */}
      <Barcode value={value} format="CODE128" displayValue={false} height={50} width={0.7} margin={0} />
    </div>
  )
}
