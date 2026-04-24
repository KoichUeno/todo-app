'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  Building2, Crown, CheckCircle2, Clock, AlertTriangle,
  ChevronRight, Plus, Settings, FileText, RefreshCw,
} from 'lucide-react'

type KaikeiClient = {
  id: string
  name: string
  client_type: string
  kaikei_settings: {
    fiscal_month: number
    mode: string[]
    submission_cycle: string
    setup_completed_at: string | null
  } | null
  current_period: {
    id: string
    period_ym: string
    status: string
  } | null
  open_issues: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  '処理中':      { label: '処理中',      color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  'AIチェック済': { label: 'AIチェック済', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  'レビュー待ち':  { label: 'レビュー待ち', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  '承認済':      { label: '承認済',      color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
}

function currentYM() {
  return new Date().toISOString().slice(0, 7)
}

function formatYM(ym: string) {
  const [y, m] = ym.split('-')
  return `${y}年${parseInt(m)}月`
}

export default function KaikeiDashboard() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [clients, setClients] = useState<KaikeiClient[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth'); return }
      fetchClients()
    })
  }, [])

  async function fetchClients() {
    setLoading(true)
    const res = await fetch('/api/kaikei/clients')
    if (res.ok) setClients(await res.json())
    setLoading(false)
  }

  async function openPeriod(clientId: string) {
    await fetch(`/api/kaikei/clients/${clientId}/periods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_ym: currentYM() }),
    })
    fetchClients()
  }

  const filtered = clients.filter((c) => {
    if (search && !c.name.includes(search)) return false
    if (filterStatus) {
      const s = c.current_period?.status ?? ''
      if (filterStatus === '未開始' && c.current_period) return false
      if (filterStatus !== '未開始' && s !== filterStatus) return false
    }
    return true
  })

  const counts = {
    total: clients.length,
    未開始: clients.filter((c) => !c.current_period).length,
    処理中: clients.filter((c) => c.current_period?.status === '処理中').length,
    AIチェック済: clients.filter((c) => c.current_period?.status === 'AIチェック済').length,
    レビュー待ち: clients.filter((c) => c.current_period?.status === 'レビュー待ち').length,
    承認済: clients.filter((c) => c.current_period?.status === '承認済').length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-emerald-700 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-wide">KAIKEI GATEWAY</h1>
            <p className="text-xs text-emerald-200 mt-0.5">{formatYM(currentYM())} 処理状況</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/')}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 px-3 py-1.5 rounded transition-colors"
            >
              タスク管理
            </button>
            <button
              onClick={fetchClients}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 px-3 py-1.5 rounded transition-colors flex items-center gap-1"
            >
              <RefreshCw size={12} /> 更新
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* サマリーカード */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { key: '未開始', label: '未開始', color: 'text-gray-600', bg: 'bg-white' },
            { key: '処理中', label: '処理中', color: 'text-blue-700', bg: 'bg-blue-50' },
            { key: 'AIチェック済', label: 'AIチェック済', color: 'text-purple-700', bg: 'bg-purple-50' },
            { key: 'レビュー待ち', label: 'レビュー待ち', color: 'text-orange-700', bg: 'bg-orange-50' },
            { key: '承認済', label: '承認済', color: 'text-green-700', bg: 'bg-green-50' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setFilterStatus(filterStatus === s.key ? '' : s.key)}
              className={`${s.bg} border rounded-xl p-3 text-left transition-all ${
                filterStatus === s.key ? 'ring-2 ring-emerald-500 shadow-sm' : 'hover:shadow-sm'
              }`}
            >
              <div className={`text-2xl font-bold ${s.color}`}>
                {counts[s.key as keyof typeof counts]}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </button>
          ))}
        </div>

        {/* 検索・フィルタ */}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="クライアント名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm flex-1 max-w-xs"
          />
          {filterStatus && (
            <button
              onClick={() => setFilterStatus('')}
              className="text-xs text-gray-500 hover:text-gray-700 border px-3 py-2 rounded-lg"
            >
              フィルタ解除
            </button>
          )}
        </div>

        {/* クライアント一覧 */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">読み込み中...</div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 font-semibold text-gray-600">クライアント</th>
                  <th className="text-left p-3 font-semibold text-gray-600">区分</th>
                  <th className="text-left p-3 font-semibold text-gray-600">モード</th>
                  <th className="text-left p-3 font-semibold text-gray-600">{formatYM(currentYM())} ステータス</th>
                  <th className="text-left p-3 font-semibold text-gray-600">未完了事項</th>
                  <th className="text-left p-3 font-semibold text-gray-600">設定</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => {
                  const cfg = c.current_period ? STATUS_CONFIG[c.current_period.status] : null
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/kaikei/clients/${c.id}`)}
                    >
                      <td className="p-3 font-medium text-gray-800">{c.name}</td>
                      <td className="p-3">
                        {c.client_type === '企業' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                            <Building2 size={9} /> 企業
                          </span>
                        )}
                        {c.client_type === '資産家' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                            <Crown size={9} /> 資産家
                          </span>
                        )}
                        {!['企業','資産家'].includes(c.client_type) && (
                          <span className="text-[10px] text-gray-400">{c.client_type || '—'}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {(c.kaikei_settings?.mode ?? []).map((m) => (
                            <span key={m} className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                              {m === '記帳代行' ? '①記帳' : '②自計'}
                            </span>
                          ))}
                          {!c.kaikei_settings && (
                            <span className="text-[10px] text-gray-300">未設定</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {cfg ? (
                          <span className={`text-[11px] px-2 py-1 rounded-full border font-medium ${cfg.color} ${cfg.bg}`}>
                            {cfg.label}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); openPeriod(c.id) }}
                            className="text-[11px] text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                          >
                            <Plus size={11} /> 今月を開始
                          </button>
                        )}
                      </td>
                      <td className="p-3">
                        {c.open_issues > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-orange-600 font-medium">
                            <AlertTriangle size={11} /> {c.open_issues}件
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-300">なし</span>
                        )}
                      </td>
                      <td className="p-3">
                        {c.kaikei_settings?.setup_completed_at ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600">
                            <CheckCircle2 size={10} /> 設定済
                          </span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/kaikei/clients/${c.id}/setup`) }}
                            className="inline-flex items-center gap-0.5 text-[10px] text-orange-500 hover:text-orange-600"
                          >
                            <Settings size={10} /> 初期設定
                          </button>
                        )}
                      </td>
                      <td className="p-3">
                        <ChevronRight size={14} className="text-gray-300" />
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                      該当するクライアントがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
