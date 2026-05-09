import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { TeacherProgressItem } from '@shared/types'
import { formatGrade, parseGradeInput, MIN_GRADE_HUNDREDTHS, MAX_GRADE_HUNDREDTHS } from '@shared/types'
import { useAppStore } from '../../store/appStore'
import { StatusDot } from '../../components/ui/StatusDot'
import { EmptyState } from '../../components/ui/EmptyState'

interface TokenState {
  valid: boolean
  alreadyGraded: boolean
  currentGrade?: number | null
}

type SidebarFilter = 'all' | 'pending' | 'graded'

export function Grade(): JSX.Element {
  const activeSession = useAppStore((s) => s.activeSession)

  if (!activeSession) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <EmptyState
          title="No active session"
          description="Ask the administrator to create and activate an exam session before grading can begin."
        />
      </div>
    )
  }

  return <GradePanel />
}

function GradePanel(): JSX.Element {
  // Progress list state
  const [progress, setProgress] = useState<TeacherProgressItem[]>([])
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>('all')
  const [sidebarSelected, setSidebarSelected] = useState<number>(0)
  const [pulsedToken, setPulsedToken] = useState<string | null>(null)

  // Grading form state
  const [token, setToken] = useState('')
  const [gradeInput, setGradeInput] = useState('')
  const [tokenState, setTokenState] = useState<TokenState | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [decimalMode, setDecimalMode] = useState(false)

  const scanRef = useRef<HTMLInputElement>(null)
  const gradeRef = useRef<HTMLInputElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scanRef.current?.focus()
    loadProgress()
  }, [])

  async function loadProgress(): Promise<void> {
    const items = await window.api.teacher.listProgress()
    setProgress(items)
  }

  const filtered = useMemo(() => {
    if (sidebarFilter === 'graded') return progress.filter((p) => p.graded)
    if (sidebarFilter === 'pending') return progress.filter((p) => !p.graded)
    return progress
  }, [progress, sidebarFilter])

  const gradedCount = progress.filter((p) => p.graded).length
  const progressPct = progress.length > 0 ? Math.round((gradedCount / progress.length) * 100) : 0

  // Sidebar keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === '1') { setSidebarFilter('all'); setSidebarSelected(0) }
      else if (e.key === '2') { setSidebarFilter('pending'); setSidebarSelected(0) }
      else if (e.key === '3') { setSidebarFilter('graded'); setSidebarSelected(0) }
      else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSidebarSelected((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSidebarSelected((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && document.activeElement === sidebarRef.current) {
        const item = filtered[sidebarSelected]
        if (item) handleSelectToken(item.token)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filtered, sidebarSelected])

  const reset = useCallback(() => {
    setToken('')
    setGradeInput('')
    setTokenState(null)
    setFeedback(null)
    setTimeout(() => scanRef.current?.focus(), 50)
  }, [])

  async function handleSelectToken(t: string): Promise<void> {
    setToken(t)
    setTokenState(null)
    setFeedback(null)
    const res = await window.api.teacher.lookupToken({ token: t })
    setTokenState({
      valid: res.valid,
      alreadyGraded: res.alreadyGraded ?? false,
      currentGrade: res.currentGrade,
    })
    if (res.valid) {
      if (res.alreadyGraded && res.currentGrade != null) setGradeInput(formatGrade(res.currentGrade))
      setTimeout(() => { gradeRef.current?.focus(); gradeRef.current?.select() }, 50)
    }
  }

  async function lookupToken(t: string): Promise<void> {
    if (!t) return
    await handleSelectToken(t)
  }

  function handleScanKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') { e.preventDefault(); lookupToken(token) }
    if (e.key === 'Escape') reset()
    if (e.key === 'F2') setDecimalMode((m) => !m)
  }

  function handleGradeKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
    if (e.key === 'Escape') reset()
    if (e.key === 'F2') setDecimalMode((m) => !m)
  }

  async function handleUndo(): Promise<void> {
    const res = await window.api.teacher.undoLast()
    if (res.success) {
      setFeedback({ type: 'success', msg: `Undid grade for …${res.token?.slice(-6) ?? ''}` })
      await loadProgress()
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!token || !gradeInput || !tokenState?.valid) return
    const value = parseGradeInput(gradeInput)
    if (isNaN(value)) { setFeedback({ type: 'error', msg: 'Invalid grade' }); return }

    const res = await window.api.teacher.saveGrade({ token, value })
    if (res.success) {
      const savedToken = token
      setFeedback({ type: 'success', msg: 'Saved ✓' })
      setPulsedToken(savedToken)
      await loadProgress()
      setTimeout(() => setPulsedToken(null), 700)
      setTimeout(() => reset(), 800)
    } else {
      setFeedback({ type: 'error', msg: res.error ?? 'Save failed' })
    }
  }

  const maskedScan = token ? `••••${token.slice(-6)}` : ''

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 shrink-0 border-r border-divider bg-paper flex flex-col">
        {/* Progress header */}
        <div className="px-4 py-4 border-b border-divider">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate uppercase tracking-wide">Progress</span>
            <span className="text-xs font-mono text-ink">{gradedCount} / {progress.length}</span>
          </div>
          <div className="h-1.5 bg-divider rounded-full overflow-hidden">
            <div
              className="h-full bg-gold rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-slate mt-1">{progressPct}% complete</p>
        </div>

        {/* Filter chips */}
        <div className="px-3 pt-3 pb-2 flex gap-1">
          {(['all', 'pending', 'graded'] as SidebarFilter[]).map((f, i) => (
            <button
              key={f}
              onClick={() => { setSidebarFilter(f); setSidebarSelected(0) }}
              className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-colors duration-150 ${
                sidebarFilter === f ? 'bg-navy text-white' : 'bg-surface text-slate hover:bg-divider'
              }`}
              title={`${i + 1} key`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Token list */}
        <div
          ref={sidebarRef}
          tabIndex={0}
          className="flex-1 overflow-y-auto focus:outline-none"
          aria-label="Token list — use ↑↓ to navigate, Enter to select"
        >
          {filtered.length === 0 ? (
            <p className="text-xs text-slate text-center mt-8 px-4">No tokens match.</p>
          ) : (
            filtered.map((item, i) => {
              const masked = `••••${item.token.slice(-6)}`
              const isActive = i === sidebarSelected
              const isPulsed = item.token === pulsedToken
              return (
                <button
                  key={item.token}
                  onClick={() => { setSidebarSelected(i); handleSelectToken(item.token) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 ${
                    isPulsed ? 'animate-pulse-success' : ''
                  } ${
                    isActive
                      ? 'bg-navy/8 border-l-2 border-gold'
                      : 'hover:bg-surface border-l-2 border-transparent'
                  }`}
                >
                  <StatusDot status={item.graded ? 'graded' : 'pending'} />
                  <span className="font-mono text-xs text-ink">{masked}</span>
                  <span className={`ml-auto text-xs ${item.graded ? 'text-success' : 'text-slate/50'}`}>
                    {item.graded ? 'graded' : ''}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Detail / grading panel */}
      <div className="flex-1 flex items-start justify-center pt-10 px-6">
        <div className="w-full max-w-md">
          <div className="bg-paper rounded-2xl shadow-card border border-divider overflow-hidden">
            {/* Header */}
            <div className="bg-navy px-6 py-4">
              <h2 className="text-white font-display font-semibold text-lg">Grade Entry</h2>
              <p className="text-white/50 text-xs mt-0.5">
                {decimalMode ? 'Decimal mode' : 'Integer mode'} · F2 to toggle
              </p>
            </div>

            <div className="p-6">
              {/* Token input */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">
                  Barcode Token <span className="normal-case font-normal text-slate/60">(scan or type · Enter to look up)</span>
                </label>
                <input
                  ref={scanRef}
                  type="text"
                  className="input-base font-mono"
                  value={token}
                  onChange={(e) => { setToken(e.target.value); setTokenState(null) }}
                  onKeyDown={handleScanKeyDown}
                  placeholder="Scan barcode or type token…"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  tabIndex={1}
                />
                {tokenState && (
                  <p className={`text-xs mt-1.5 font-medium ${tokenState.valid ? 'text-success' : 'text-danger'}`}>
                    {tokenState.valid
                      ? tokenState.alreadyGraded
                        ? `⚠ Already graded (${formatGrade(tokenState.currentGrade ?? 0)}) — will overwrite`
                        : '✓ Valid token'
                      : '✗ Token not found'}
                  </p>
                )}
              </div>

              {/* Grade input */}
              {tokenState?.valid && (
                <div className="mb-5 animate-fade-in">
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">
                    Grade <span className="normal-case font-normal text-slate/60">({formatGrade(MIN_GRADE_HUNDREDTHS)} – {formatGrade(MAX_GRADE_HUNDREDTHS)})</span>
                  </label>
                  <input
                    ref={gradeRef}
                    type="number"
                    className="w-full border border-divider rounded-xl px-4 py-3 text-4xl font-display font-semibold text-center text-navy focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none transition-colors duration-150"
                    value={gradeInput}
                    onChange={(e) => setGradeInput(e.target.value)}
                    onKeyDown={handleGradeKeyDown}
                    min={MIN_GRADE_HUNDREDTHS / 100}
                    max={MAX_GRADE_HUNDREDTHS / 100}
                    step={decimalMode ? 0.25 : 1}
                    placeholder={decimalMode ? '0.00' : '0'}
                    tabIndex={2}
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={!token || !tokenState?.valid || !gradeInput}
                  className="flex-1 py-3 bg-navy text-white rounded-xl font-semibold text-sm hover:bg-navy-dark disabled:opacity-40 transition-colors duration-150"
                  tabIndex={3}
                >
                  Submit (Enter)
                </button>
                <button
                  onClick={handleUndo}
                  className="px-4 py-3 bg-surface text-slate rounded-xl hover:bg-divider transition-colors duration-150 text-sm border border-divider"
                  title="Undo last grade"
                  tabIndex={4}
                >
                  Undo
                </button>
              </div>

              {feedback && (
                <div
                  className={`mt-4 p-3 rounded-xl text-sm text-center font-medium animate-fade-in ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 text-success border border-emerald-200'
                      : 'bg-red-50 text-danger border border-red-200'
                  }`}
                  aria-live="polite"
                >
                  {feedback.msg}
                </div>
              )}

              {maskedScan && tokenState?.valid && (
                <p className="text-center text-xs text-slate/40 mt-3 font-mono">{maskedScan}</p>
              )}

              <p className="text-center text-xs text-slate/40 mt-2">
                ESC reset · F2 decimal · 1/2/3 filter sidebar · ↑↓ navigate list
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
