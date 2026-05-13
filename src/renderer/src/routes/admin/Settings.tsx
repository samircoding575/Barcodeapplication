import { useEffect, useState, useCallback } from 'react'
import type { AppConfig, User1Account, SystemStats } from '@shared/types'
import { useAppStore, useIsAdmin } from '../../store/appStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card, CardBody } from '../../components/ui/Card'
import { StatCard } from '../../components/ui/StatCard'
import Papa from 'papaparse'
import { useLocale } from '../../i18n/useLocale'

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-[280px_1fr] gap-8 py-8 border-b border-divider last:border-none">
      <div>
        <h3 className="font-display font-semibold text-ink text-base">{title}</h3>
        <p className="text-slate text-sm mt-1.5 leading-relaxed">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export function Settings(): JSX.Element {
  const activeSession = useAppStore((s) => s.activeSession)
  const sessions = useAppStore((s) => s.sessions)
  const isPrimaryAdmin = useIsAdmin()
  const { locale, setLocale, t } = useLocale()

  // Config state
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [configDraft, setConfigDraft] = useState<AppConfig | null>(null)
  const [configSaving, setConfigSaving] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)

  // Stats state
  const [stats, setStats] = useState<SystemStats | null>(null)

  // Examiners state
  const [users, setUsers] = useState<User1Account[]>([])
  const [userLoading, setUserLoading] = useState(false)

  // Admin account creation state — removed (no more ADMIN_READONLY accounts)

  // Data mgmt state
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)
  const [clearResult, setClearResult] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportResult, setExportResult] = useState<string | null>(null)
  const [resetStage, setResetStage] = useState<0 | 1 | 2>(0)
  const [resetInput, setResetInput] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetResult, setResetResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [cfg, st, ex] = await Promise.all([
      window.api.admin.getConfig(),
      window.api.admin.getSystemStats(),
      window.api.admin.listUsers(),
    ])
    setConfig(cfg)
    setConfigDraft(cfg)
    setStats(st)
    setUsers(ex)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Config handlers ──────────────────────────────────────────────────────
  async function saveConfig(): Promise<void> {
    if (!configDraft) return
    setConfigSaving(true)
    const res = await window.api.admin.updateConfig(configDraft)
    setConfigSaving(false)
    if (res.success) {
      setConfig(configDraft)
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 2500)
    }
  }

  const configChanged = JSON.stringify(config) !== JSON.stringify(configDraft)

  // Admin account creation handler removed

  // ── User1 account handlers ───────────────────────────────────────────────
  async function handleDeleteUser(id: string, email: string): Promise<void> {
    if (!confirm(`Remove user account "${email}"? They will no longer be able to log in.`)) return
    setUserLoading(true)
    await window.api.admin.deleteUser({ id })
    setUsers((prev) => prev.filter((u) => u.id !== id))
    setUserLoading(false)
  }

  // ── Data management handlers ─────────────────────────────────────────────
  async function handleClearGrades(): Promise<void> {
    if (!activeSession) return
    setClearLoading(true)
    const res = await window.api.admin.clearSessionGrades({ sessionId: activeSession.id })
    setClearLoading(false)
    setClearConfirm(false)
    if (res.success) {
      setClearResult(`✓ Cleared ${res.count} grade records from "${activeSession.title}"`)
      await load()
    } else {
      setClearResult(`✗ Error: ${res.error}`)
    }
    setTimeout(() => setClearResult(null), 4000)
  }

  async function handleExportAll(): Promise<void> {
    if (sessions.length === 0) { setExportResult('No sessions to export.'); return }
    setExportLoading(true)
    try {
      let allRows: { session: string; external_id: string; name: string; grade: string }[] = []
      for (const s of sessions) {
        const results = await window.api.admin.getResults({ sessionId: s.id })
        const label = [s.title, s.year, s.semester].filter(Boolean).join(' · ')
        results.forEach((r) => {
          allRows.push({
            session: label,
            external_id: r.barcode.student.externalId,
            name: r.barcode.student.name,
            grade: (r.value / 100).toFixed(2),
          })
        })
      }
      const csv = Papa.unparse(allRows)
      const res = await window.api.file.saveCsv({ content: csv, defaultName: 'all-sessions-results.csv' })
      setExportResult(res.success ? `✓ Exported ${allRows.length} records` : '✗ Export cancelled')
    } finally {
      setExportLoading(false)
    }
    setTimeout(() => setExportResult(null), 4000)
  }

  async function handleReset(): Promise<void> {
    if (resetInput !== 'RESET') return
    setResetLoading(true)
    const res = await window.api.admin.resetSystem()
    setResetLoading(false)
    setResetStage(0)
    setResetInput('')
    if (res.success) {
      setResetResult('✓ System has been reset. All data has been cleared.')
      await load()
    } else {
      setResetResult(`✗ Error: ${res.error}`)
    }
    setTimeout(() => setResetResult(null), 6000)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader title={t('settings_title')} subtitle={t('settings_subtitle')} />

      {/* System Overview Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard value={stats.totalSessions} label="Sessions" />
          <StatCard value={stats.totalStudents} label="Students" />
          <StatCard value={stats.totalGrades} label="Grades Recorded" accent />
          <StatCard value={stats.totalUsers} label="Active Users" />
        </div>
      )}

      <Card>
        <CardBody className="divide-y divide-divider px-8">


          {/* 1 ── Organization Profile */}
          <Section
            title={t('org_profile')}
            description={t('org_desc')}
          >
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">{t('org_name_en')}</label>
                <input
                  className="input-base"
                  value={configDraft?.orgName ?? ''}
                  onChange={(e) => setConfigDraft((d) => d ? { ...d, orgName: e.target.value } : d)}
                  placeholder="Lebanese Bar Association"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-1.5">{t('org_name_ar')}</label>
                <input
                  className="input-base text-right"
                  dir="rtl"
                  value={configDraft?.orgNameAr ?? ''}
                  onChange={(e) => setConfigDraft((d) => d ? { ...d, orgNameAr: e.target.value } : d)}
                  placeholder="نقابة المحامين في بيروت"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-1">
                {configSaved && <span className="text-xs text-success font-semibold">✓ Saved</span>}
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!configChanged}
                  loading={configSaving}
                  onClick={saveConfig}
                >
                  {t('save_changes')}
                </Button>
              </div>
            </div>
          </Section>

          {/* 2 ── Admin Accounts — primary admin is env-configured, no UI creation needed */}

          {/* 3 ── User Accounts */}
          <Section title={t('user_accounts')} description={t('user_accounts_desc')}>
            {users.length === 0 ? (
              <p className="text-sm text-slate italic py-4">{t('no_users')}</p>
            ) : (
              <div className="bg-paper border border-divider rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface border-b border-divider">
                      <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider">{t('email_label')}</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider">{t('registered')}</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate uppercase tracking-wider text-right">{t('action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id} className={`border-b border-divider/60 ${i % 2 === 0 ? 'bg-paper' : 'bg-surface/30'}`}>
                        <td className="px-4 py-3 text-sm font-medium text-ink">{u.email}</td>
                        <td className="px-4 py-3 text-xs text-slate">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            disabled={userLoading}
                            className="text-xs text-danger hover:text-red-800 transition-colors font-semibold px-2 py-1 rounded hover:bg-red-50"
                          >
                            {t('remove')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* 4 ── Data Management */}
          <Section title={t('data_management')} description={t('data_desc')}>
            <div className="flex flex-col gap-4">
              {/* Clear grades */}
              <div className="flex items-start justify-between p-4 bg-amber-50/50 rounded-xl border border-amber-200">
                <div>
                  <p className="text-sm font-semibold text-warning">{t('clear_grades')}</p>
                  <p className="text-xs text-slate mt-0.5">
                    {activeSession
                      ? `${t('clear_grades_desc').replace('the active session', `"${activeSession.title}"`)}`
                      : t('no_active_session_clear')}
                  </p>
                  {clearResult && <p className={`text-xs mt-1 font-medium ${clearResult.startsWith('✓') ? 'text-success' : 'text-danger'}`}>{clearResult}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {!clearConfirm ? (
                    <Button variant="secondary" size="sm" disabled={!activeSession} onClick={() => setClearConfirm(true)}>
                      {t('clear_btn')}
                    </Button>
                  ) : (
                    <>
                      <span className="text-xs text-warning font-semibold">{t('sure')}</span>
                      <Button size="sm" variant="danger" loading={clearLoading} onClick={handleClearGrades}>{t('yes_clear')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setClearConfirm(false)}>{t('cancel')}</Button>
                    </>
                  )}
                </div>
              </div>

              {/* Factory reset */}
              <div className="p-4 bg-red-50/50 rounded-xl border border-red-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-danger">{t('reset_system')}</p>
                    <p className="text-xs text-slate mt-0.5">{t('reset_desc')}</p>
                    {resetResult && <p className={`text-xs mt-1 font-medium ${resetResult.startsWith('✓') ? 'text-success' : 'text-danger'}`}>{resetResult}</p>}
                  </div>
                  {resetStage === 0 && (
                    <Button variant="danger" size="sm" onClick={() => setResetStage(1)}>{t('reset_btn')}</Button>
                  )}
                </div>
                {resetStage === 1 && (
                  <div className="mt-4 pt-4 border-t border-red-200 animate-fade-in">
                    <p className="text-sm font-semibold text-danger mb-2">
                      {t('type_reset')} <code className="bg-red-100 px-1 rounded">RESET</code> {t('to_confirm')}
                    </p>
                    <div className="flex gap-2">
                      <input
                        className="input-base font-mono text-sm max-w-[200px]"
                        value={resetInput}
                        onChange={(e) => setResetInput(e.target.value)}
                        placeholder="RESET"
                        autoFocus
                      />
                      <Button variant="danger" size="sm" disabled={resetInput !== 'RESET'} loading={resetLoading} onClick={handleReset}>
                        {t('confirm_reset')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setResetStage(0); setResetInput('') }}>
                        {t('cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Section>

        </CardBody>
      </Card>
    </div>
  )
}
