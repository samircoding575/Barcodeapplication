import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatGrade } from '@shared/types'

export function Sessions(): JSX.Element {
  const sessions = useAppStore((s) => s.sessions)
  const activeSession = useAppStore((s) => s.activeSession)
  const createSession = useAppStore((s) => s.createSession)
  const deleteSession = useAppStore((s) => s.deleteSession)
  const setActiveSession = useAppStore((s) => s.setActiveSession)
  const loadSessions = useAppStore((s) => s.loadSessions)

  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [semester, setSemester] = useState('')
  const [maxGrade, setMaxGrade] = useState(20)
  const [step, setStep] = useState('0.25')
  const [passingGrade, setPassingGrade] = useState(10)
  const [maxPassCount, setMaxPassCount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editPassingGrade, setEditPassingGrade] = useState('')
  const [editMaxPassCount, setEditMaxPassCount] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setLoading(true)
    setError('')
    const res = await createSession({
      title: title.trim(),
      year,
      semester: semester.trim() || null,
      maxGrade: Math.round(maxGrade * 100),
      step,
      passingGrade: Math.round(passingGrade * 100),
      maxPassCount: maxPassCount.trim() ? parseInt(maxPassCount) : null,
    })
    if (res.success) {
      setIsCreating(false)
      setTitle('')
      setSemester('')
      setYear(new Date().getFullYear())
      setMaxGrade(20)
      setStep('0.25')
      setPassingGrade(10)
      setMaxPassCount('')
    } else {
      setError(res.error ?? 'Failed to create session')
    }
    setLoading(false)
  }

  async function handleDelete(id: string, name: string): Promise<void> {
    if (!confirm(`Are you sure you want to delete the session "${name}"? All associated barcodes and grades will be permanently deleted.`)) return
    await deleteSession(id)
  }

  function startEditing(session: typeof sessions[0]) {
    setEditingSessionId(session.id)
    setEditPassingGrade((session.passingGrade / 100).toString())
    setEditMaxPassCount(session.maxPassCount !== null ? session.maxPassCount.toString() : '')
    setEditError('')
  }

  function cancelEditing() {
    setEditingSessionId(null)
    setEditError('')
  }

  async function handleSaveEdit(session: typeof sessions[0]): Promise<void> {
    const pgVal = Math.round(parseFloat(editPassingGrade) * 100)
    const mpcVal = editMaxPassCount.trim() === '' ? null : parseInt(editMaxPassCount)
    if (isNaN(pgVal) || pgVal < 0 || pgVal > session.maxGrade) {
      setEditError('Invalid passing grade')
      return
    }
    
    setSavingEdit(true)
    setEditError('')
    const res = await window.api.admin.updateSessionThresholds({ 
      sessionId: session.id, 
      passingGrade: pgVal, 
      maxPassCount: mpcVal 
    })
    setSavingEdit(false)
    
    if (res.success) {
      setEditingSessionId(null)
      await loadSessions()
    } else {
      setEditError(res.error ?? 'Failed to update thresholds')
    }
  }

  return (
    <div className="p-8 max-w-screen-lg mx-auto">
      <PageHeader 
        title="Exam Sessions" 
        subtitle="Manage distinct grading periods. Activating a session makes it the default for grading." 
        actions={
          <Button onClick={() => setIsCreating(!isCreating)}>
            {isCreating ? 'Cancel' : '+ Create Session'}
          </Button>
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
                  <input className="input-base" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Bar Exam Main" autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">Year</label>
                  <input type="number" className="input-base" value={year} onChange={e => setYear(Number(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">Max Grade</label>
                  <div className="flex items-center gap-2">
                    <input type="number" className="input-base" value={maxGrade} min={1} max={1000} step={1} onChange={e => setMaxGrade(Number(e.target.value))} />
                    <span className="text-xs text-slate shrink-0">pts</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">Grade Entry Step</label>
                  <select className="input-base" value={step} onChange={e => setStep(e.target.value)}>
                    <option value="1">Whole numbers (1, 2, 3…)</option>
                    <option value="0.5">Half points (0.5, 1.0, 1.5…)</option>
                    <option value="0.25">Quarter points (0.25, 0.5, 0.75…)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">Min. Passing Grade</label>
                  <div className="flex items-center gap-2">
                    <input type="number" className="input-base" value={passingGrade} min={0} max={maxGrade} step={0.25} onChange={e => setPassingGrade(Number(e.target.value))} />
                    <span className="text-xs text-slate shrink-0">pts</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">
                    Max Admitted Candidates
                    <span className="normal-case font-normal ml-1 text-slate/60">(leave blank for no limit)</span>
                  </label>
                  <input type="number" className="input-base" value={maxPassCount} min={1} step={1} placeholder="No limit" onChange={e => setMaxPassCount(e.target.value)} />
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
        <EmptyState title="No sessions created" description="Create an exam session to start importing candidates." />
      ) : (
        <div className="grid gap-4">
          {sessions.map(s => (
            <Card key={s.id} className={s.id === activeSession?.id ? 'border-accent shadow-md' : ''}>
              <CardBody className="flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-display font-semibold text-lg text-ink">{s.title}</h3>
                      {s.id === activeSession?.id && <Badge variant="success">Active</Badge>}
                    </div>
                    <p className="text-slate text-sm">
                      {s.year} {s.semester && `· ${s.semester}`} · Scale: 0 – {(s.maxGrade / 100).toFixed(2)} · Pass: ≥{(s.passingGrade / 100).toFixed(2)}{s.maxPassCount !== null ? ` · Max Admits: ${s.maxPassCount}` : ''} · Created {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.id !== activeSession?.id && (
                      <Button variant="secondary" onClick={() => setActiveSession(s.id)}>
                        Set Active
                      </Button>
                    )}
                    <button 
                      onClick={() => editingSessionId === s.id ? cancelEditing() : startEditing(s)}
                      className="text-xs text-slate hover:text-ink font-semibold transition-colors px-3 py-2 rounded hover:bg-surface border border-transparent hover:border-divider"
                    >
                      {editingSessionId === s.id ? 'Cancel Edit' : 'Configure Rules'}
                    </button>
                    <button 
                      onClick={() => handleDelete(s.id, s.title)}
                      className="text-xs text-danger hover:text-red-800 transition-colors px-3 py-2 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Inline Editing Panel */}
                {editingSessionId === s.id && (
                  <div className="mt-5 pt-5 border-t border-divider animate-fade-in">
                    <h4 className="text-sm font-semibold text-ink mb-4">Edit Admission Thresholds</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">
                          Min. Passing Grade
                          <span className="normal-case font-normal ml-1 text-slate/60">(out of {formatGrade(s.maxGrade)})</span>
                        </label>
                        <input
                          type="number"
                          className="input-base"
                          value={editPassingGrade}
                          min={0}
                          max={s.maxGrade / 100}
                          step={0.25}
                          onChange={(e) => setEditPassingGrade(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">
                          Max Admitted Candidates
                          <span className="normal-case font-normal ml-1 text-slate/60">(leave blank for no limit)</span>
                        </label>
                        <input
                          type="number"
                          className="input-base"
                          value={editMaxPassCount}
                          min={1}
                          step={1}
                          placeholder="No limit"
                          onChange={(e) => setEditMaxPassCount(e.target.value)}
                        />
                      </div>
                    </div>
                    {editError && <p className="text-danger text-sm mt-3">{editError}</p>}
                    <div className="flex items-center justify-end gap-3 mt-4">
                      <Button variant="secondary" size="sm" onClick={cancelEditing}>Cancel</Button>
                      <Button variant="primary" size="sm" loading={savingEdit} onClick={() => handleSaveEdit(s)}>Apply Thresholds</Button>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
