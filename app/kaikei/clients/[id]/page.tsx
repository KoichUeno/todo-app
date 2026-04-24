'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  CheckCircle2, Circle, Clock, AlertTriangle, ChevronRight,
  ArrowLeft, Settings, FileText, Plus, ChevronDown,
} from 'lucide-react'

type Submission = {
  id: string
  category: string
  status: string
  notes: string | null
  submitted_at: string | null
  completed_at: string | null
}

type Period = {
  id: string
  period_ym: string
  status: string
  reviewer: string | null
  approved_at: string | null
  kaikei_monthly_submissions: Submission[]
}

type Issue = {
  id: string
  fiscal_year: string
  occurred_at: string | null
  priority: string
  title: string
  status: string
  assignee: string | null
  source: string
}

type Client = {
  id: string
  name: string
  client_type: string
}

const CATEGORY_ORDER = ['預金', '領収書', '請求書', '売上', '仕入', '給与', 'その他']

const STATUS_STEPS = ['処理中', 'AIチェック済', 'レビュー待ち', '承認済']

const PRIORITY_CONFIG: Record<string, { icon: string; color: string }> = {
  '🔴重要':    { icon: '🔴', color: 'text-red-700 bg-red-50 border-red-200' },
  '🟡要確認':  { icon: '🟡', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  '🔵軽微':    { icon: '🔵', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  '💡チャンス': { icon: '💡', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
}

function formatYM(ym: string) {
  const [y, m] = ym.split('-')
  return `${y}年${parseInt(m)}月`
}

function currentYM() {
  return new Date().toISOString().slice(0, 7)
}

function currentFiscalYear() {
  const now = new Date()
  return `${now.getFullYear()}年度`
}

export default function KaikeiClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params)
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [client, setClient] = useState<Client | null>(null)
  const [periods, setPeriods] = useState<Period[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null)
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)
  const [showIssueForm, setShowIssueForm] = useState(false)
  const [newIssue, setNewIssue] = useState({ title: '', priority: '🟡要確認', content: '', assignee: '' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth'); return }
      fetchAll()
    })
  }, [clientId])

  async function fetchAll() {
    setLoading(true)
    const [clientRes, periodsRes, issuesRes] = await Promise.all([
      fetch(`/api/clients`).then((r) => r.json()),
      fetch(`/api/kaikei/clients/${clientId}/periods`).then((r) => r.json()),
      fetch(`/api/kaikei/clients/${clientId}/issues?fiscal_year=${currentFiscalYear()}`).then((r) => r.json()),
    ])
    const found = (clientRes as Client[]).find((c) => c.id === clientId)
    setClient(found ?? null)
    const ps: Period[] = Array.isArray(periodsRes) ? periodsRes : []
    setPeriods(ps)
    setSelectedPeriod(ps.find((p) => p.period_ym === currentYM()) ?? ps[0] ?? null)
    setIssues(Array.isArray(issuesRes) ? issuesRes : [])
    setLoading(false)
  }

  async function openCurrentPeriod() {
    await fetch(`/api/kaikei/clients/${clientId}/periods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_ym: currentYM() }),
    })
    fetchAll()
  }

  async function updateSubmission(category: string, status: string) {
    if (!selectedPeriod) return
    await fetch(`/api/kaikei/clients/${clientId}/periods/${selectedPeriod.id}/submissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, status }),
    })
    fetchAll()
  }

  async function advanceStatus() {
    if (!selectedPeriod) return
    const idx = STATUS_STEPS.indexOf(selectedPeriod.status)
    if (idx >= STATUS_STEPS.length - 1) return
    setAdvancing(true)
    await fetch(`/api/kaikei/clients/${clientId}/periods`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_id: selectedPeriod.id, status: STATUS_STEPS[idx + 1] }),
    })
    await fetchAll()
    setAdvancing(false)
  }

  async function addIssue() {
    if (!newIssue.title.trim()) return
    await fetch(`/api/kaikei/clients/${clientId}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newIssue,
        fiscal_year: currentFiscalYear(),
        occurred_at: new Date().toISOString().slice(0, 10),
        source: 'スタッフ',
        status: '未完了',
      }),
    })
    setNewIssue({ title: '', priority: '🟡要確認', content: '', assignee: '' })
    setShowIssueForm(false)
    fetchAll()
  }

  async function resolveIssue(issueId: string) {
    await fetch(`/api/kaikei/clients/${clientId}/issues`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue_id: issueId, status: '完了' }),
    })
    fetchAll()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">読み込み中...</div>
    </div>
  )

  const submissions = selectedPeriod
    ? CATEGORY_ORDER.map((cat) =>
        selectedPeriod.kaikei_monthly_submissions.find((s) => s.category === cat) ?? {
          id: '', category: cat, status: '未提出', notes: null, submitted_at: null, completed_at: null,
        }
      )
    : []

  const allComplete = submissions.every((s) => s.status === '完了宣言済' || s.status === '提出済')
  const completedCount = submissions.filter((s) => s.status === '完了宣言済').length
  const openIssues = issues.filter((i) => i.status === '未完了')
  const statusIdx = selectedPeriod ? STATUS_STEPS.indexOf(selectedPeriod.status) : -1

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-emerald-700 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <button onClick={() => router.push('/kaikei')} className="flex items-center gap-1 text-emerald-200 hover:text-white text-xs mb-2 transition-colors">
            <ArrowLeft size={12} /> KAIKEI GW
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{client?.name ?? '—'}</h1>
              <p className="text-xs text-emerald-200 mt-0.5">{client?.client_type}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/kaikei/clients/${clientId}/issues`)}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
              >
                <FileText size={12} /> 決算確認事項
                {openIssues.length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{openIssues.length}</span>
                )}
              </button>
              <button
                onClick={() => router.push(`/kaikei/clients/${clientId}/setup`)}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
              >
                <Settings size={12} /> 初期設定
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 左: 月次提出管理 */}
        <div className="lg:col-span-2 space-y-4">

          {/* 期間セレクタ */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-gray-700">月次提出管理</h2>
              <div className="flex items-center gap-2">
                <select
                  value={selectedPeriod?.period_ym ?? ''}
                  onChange={(e) => setSelectedPeriod(periods.find((p) => p.period_ym === e.target.value) ?? null)}
                  className="text-xs border rounded px-2 py-1"
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.period_ym}>{formatYM(p.period_ym)}</option>
                  ))}
                </select>
                {!periods.find((p) => p.period_ym === currentYM()) && (
                  <button
                    onClick={openCurrentPeriod}
                    className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700 flex items-center gap-1"
                  >
                    <Plus size={11} /> 今月を開始
                  </button>
                )}
              </div>
            </div>

            {/* ステータス進行バー */}
            {selectedPeriod && (
              <div className="mb-4">
                <div className="flex items-center gap-1">
                  {STATUS_STEPS.map((step, i) => (
                    <div key={step} className="flex items-center gap-1 flex-1">
                      <div className={`flex-1 h-1.5 rounded-full ${i <= statusIdx ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                      <span className={`text-[10px] whitespace-nowrap ${i === statusIdx ? 'text-emerald-700 font-bold' : i < statusIdx ? 'text-gray-400' : 'text-gray-300'}`}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
                {statusIdx < STATUS_STEPS.length - 1 && (
                  <button
                    onClick={advanceStatus}
                    disabled={advancing || (!allComplete && statusIdx === 0)}
                    className="mt-2 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                  >
                    {advancing ? '更新中…' : `「${STATUS_STEPS[statusIdx + 1]}」に進める`}
                  </button>
                )}
                {statusIdx === STATUS_STEPS.length - 1 && (
                  <p className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 size={12} /> {formatYM(selectedPeriod.period_ym)} 承認済
                  </p>
                )}
              </div>
            )}

            {/* カテゴリ別提出状況 */}
            {selectedPeriod ? (
              <div className="space-y-2">
                {submissions.map((s) => (
                  <div
                    key={s.category}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      s.status === '完了宣言済' ? 'bg-green-50 border-green-200' :
                      s.status === '提出済' ? 'bg-blue-50 border-blue-200' :
                      'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {s.status === '完了宣言済' ? (
                        <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                      ) : s.status === '提出済' ? (
                        <Clock size={16} className="text-blue-500 shrink-0" />
                      ) : (
                        <Circle size={16} className="text-gray-300 shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-700">{s.category}</span>
                      {s.status === '完了宣言済' && s.completed_at && (
                        <span className="text-[10px] text-gray-400">
                          {new Date(s.completed_at).toLocaleDateString('ja-JP')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {s.status === '未提出' && (
                        <>
                          <button
                            onClick={() => updateSubmission(s.category, '提出済')}
                            className="text-[11px] bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded transition-colors"
                          >
                            提出済にする
                          </button>
                          <button
                            onClick={() => updateSubmission(s.category, '完了宣言済')}
                            className="text-[11px] bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded transition-colors"
                          >
                            完了宣言
                          </button>
                        </>
                      )}
                      {s.status === '提出済' && (
                        <button
                          onClick={() => updateSubmission(s.category, '完了宣言済')}
                          className="text-[11px] bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded transition-colors"
                        >
                          完了宣言
                        </button>
                      )}
                      {s.status === '完了宣言済' && (
                        <button
                          onClick={() => updateSubmission(s.category, '未提出')}
                          className="text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition-colors"
                        >
                          取消
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="pt-2 text-xs text-gray-400 text-right">
                  完了宣言済: {completedCount} / {submissions.length}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400 mb-3">今月の月次処理がまだ開始されていません</p>
                <button
                  onClick={openCurrentPeriod}
                  className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-1 mx-auto"
                >
                  <Plus size={14} /> {formatYM(currentYM())} を開始する
                </button>
              </div>
            )}
          </div>

          {/* 過去の月次履歴 */}
          {periods.length > 1 && (
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-bold text-sm text-gray-700 mb-3">過去の処理履歴</h2>
              <div className="space-y-1">
                {periods.filter((p) => p.period_ym !== selectedPeriod?.period_ym).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeriod(p)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                  >
                    <span className="text-gray-600">{formatYM(p.period_ym)}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                      p.status === '承認済' ? 'bg-green-100 text-green-700' :
                      p.status === 'レビュー待ち' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{p.status}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右: 決算確認事項 */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-gray-700">
                決算確認事項
                {openIssues.length > 0 && (
                  <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{openIssues.length}件未完了</span>
                )}
              </h2>
              <button
                onClick={() => router.push(`/kaikei/clients/${clientId}/issues`)}
                className="text-[11px] text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
              >
                全件表示 <ChevronRight size={11} />
              </button>
            </div>

            {/* 未完了の上位5件 */}
            {openIssues.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">未完了事項はありません</p>
            ) : (
              <div className="space-y-2">
                {openIssues.slice(0, 5).map((issue) => {
                  const pc = PRIORITY_CONFIG[issue.priority] ?? PRIORITY_CONFIG['🟡要確認']
                  return (
                    <div key={issue.id} className={`p-2 rounded-lg border text-xs ${pc.color}`}>
                      <div className="font-medium">{pc.icon} {issue.title}</div>
                      {issue.assignee && <div className="text-[10px] mt-0.5 opacity-70">担当: {issue.assignee}</div>}
                      <button
                        onClick={() => resolveIssue(issue.id)}
                        className="mt-1 text-[10px] opacity-70 hover:opacity-100 underline"
                      >
                        完了にする
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 新規追加 */}
            {showIssueForm ? (
              <div className="mt-3 border-t pt-3 space-y-2">
                <select
                  value={newIssue.priority}
                  onChange={(e) => setNewIssue({ ...newIssue, priority: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-xs"
                >
                  {Object.keys(PRIORITY_CONFIG).map((p) => <option key={p}>{p}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="件名"
                  value={newIssue.title}
                  onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  placeholder="担当者"
                  value={newIssue.assignee}
                  onChange={(e) => setNewIssue({ ...newIssue, assignee: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-xs"
                />
                <textarea
                  placeholder="内容・経緯"
                  value={newIssue.content}
                  onChange={(e) => setNewIssue({ ...newIssue, content: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-xs"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button onClick={addIssue} className="flex-1 bg-emerald-600 text-white text-xs py-1.5 rounded hover:bg-emerald-700">
                    追加
                  </button>
                  <button onClick={() => setShowIssueForm(false)} className="text-xs text-gray-500 px-2">
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowIssueForm(true)}
                className="mt-3 w-full text-xs text-emerald-600 hover:text-emerald-700 border border-dashed border-emerald-300 py-2 rounded-lg flex items-center justify-center gap-1"
              >
                <Plus size={12} /> 確認事項を追加
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
