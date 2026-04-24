'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { ArrowLeft, Plus, CheckCircle2, Circle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

type Issue = {
  id: string
  fiscal_year: string
  occurred_at: string | null
  issue_type: string
  priority: string
  title: string
  content: string | null
  assignee: string | null
  ledger_treatment: string | null
  tax_return_treatment: string | null
  filing_required: boolean
  filing_note: string | null
  other_action: string | null
  owner_confirmed: boolean
  status: string
  source: string
  related_journal_date: string | null
  related_account: string | null
  related_amount: number | null
}

const PRIORITY_CONFIG: Record<string, { icon: string; rowColor: string; badgeColor: string }> = {
  '🔴重要':    { icon: '🔴', rowColor: 'border-red-200 bg-red-50/30',   badgeColor: 'bg-red-100 text-red-700' },
  '🟡要確認':  { icon: '🟡', rowColor: 'border-yellow-200 bg-yellow-50/20', badgeColor: 'bg-yellow-100 text-yellow-700' },
  '🔵軽微':    { icon: '🔵', rowColor: 'border-blue-200 bg-blue-50/20',  badgeColor: 'bg-blue-100 text-blue-700' },
  '💡チャンス': { icon: '💡', rowColor: 'border-emerald-200 bg-emerald-50/20', badgeColor: 'bg-emerald-100 text-emerald-700' },
}

const ISSUE_TYPES = ['今期新規', '継続論点', '仕訳ルール']
const SOURCES = ['スタッフ', '所長', 'AI-Layer1', 'AI-Layer2', '打合せ']

function currentFiscalYear() {
  return `${new Date().getFullYear()}年度`
}

