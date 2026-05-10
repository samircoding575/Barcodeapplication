import { useEffect, useState, useCallback } from 'react'
import type { DashboardData, CandidateResult } from '@shared/types'
import { formatGrade } from '@shared/types'
import { useAppStore } from '../../store/appStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pct(n: number, total: number): string {
  return total > 0 ? `${Math.round((n / total) * 100)}%` : '0%'
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
  value, label, sub, color = 'neutral',
}: { value: string | number; label: string; sub?: string; color?: 'neutral' | 'green' | 'amber' | 'red' | 'purple' }): JSX.Element {
  const colors = {
    neutral: 'text-ink',
    green: 'text-success',
    amber: 'text-warning',
    red: 'text-danger',
    purple: 'text-brand-purple',
  }
  return (
    <div className="bg-paper border border-divider rounded-xl p-5 flex flex-col gap-1 shadow-sm">
      <p className={`text-3xl font-display font-bold ${colors[color]}`}>{value}</p>
      <p className="text-xs font-semibold text-slate uppercase tracking-wide">{label}</p>
      {sub && <p className="text-xs text-slate/60">{sub}</p>}
    </div>
  )
}

// ─── Progress bar ────────────────────────────────────────────────────────────
function ProgressBar({ value, total, label }: { value: number; total: number; label: string }): JSX.Element {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="bg-paper border border-divider rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate uppercase tracking-wide">{label}</span>
        <span className="text-sm font-bold text-ink">{value} / {total} <span className="text-slate font-normal">({percent}%)</span></span>
      </div>
      <div className="h-3 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-purple rounded-full transition-all duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

// ─── Histogram ───────────────────────────────────────────────────────────────
function Histogram({ data, passingGrade }: { data: DashboardData['distribution']; passingGrade: number }): JSX.Element {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="bg-paper border border-divider rounded-xl p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-4">Grade Distribution</p>
      <div className="flex items-end gap-1 h-40">
        {data.map((bucket) => {
          const heightPct = (bucket.count / max) * 100
          const isBelowPass = bucket.to <= passingGrade
          return (
            <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1 group">
              <span className="text-xs text-slate opacity-0 group-hover:opacity-100 transition-opacity">
                {bucket.count}
              </span>
              <div className="w-full rounded-t-sm transition-all duration-500" style={{
                height: `${Math.max(heightPct, bucket.count > 0 ? 4 : 0)}%`,
                backgroundColor: isBelowPass ? '#ef4444' : '#4EA72E',
                opacity: bucket.count === 0 ? 0.2 : 0.85,
              }} />
              <span className="text-[10px] text-slate/60 rotate-45 origin-left mt-1 whitespace-nowrap">{bucket.label}</span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-6">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-success opacity-85" /><span className="text-xs text-slate">Above passing grade</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-danger opacity-85" /><span className="text-xs text-slate">Below passing grade</span></div>
      </div>
    </div>
  )
}

// ─── Donut chart (CSS conic-gradient) ────────────────────────────────────────
function OutcomeDonut({ admitted, eligible, failed, total }: { admitted: number; eligible: number; failed: number; total: number }): JSX.Element {
  const gradedTotal = admitted + eligible + failed
  const a = gradedTotal > 0 ? (admitted / gradedTotal) * 360 : 0
  const e = gradedTotal > 0 ? (eligible / gradedTotal) * 360 : 0
  const f = gradedTotal > 0 ? (failed / gradedTotal) * 360 : 0

  const gradient = `conic-gradient(
    #4EA72E 0deg ${a}deg,
    #f59e0b ${a}deg ${a + e}deg,
    #ef4444 ${a + e}deg ${a + e + f}deg,
    #e5e7eb ${a + e + f}deg 360deg
  )`

  return (
    <div className="bg-paper border border-divider rounded-xl p-5 shadow-sm flex flex-col gap-4 h-full">
      <p className="text-xs font-semibold text-slate uppercase tracking-wide">Outcome Breakdown</p>
      <div className="flex items-center gap-6 mt-auto mb-auto">
        {/* Donut */}
        <div className="relative shrink-0">
          <div className="w-28 h-28 rounded-full" style={{ background: gradient }} />
          <div className="absolute inset-4 rounded-full bg-paper" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-ink">{gradedTotal > 0 ? `${Math.round((admitted / gradedTotal) * 100)}%` : '—'}</span>
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-col gap-2.5 flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-success" />
              <span className="text-sm text-ink font-medium">Admitted</span>
            </div>
            <span className="text-sm font-bold text-ink">{admitted} <span className="text-xs text-slate font-normal">({pct(admitted, gradedTotal)})</span></span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-warning" />
              <span className="text-sm text-ink font-medium">Eligible</span>
            </div>
            <span className="text-sm font-bold text-ink">{eligible} <span className="text-xs text-slate font-normal">({pct(eligible, gradedTotal)})</span></span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-danger" />
              <span className="text-sm text-ink font-medium">Failed</span>
            </div>
            <span className="text-sm font-bold text-ink">{failed} <span className="text-xs text-slate font-normal">({pct(failed, gradedTotal)})</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Outcome badge ────────────────────────────────────────────────────────────
function OutcomeBadge({ outcome }: { outcome: CandidateResult['outcome'] }): JSX.Element {
  const map: Record<CandidateResult['outcome'], { label: string; cls: string }> = {
    admitted: { label: '✓ Admitted', cls: 'bg-emerald-50 text-success border-emerald-200' },
    eligible_not_admitted: { label: '≈ Eligible', cls: 'bg-amber-50 text-warning border-amber-200' },
    failed: { label: '✗ Failed', cls: 'bg-red-50 text-danger border-red-200' },
    ungraded: { label: '— Pending', cls: 'bg-surface text-slate border-divider' },
  }
  const { label, cls } = map[outcome]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  )
}


// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function Dashboard(): JSX.Element {
  const sessions = useAppStore((s) => s.sessions)
  const activeSession = useAppStore((s) => s.activeSession)

  const [viewSessionId, setViewSessionId] = useState(activeSession?.id ?? '')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'distribution' | 'rankings'>('overview')
  const [tableFilter, setTableFilter] = useState<CandidateResult['outcome'] | 'all'>('all')
  const [sortAsc, setSortAsc] = useState(false)

  const viewingSession = sessions.find((s) => s.id === viewSessionId)

  useEffect(() => {
    if (activeSession && !viewSessionId) setViewSessionId(activeSession.id)
  }, [activeSession])

  const loadData = useCallback(async () => {
    if (!viewSessionId) { setData(null); return }
    setLoading(true)
    try {
      const result = await window.api.admin.getDashboardData({ sessionId: viewSessionId })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [viewSessionId])

  useEffect(() => { loadData() }, [loadData])

  const filteredCandidates = (data?.candidates ?? [])
    .filter((c) => tableFilter === 'all' || c.outcome === tableFilter)
    .sort((a, b) => {
      if (a.grade === null && b.grade === null) return 0
      if (a.grade === null) return 1
      if (b.grade === null) return -1
      return sortAsc ? a.grade - b.grade : b.grade - a.grade
    })

  return (
    <div className="p-8 max-w-screen-xl mx-auto flex flex-col min-h-full">
      <PageHeader
        title="Dashboard"
        subtitle={viewingSession
          ? `${viewingSession.title} ${viewingSession.year}${viewingSession.semester ? ` · ${viewingSession.semester}` : ''}`
          : 'Select a session to view analytics'}
        actions={
          <div className="flex gap-3">
            <select
              className="input-base py-2 text-sm max-w-[240px]"
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
            <Button variant="secondary" onClick={loadData} loading={loading}>Refresh</Button>
          </div>
        }
      />

      {!viewSessionId ? (
        <EmptyState
          title="Select a session"
          description="Choose an exam session above to view its analytics dashboard."
        />
      ) : loading && !data ? (
        <div className="flex items-center justify-center py-32 text-slate animate-pulse">Loading analytics…</div>
      ) : data ? (
        <div className="flex flex-col gap-6 animate-fade-in flex-1">
          
          {/* ── Tab Navigation ── */}
          <div className="flex border-b border-divider gap-8">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`pb-3 text-sm font-semibold transition-colors ${activeTab === 'overview' ? 'border-b-2 border-brand-purple text-ink' : 'text-slate hover:text-ink'}`}
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab('distribution')}
              className={`pb-3 text-sm font-semibold transition-colors ${activeTab === 'distribution' ? 'border-b-2 border-brand-purple text-ink' : 'text-slate hover:text-ink'}`}
            >
              Grade Distribution
            </button>
            <button 
              onClick={() => setActiveTab('rankings')}
              className={`pb-3 text-sm font-semibold transition-colors ${activeTab === 'rankings' ? 'border-b-2 border-brand-purple text-ink' : 'text-slate hover:text-ink'}`}
            >
              Rankings
            </button>
          </div>

          {/* ── Overview Tab ── */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div className="grid grid-cols-4 gap-4">
                <KpiCard value={data.totalCandidates} label="Total Candidates" />
                <KpiCard value={`${data.passRate}%`} label="Admission Rate" color="green" />
                <KpiCard value={data.gradedCount} label="Graded" color="purple" sub={`${data.ungradedCount} pending`} />
                <KpiCard value={data.admittedCount} label="Admitted" color="green" />
              </div>

              <div className="grid grid-cols-[1fr_400px] gap-5 mt-2">
                <div className="flex flex-col justify-center gap-5">
                  <ProgressBar value={data.gradedCount} total={data.totalCandidates} label="Grading Progress" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
                      <p className="text-3xl font-display font-bold text-warning">{data.eligibleNotAdmittedCount}</p>
                      <p className="text-xs font-semibold text-slate uppercase tracking-wide mt-1">≈ Eligible, Not Admitted</p>
                      <p className="text-xs text-slate/60 mt-0.5">Passed but below quota</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
                      <p className="text-3xl font-display font-bold text-danger">{data.failedCount}</p>
                      <p className="text-xs font-semibold text-slate uppercase tracking-wide mt-1">✗ Failed</p>
                      <p className="text-xs text-slate/60 mt-0.5">Below passing grade</p>
                    </div>
                  </div>
                </div>
                <OutcomeDonut
                  admitted={data.admittedCount}
                  eligible={data.eligibleNotAdmittedCount}
                  failed={data.failedCount}
                  total={data.totalCandidates}
                />
              </div>
            </div>
          )}

          {/* ── Distribution Tab ── */}
          {activeTab === 'distribution' && (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div className="grid grid-cols-5 gap-4">
                <KpiCard value={data.avgGrade !== null ? formatGrade(data.avgGrade) : '—'} label="Average Grade" color="purple" />
                <KpiCard value={data.medianGrade !== null ? formatGrade(data.medianGrade) : '—'} label="Median Grade" />
                <KpiCard value={data.highestGrade !== null ? formatGrade(data.highestGrade) : '—'} label="Highest Grade" color="green" />
                <KpiCard value={data.lowestGrade !== null ? formatGrade(data.lowestGrade) : '—'} label="Lowest Grade" color="red" />
                <KpiCard value={data.stdDev !== null ? formatGrade(data.stdDev) : '—'} label="Std. Deviation" />
              </div>
              
              <Histogram data={data.distribution} passingGrade={viewingSession?.passingGrade ?? 1000} />
            </div>
          )}

          {/* ── Rankings Tab ── */}
          {activeTab === 'rankings' && (
            <div className="bg-paper border border-divider rounded-2xl shadow-card overflow-hidden animate-fade-in flex flex-col flex-1">
              <div className="px-5 py-4 border-b border-divider flex items-center justify-between bg-surface shrink-0">
                <p className="text-sm font-semibold text-ink">Candidate Rankings</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate">Filter:</span>
                  {(['all', 'admitted', 'eligible_not_admitted', 'failed', 'ungraded'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setTableFilter(f)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                        tableFilter === f
                          ? 'bg-brand-purple text-white'
                          : 'bg-paper text-slate border border-divider hover:bg-surface'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'admitted' ? 'Admitted' : f === 'eligible_not_admitted' ? 'Eligible' : f === 'failed' ? 'Failed' : 'Pending'}
                    </button>
                  ))}
                  <button
                    onClick={() => setSortAsc((v) => !v)}
                    className="ml-2 px-2.5 py-1 rounded-md text-xs font-semibold bg-paper border border-divider text-slate hover:bg-surface transition-colors"
                  >
                    Grade {sortAsc ? '↑' : '↓'}
                  </button>
                </div>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="bg-surface border-b border-divider sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide w-16">Rank</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Candidate ID</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Name</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Grade</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-slate text-sm">No candidates match this filter.</td>
                      </tr>
                    ) : filteredCandidates.map((c, i) => (
                      <tr
                        key={c.token}
                        className={`border-b border-divider/60 transition-colors duration-100 ${
                          c.outcome === 'admitted' ? 'bg-emerald-50/30 hover:bg-emerald-50/60' :
                          c.outcome === 'eligible_not_admitted' ? 'bg-amber-50/30 hover:bg-amber-50/60' :
                          c.outcome === 'failed' ? 'bg-red-50/20 hover:bg-red-50/40' :
                          i % 2 === 0 ? 'bg-paper hover:bg-surface' : 'bg-surface/40 hover:bg-surface'
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-slate">
                          {c.rank !== null ? `#${c.rank}` : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate">{c.externalId}</td>
                        <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                        <td className="px-4 py-3 text-right font-display font-bold text-base">
                          {c.grade !== null ? (
                            <span className={
                              c.outcome === 'admitted' ? 'text-success' :
                              c.outcome === 'eligible_not_admitted' ? 'text-warning' :
                              'text-danger'
                            }>
                              {formatGrade(c.grade)}
                            </span>
                          ) : <span className="text-slate font-normal text-sm">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <OutcomeBadge outcome={c.outcome} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-surface border-t border-divider text-xs text-slate shrink-0">
                Showing {filteredCandidates.length} of {data.candidates.length} candidates
              </div>
            </div>
          )}

        </div>
      ) : null}
    </div>
  )
}
