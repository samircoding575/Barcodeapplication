import { useState, useEffect } from 'react'
import type { Exam } from '@shared/types'
import { formatGrade } from '@shared/types'
import { useAppStore } from '../../store/appStore'
import { useIsAdmin } from '../../store/appStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'

const DEFAULT_EXAM_NAMES = ['Civil Law', 'Criminal Law', 'Commercial Law', 'Administrative Law']

export function Sessions(): JSX.Element {
  const sessions = useAppStore((s) => s.sessions)
  const activeSession = useAppStore((s) => s.activeSession)
  const createSession = useAppStore((s) => s.createSession)
  const deleteSession = useAppStore((s) => s.deleteSession)
  const setActiveSession = useAppStore((s) => s.setActiveSession)
  const loadSessions = useAppStore((s) => s.loadSessions)
  const isPrimaryAdmin = useIsAdmin()

  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [semester, setSemester] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [sessionExams, setSessionExams] = useState<Record<string, Exam[]>>({})
  const [examLoading, setExamLoading] = useState<string | null>(null)

  // Exam creation form state
  const [addingExamForSession, setAddingExamForSession] = useState<string | null>(null)
  const [examName, setExamName] = useState('')
  const [examMaxGrade, setExamMaxGrade] = useState(20)
  const [examStep, setExamStep] = useState('0.25')
  const [examPassingGrade, setExamPassingGrade] = useState(10)
  const [examMaxPassCount, setExamMaxPassCount] = useState('')
  const [examError, setExamError] = useState('')
  const [examSaving, setExamSaving] = useState(false)

  // Exam editing state
  const [editingExamId, setEditingExamId] = useState<string | null>(null)
  const [editExamName, setEditExamName] = useState('')
  const [editExamMaxGrade, setEditExamMaxGrade] = useState(20)
  const [editExamStep, setEditExamStep] = useState('0.25')
  const [editExamPassingGrade, setEditExamPassingGrade] = useState(10)
  const [editExamMaxPassCount, setEditExamMaxPassCount] = useState('')
  const [editExamError, setEditExamError] = useState('')
  const [editExamSaving, setEditExamSaving] = useState(false)

  async function loadExams(sessionId: string): Promise<void> {
    setExamLoading(sessionId)
    const exams = await window.api.exam.list({ sessionId })
    setSessionExams((prev) => ({ ...prev, [sessionId]: exams }))
    setExamLoading(null)
    // Also refresh sessions store so store.exams is up to date
    await loadSessions()
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setLoading(true)
    setError('')
    const res = await createSession({ title: title.trim(), year, semester: semester.trim() || null })
    if (res.success) {
      setIsCreating(false)
      setTitle('')
      setSemester('')
      setYear(new Date().getFullYear())
    } else {
      setError(res.error ?? 'Failed to create session')
    }
    setLoading(false)
  }

  async function handleDelete(id: string, name: string): Promise<void> {
    if (!confirm(`Delete session "${name}"? All exams, barcodes, and grades will be permanently removed.`)) return
    await deleteSession(id)
  }

  async function handleCreateExam(sessionId: string): Promise<void> {
    if (!examName.trim()) { setExamError('Name is required'); return }
    const exams = sessionExams[sessionId] ?? []
    if (exams.length >= 4) { setExamError('Maximum 4 exams per session'); return }
    setExamSaving(true)
    setExamError('')
    const res = await window.api.exam.create({
      sessionId,
      name: examName.trim(),
      order: exams.length,
      maxGrade: Math.round(examMaxGrade * 100),
      step: examStep,
      passingGrade: Math.round(examPassingGrade * 100),
      maxPassCount: examMaxPassCount.trim() ? parseInt(examMaxPassCount) : null,
    })
    setExamSaving(false)
    if (res.success) {
      setAddingExamForSession(null)
      setExamName('')
      setExamMaxGrade(20)
      setExamStep('0.25')
      setExamPassingGrade(10)
      setExamMaxPassCount('')
      await loadExams(sessionId)
    } else {
      setExamError(res.error ?? 'Failed to create exam')
    }
  }

  function startEditExam(exam: Exam): void {
    setEditingExamId(exam.id)
    setEditExamName(exam.name)
    setEditExamMaxGrade(exam.maxGrade / 100)
    setEditExamStep(exam.step)
    setEditExamPassingGrade(exam.passingGrade / 100)
    setEditExamMaxPassCount(exam.maxPassCount !== null ? exam.maxPassCount.toString() : '')
    setEditExamError('')
  }

  async function handleSaveExam(exam: Exam, sessionId: string): Promise<void> {
    const pgVal = Math.round(parseFloat(editExamPassingGrade.toString()) * 100)
    const mgVal = Math.round(editExamMaxGrade * 100)
    if (isNaN(pgVal) || pgVal < 0 || pgVal > mgVal) { setEditExamError('Invalid passing grade'); return }
    setEditExamSaving(true)
    setEditExamError('')
    const res = await window.api.exam.update({
      examId: exam.id,
      name: editExamName.trim() || exam.name,
      maxGrade: mgVal,
      step: editExamStep,
      passingGrade: pgVal,
      maxPassCount: editExamMaxPassCount.trim() ? parseInt(editExamMaxPassCount) : null,
    })
    setEditExamSaving(false)
    if (res.success) {
      setEditingExamId(null)
      await loadExams(sessionId)
    } else {
      setEditExamError(res.error ?? 'Failed to update exam')
    }
  }

  async function handleDeleteExam(examId: string, examName: string, sessionId: string): Promise<void> {
    if (!confirm(`Delete exam "${examName}"? All barcodes and grades for this exam will be removed.`)) return
    await window.api.exam.delete({ examId })
    await loadExams(sessionId)
  }

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      <PageHeader
        title="Exam Sessions"
        subtitle="Manage grading periods. Each session contains up to 4 exams with individual scoring rules."
        actions={
          isPrimaryAdmin ? (
            <Button onClick={() => setIsCreating(!isCreating)}>
              {isCreating ? 'Cancel' : '+ Create Session'}
            </Button>
          ) : undefined
        }
      />

      {isCreating && (
        <Card className="mb-6 animate-fade-in">
          <CardHeader><p className="font-semibold text-sm text-ink">New Session</p></CardHeader>
          <CardBody>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">Session Title</label>
                  <input className="input-base" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Bar Exam 2026" autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">Year</label>
                  <input type="number" className="input-base" value={year} onChange={e => setYear(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">Semester (Optional)</label>
                <input className="input-base" value={semester} onChange={e => setSemester(e.target.value)} placeholder="e.g. Fall" />
              </div>
              {error && <p className="text-danger text-sm">{error}</p>}
              <div className="flex justify-end">
                <Button type="submit" loading={loading}>Save Session</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {sessions.length === 0 ? (
        <EmptyState title="No sessions created" description="Create an exam session to start configuring exams." />
      ) : (
        <div className="grid gap-4">
          {sessions.map(s => {
            const exams = sessionExams[s.id] ?? s.exams ?? []
            const isExpanded = expandedSessionId === s.id
            return (
              <Card key={s.id} className={s.id === activeSession?.id ? 'border-accent shadow-md' : ''}>
                <CardBody className="flex flex-col p-5">
                  {/* Session header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-display font-semibold text-lg text-ink">{s.title}</h3>
                        {s.id === activeSession?.id && <Badge variant="success">Active</Badge>}
                        <Badge variant="neutral">{exams.length} exam{exams.length !== 1 ? 's' : ''}</Badge>
                      </div>
                      <p className="text-slate text-sm">
                        {s.year}{s.semester && ` · ${s.semester}`} · Created {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {isPrimaryAdmin && s.id !== activeSession?.id && (
                        <Button variant="secondary" onClick={() => setActiveSession(s.id)}>Set Active</Button>
                      )}
                      <button
                        onClick={async () => {
                          const next = isExpanded ? null : s.id
                          setExpandedSessionId(next)
                          if (next) await loadExams(next)
                        }}
                        className="text-xs text-slate hover:text-ink font-semibold transition-colors px-3 py-2 rounded hover:bg-surface border border-transparent hover:border-divider"
                      >
                        {isExpanded ? 'Hide Exams ▲' : 'Manage Exams ▼'}
                      </button>
                      {isPrimaryAdmin && (
                        <button
                          onClick={() => handleDelete(s.id, s.title)}
                          className="text-xs text-danger hover:text-red-800 transition-colors px-3 py-2 rounded hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Exams sub-panel */}
                  {isExpanded && (
                    <div className="mt-5 pt-5 border-t border-divider animate-fade-in">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-ink">Exams</h4>
                        {isPrimaryAdmin && exams.length < 4 && addingExamForSession !== s.id && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setAddingExamForSession(s.id)
                              setExamName(DEFAULT_EXAM_NAMES[exams.length] ?? '')
                              setExamError('')
                            }}
                          >
                            + Add Exam
                          </Button>
                        )}
                      </div>

                      {examLoading === s.id ? (
                        <p className="text-slate text-sm py-2">Loading…</p>
                      ) : exams.length === 0 && addingExamForSession !== s.id ? (
                        <p className="text-slate text-sm py-2">No exams yet. Add up to 4 exams for this session.</p>
                      ) : (
                        <div className="grid gap-3">
                          {exams.map((exam) => (
                            <div key={exam.id} className="bg-surface rounded-xl p-4 border border-divider">
                              {editingExamId === exam.id ? (
                                <div className="flex flex-col gap-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1">Name</label>
                                      <input className="input-base" value={editExamName} onChange={e => setEditExamName(e.target.value)} />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1">Step</label>
                                      <select className="input-base" value={editExamStep} onChange={e => setEditExamStep(e.target.value)}>
                                        <option value="1">Whole (1, 2…)</option>
                                        <option value="0.5">Half (0.5, 1.0…)</option>
                                        <option value="0.25">Quarter (0.25, 0.5…)</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1">Max Grade</label>
                                      <input type="number" className="input-base" value={editExamMaxGrade} min={1} max={1000} onChange={e => setEditExamMaxGrade(Number(e.target.value))} />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1">Passing Grade</label>
                                      <input type="number" className="input-base" value={editExamPassingGrade} min={0} max={editExamMaxGrade} step={0.25} onChange={e => setEditExamPassingGrade(Number(e.target.value))} />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1">Max Admits <span className="normal-case font-normal text-slate/60">(blank = no limit)</span></label>
                                      <input type="number" className="input-base" value={editExamMaxPassCount} min={1} placeholder="No limit" onChange={e => setEditExamMaxPassCount(e.target.value)} />
                                    </div>
                                  </div>
                                  {editExamError && <p className="text-danger text-xs">{editExamError}</p>}
                                  <div className="flex gap-2 justify-end">
                                    <Button size="sm" variant="secondary" onClick={() => setEditingExamId(null)}>Cancel</Button>
                                    <Button size="sm" loading={editExamSaving} onClick={() => handleSaveExam(exam, s.id)}>Save</Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-sm text-ink">{exam.name}</p>
                                    <p className="text-xs text-slate mt-0.5">
                                      0 – {formatGrade(exam.maxGrade)} · Pass ≥ {formatGrade(exam.passingGrade)} · Step {exam.step}
                                      {exam.maxPassCount !== null ? ` · Max admits: ${exam.maxPassCount}` : ''}
                                    </p>
                                  </div>
                                  {isPrimaryAdmin && (
                                    <div className="flex gap-2">
                                      <button onClick={() => startEditExam(exam)} className="text-xs text-slate hover:text-ink font-semibold transition-colors px-2 py-1 rounded hover:bg-paper">Edit</button>
                                      <button onClick={() => handleDeleteExam(exam.id, exam.name, s.id)} className="text-xs text-danger hover:text-red-800 transition-colors px-2 py-1 rounded hover:bg-red-50">Delete</button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add exam form */}
                      {addingExamForSession === s.id && (
                        <div className="mt-3 bg-paper rounded-xl p-4 border border-divider animate-fade-in">
                          <p className="font-semibold text-xs text-slate uppercase tracking-wide mb-3">New Exam</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1">Name</label>
                              <input className="input-base" value={examName} onChange={e => setExamName(e.target.value)} placeholder="e.g. Civil Law" autoFocus />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1">Step</label>
                              <select className="input-base" value={examStep} onChange={e => setExamStep(e.target.value)}>
                                <option value="1">Whole (1, 2…)</option>
                                <option value="0.5">Half (0.5, 1.0…)</option>
                                <option value="0.25">Quarter (0.25, 0.5…)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1">Max Grade</label>
                              <input type="number" className="input-base" value={examMaxGrade} min={1} max={1000} onChange={e => setExamMaxGrade(Number(e.target.value))} />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1">Passing Grade</label>
                              <input type="number" className="input-base" value={examPassingGrade} min={0} max={examMaxGrade} step={0.25} onChange={e => setExamPassingGrade(Number(e.target.value))} />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1">Max Admits <span className="normal-case font-normal text-slate/60">(blank = no limit)</span></label>
                              <input type="number" className="input-base" value={examMaxPassCount} min={1} placeholder="No limit" onChange={e => setExamMaxPassCount(e.target.value)} />
                            </div>
                          </div>
                          {examError && <p className="text-danger text-xs mt-2">{examError}</p>}
                          <div className="flex gap-2 justify-end mt-3">
                            <Button size="sm" variant="secondary" onClick={() => { setAddingExamForSession(null); setExamError('') }}>Cancel</Button>
                            <Button size="sm" loading={examSaving} onClick={() => handleCreateExam(s.id)}>Add Exam</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