export default function IssuesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params)
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [issues, setIssues] = useState<Issue[]>([])
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'未完了' | '完了' | ''>('')
  const [filterPriority, setFilterPriority] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null)
  const [form, setForm] = useState({
    title: '', priority: '🟡要確認', issue_type: '今期新規', source: 'スタッフ',
    content: '', assignee: '', ledger_treatment: '', tax_return_treatment: '',
    filing_required: false, filing_note: '', other_action: '',
    occurred_at: new Date().toISOString().slice(0, 10),
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth'); return }
      fetchAll()
    })
  }, [clientId])

  async function fetchAll() {
    setLoading(true)
    const [clientRes, issuesRes] = await Promise.all([
      fetch('/api/clients').then((r) => r.json()),
      fetch(`/api/kaikei/clients/${clientId}/issues`).then((r) => r.json()),
    ])
    const client = (clientRes as { id: string; name: string }[]).find((c) => c.id === clientId)
    setClientName(client?.name ?? '')
    setIssues(Array.isArray(issuesRes) ? issuesRes : [])
    setLoading(false)
  }

  async function saveIssue() {
    if (!form.title.trim()) return
    if (editingIssue) {
      await fetch(`/api/kaikei/clients/${clientId}/issues`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: editingIssue.id, ...form }),
      })
    } else {
      await fetch(`/api/kaikei/clients/${clientId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, fiscal_year: currentFiscalYear(), status: '未完了' }),
      })
    }
    setShowForm(false)
    setEditingIssue(null)
    fetchAll()
  }

  async function toggleStatus(issue: Issue) {
    await fetch(`/api/kaikei/clients/${clientId}/issues`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue_id: issue.id, status: issue.status === '未完了' ? '完了' : '未完了' }),
    })
    fetchAll()
  }

  async function toggleOwnerConfirm(issue: Issue) {
    await fetch(`/api/kaikei/clients/${clientId}/issues`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue_id: issue.id, owner_confirmed: !issue.owner_confirmed }),
    })
    fetchAll()
  }

  function startEdit(issue: Issue) {
    setEditingIssue(issue)
    setForm({
      title: issue.title, priority: issue.priority, issue_type: issue.issue_type,
      source: issue.source, content: issue.content ?? '', assignee: issue.assignee ?? '',
      ledger_treatment: issue.ledger_treatment ?? '', tax_return_treatment: issue.tax_return_treatment ?? '',
      filing_required: issue.filing_required, filing_note: issue.filing_note ?? '',
      other_action: issue.other_action ?? '', occurred_at: issue.occurred_at ?? '',
    })
    setShowForm(true)
  }

  const filtered = issues.filter((i) => {
    if (filterStatus && i.status !== filterStatus) return false
    if (filterPriority && i.priority !== filterPriority) return false
    return true
  })

  const openCount = issues.filter((i) => i.status === '未完了').length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-emerald-700 text-white px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => router.push(`/kaikei/clients/${clientId}`)} className="flex items-center gap-1 text-emerald-200 hover:text-white text-xs mb-2">
            <ArrowLeft size={12} /> {clientName}
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">決算確認事項</h1>
              <p className="text-xs text-emerald-200 mt-0.5">{clientName} — {currentFiscalYear()}</p>
            </div>
            <button
              onClick={() => { setEditingIssue(null); setForm({ title: '', priority: '🟡要確認', issue_type: '今期新規', source: 'スタッフ', content: '', assignee: '', ledger_treatment: '', tax_return_treatment: '', filing_required: false, filing_note: '', other_action: '', occurred_at: new Date().toISOString().slice(0, 10) }); setShowForm(true) }}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 px-3 py-1.5 rounded flex items-center gap-1"
            >
              <Plus size={12} /> 新規追加
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* 統計 */}
        <div className="flex gap-3 mb-4">
          {[
            { key: '', label: `全件 ${issues.length}`, color: 'bg-white' },
            { key: '未完了', label: `未完了 ${openCount}`, color: 'bg-red-50' },
            { key: '完了', label: `完了 ${issues.length - openCount}`, color: 'bg-green-50' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key as typeof filterStatus)}
              className={`${f.color} border rounded-lg px-3 py-1.5 text-xs transition-all ${filterStatus === f.key ? 'ring-2 ring-emerald-500' : 'hover:shadow-sm'}`}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            {Object.keys(PRIORITY_CONFIG).map((p) => (
              <button
                key={p}
                onClick={() => setFilterPriority(filterPriority === p ? '' : p)}
                className={`text-xs border rounded-lg px-2 py-1 transition-all ${filterPriority === p ? 'ring-2 ring-emerald-500 bg-white' : 'bg-white hover:shadow-sm'}`}
              >
                {PRIORITY_CONFIG[p].icon}
              </button>
            ))}
          </div>
        </div>

        {/* フォーム */}
        {showForm && (
          <div className="bg-white border rounded-xl p-5 mb-4 shadow-sm">
            <h3 className="font-bold text-sm text-gray-700 mb-4">{editingIssue ? '編集' : '新規追加'}</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">優先度</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="border rounded px-2 py-1.5 text-sm w-full">
                  {Object.keys(PRIORITY_CONFIG).map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">種類</label>
                <select value={form.issue_type} onChange={(e) => setForm({ ...form, issue_type: e.target.value })} className="border rounded px-2 py-1.5 text-sm w-full">
                  {ISSUE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs text-gray-500 block mb-1">件名 *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="border rounded px-2 py-1.5 text-sm w-full" placeholder="論点の件名" />
            </div>
            <div className="mb-3">
              <label className="text-xs text-gray-500 block mb-1">内容・経緯</label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} className="border rounded px-2 py-1.5 text-sm w-full" placeholder="詳細・背景・判断の経緯" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">帳簿上の処理</label>
                <input type="text" value={form.ledger_treatment} onChange={(e) => setForm({ ...form, ledger_treatment: e.target.value })} className="border rounded px-2 py-1.5 text-sm w-full" placeholder="どう仕訳するか" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">申告書上の処理</label>
                <input type="text" value={form.tax_return_treatment} onChange={(e) => setForm({ ...form, tax_return_treatment: e.target.value })} className="border rounded px-2 py-1.5 text-sm w-full" placeholder="どの別表に影響するか" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">担当者</label>
                <input type="text" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} className="border rounded px-2 py-1.5 text-sm w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">発生日</label>
                <input type="date" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} className="border rounded px-2 py-1.5 text-sm w-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveIssue} className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700">
                {editingIssue ? '更新' : '追加'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingIssue(null) }} className="text-sm text-gray-500 px-3 py-2 hover:text-gray-700">キャンセル</button>
            </div>
          </div>
        )}

        {/* 一覧 */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">該当する確認事項はありません</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((issue) => {
              const pc = PRIORITY_CONFIG[issue.priority] ?? PRIORITY_CONFIG['🟡要確認']
              const isExpanded = expandedId === issue.id
              return (
                <div key={issue.id} className={`bg-white border rounded-xl overflow-hidden ${pc.rowColor}`}>
                  <div className="flex items-start gap-3 p-4">
                    <button onClick={() => toggleStatus(issue)} className="mt-0.5 shrink-0">
                      {issue.status === '完了'
                        ? <CheckCircle2 size={18} className="text-green-500" />
                        : <Circle size={18} className="text-gray-300 hover:text-gray-400" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pc.badgeColor}`}>{issue.priority}</span>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{issue.issue_type}</span>
                        <span className="text-[10px] text-gray-400">{issue.source}</span>
                        {issue.occurred_at && <span className="text-[10px] text-gray-400">{issue.occurred_at}</span>}
                      </div>
                      <p className={`text-sm font-medium mt-1 ${issue.status === '完了' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {issue.title}
                      </p>
                      {issue.assignee && <p className="text-[11px] text-gray-500 mt-0.5">担当: {issue.assignee}</p>}
                      {issue.content && isExpanded && (
                        <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{issue.content}</p>
                      )}
                      {isExpanded && (issue.ledger_treatment || issue.tax_return_treatment) && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {issue.ledger_treatment && (
                            <div className="bg-gray-50 rounded p-2">
                              <div className="text-[10px] text-gray-400 font-medium">帳簿上の処理</div>
                              <div className="text-xs text-gray-700 mt-0.5">{issue.ledger_treatment}</div>
                            </div>
                          )}
                          {issue.tax_return_treatment && (
                            <div className="bg-gray-50 rounded p-2">
                              <div className="text-[10px] text-gray-400 font-medium">申告書上の処理</div>
                              <div className="text-xs text-gray-700 mt-0.5">{issue.tax_return_treatment}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {issue.status === '未完了' && (
                        <button
                          onClick={() => toggleOwnerConfirm(issue)}
                          className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                            issue.owner_confirmed ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {issue.owner_confirmed ? '✓ 所長確認済' : '所長確認'}
                        </button>
                      )}
                      <button onClick={() => startEdit(issue)} className="text-[10px] text-gray-400 hover:text-gray-600">編集</button>
                      <button onClick={() => setExpandedId(isExpanded ? null : issue.id)} className="text-gray-400 hover:text-gray-600">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
