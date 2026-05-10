import { useEffect, useRef, useState } from 'react'
import type { ImportPreview, ValidatedRow, RowStatus } from '@shared/types'
import { formatGrade } from '@shared/types'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'

const STATUS_LABELS: Record<RowStatus, string> = {
  ok: 'OK',
  unknown_token: 'Unknown token',
  already_graded: 'Already graded',
  invalid_grade: 'Invalid grade',
  duplicate_in_file: 'Duplicate',
}

const STATUS_VARIANT: Record<RowStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ok: 'success',
  unknown_token: 'danger',
  already_graded: 'warning',
  invalid_grade: 'danger',
  duplicate_in_file: 'danger',
}

export function Import(): JSX.Element {
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [selectedRow, setSelectedRow] = useState<number>(0)
  const [overwriteConflicts, setOverwriteConflicts] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [committed, setCommitted] = useState<number | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!preview) return

    function onKeyDown(e: KeyboardEvent): void {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'SELECT' || tag === 'BUTTON') return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedRow((r) => Math.min(r + 1, (preview?.rows.length ?? 1) - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedRow((r) => Math.max(r - 1, 0))
      } else if (e.key === 'a' || e.key === 'A') {
        handleCommit(['ok'])
      } else if (e.key === 'o' || e.key === 'O') {
        setOverwriteConflicts((v) => !v)
      } else if (e.key === 'Enter') {
        handleCommit(overwriteConflicts ? ['ok', 'already_graded'] : ['ok'])
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        openFile()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [preview, overwriteConflicts])

  async function openFile(): Promise<void> {
    setLoading(true)
    setCommitted(null)
    try {
      const result = await window.api.teacher.importPreview()
      if (result) {
        setPreview(result)
        setSelectedRow(0)
        setTimeout(() => tableRef.current?.focus(), 100)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCommit(acceptedStatuses: RowStatus[]): Promise<void> {
    if (!preview) return
    const result = await window.api.teacher.importCommit({ rows: preview.rows, acceptedStatuses })
    setCommitted(result.committed)
    setPreview(null)
  }

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      <PageHeader
        title="Dynamic Import"
        subtitle="Batch-import grades from a CSV or Excel file mapped to barcode tokens."
        actions={
          <Button onClick={openFile} loading={loading}>
            Open File (Ctrl+O)
          </Button>
        }
      />

      {committed !== null && (
        <div className="mb-5 px-4 py-3 bg-emerald-50 text-success border border-emerald-200 rounded-xl font-medium text-sm animate-fade-in">
          Committed {committed} grade{committed !== 1 ? 's' : ''} successfully.
        </div>
      )}

      {!preview && !loading && committed === null && (
        <EmptyState
          title="No file loaded"
          description='Press Ctrl+O or click "Open File" to load a CSV/Excel with columns: token, grade'
          action={<Button variant="secondary" onClick={openFile}>Open File</Button>}
        />
      )}

      {preview && (
        <>
          {/* Summary chips */}
          <div className="flex gap-3 mb-4">
            <SummaryChip count={preview.summary.ok} label="OK" variant="success" />
            <SummaryChip count={preview.summary.conflicts} label="Conflicts" variant="warning" />
            <SummaryChip count={preview.summary.errors} label="Errors" variant="danger" />
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-slate">
              <input
                type="checkbox"
                checked={overwriteConflicts}
                onChange={(e) => setOverwriteConflicts(e.target.checked)}
                className="rounded border-divider"
              />
              Overwrite conflicts <kbd className="text-xs bg-surface border border-divider rounded px-1 ml-1">O</kbd>
            </label>
            <Button onClick={() => handleCommit(overwriteConflicts ? ['ok', 'already_graded'] : ['ok'])}>
              Commit <kbd className="text-xs opacity-60 ml-1">Enter</kbd>
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
            <span className="text-xs text-slate/60 ml-1">↑↓ navigate · A accept OK</span>
          </div>

          {/* Diff table */}
          <div
            ref={tableRef}
            tabIndex={0}
            className="bg-paper rounded-2xl border border-divider shadow-card overflow-auto focus:outline-none"
            style={{ maxHeight: '60vh' }}
          >
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-divider sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Token</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Proposed</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Current</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Message</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelectedRow(i)}
                    className={`border-b border-divider/60 cursor-pointer transition-colors duration-100 ${
                      i === selectedRow ? 'bg-accent-50 border-l-2 border-brand-purple' : i % 2 === 0 ? 'bg-paper hover:bg-surface' : 'bg-surface/60 hover:bg-surface'
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-slate truncate max-w-[140px]">
                      {row.token.slice(-8)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold font-display text-ink">
                      {formatGrade(row.proposedValue)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate">
                      {row.currentValue != null ? formatGrade(row.currentValue) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate/60">{row.message ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryChip({
  count, label, variant,
}: { count: number; label: string; variant: 'success' | 'warning' | 'danger' }): JSX.Element {
  const colors = {
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
    danger: 'bg-red-50 border-red-200',
  }
  const text = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }
  return (
    <div className={`px-4 py-2 rounded-xl border text-sm ${colors[variant]}`}>
      <span className={`font-semibold font-display ${text[variant]}`}>{count}</span>
      <span className={`ml-1.5 ${text[variant]}`}>{label}</span>
    </div>
  )
}
