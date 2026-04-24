'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { ArrowLeft, CheckCircle2, ChevronRight, Info } from 'lucide-react'

type Settings = {
  mode: string[]
  fiscal_month: number | null
  submission_cycle: string
  consumption_tax_status: string
  consumption_tax_method: string
  simplified_tax_category: string
  accounting_method: string
  has_manufacturing_cost: boolean
  has_department_accounting: boolean
  has_employees: boolean
  payroll_method: string
  has_lease: boolean
  tax_base_period_sales: string
  specific_period_sales: string
  has_exempt_sales: boolean
  industry: string
  industry_sub: string
  setup_completed_at: string | null
}

const DEFAULT: Settings = {
  mode: [],
  fiscal_month: null,
  submission_cycle: '毎月',
  consumption_tax_status: '',
  consumption_tax_method: '',
  simplified_tax_category: '',
  accounting_method: '税抜',
  has_manufacturing_cost: false,
  has_department_accounting: false,
  has_employees: false,
  payroll_method: '',
  has_lease: false,
  tax_base_period_sales: '',
  specific_period_sales: '',
  has_exempt_sales: false,
  industry: '',
  industry_sub: '',
  setup_completed_at: null,
}

const STEPS = ['Q0. 関与形態', 'Q1. 業種', 'Q2. 売上・消費税', 'Q3. 組織再編', 'Q4. 消費税確認', 'Q5-11. その他設定']

const SIMPLIFIED_CATEGORIES = [
  { value: '第1種', label: '第1種（卸売業）90%' },
  { value: '第2種', label: '第2種（小売業）80%' },
  { value: '第3種', label: '第3種（製造業等）70%' },
  { value: '第4種', label: '第4種（その他）60%' },
  { value: '第5種', label: '第5種（サービス業等）50%' },
  { value: '第6種', label: '第6種（不動産業）40%' },
]

function Tip({ text }: { text: string }) {
  return (
    <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 mt-2">
      <Info size={14} className="shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  )
}

export default function SetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params)
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [step, setStep] = useState(0)
  const [settings, setSettings] = useState<Settings>(DEFAULT)
  const [clientName, setClientName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth'); return }
      loadSettings()
    })
  }, [clientId])

  async function loadSettings() {
    const [clientRes, settingsRes] = await Promise.all([
      fetch('/api/clients').then((r) => r.json()),
      fetch(`/api/kaikei/clients/${clientId}/settings`).then((r) => r.json()),
    ])
    const client = (clientRes as { id: string; name: string }[]).find((c) => c.id === clientId)
    setClientName(client?.name ?? '')
    if (settingsRes) setSettings({ ...DEFAULT, ...settingsRes })
  }

  function set<K extends keyof Settings>(key: K, val: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: val }))
  }

  function toggleMode(m: string) {
    set('mode', settings.mode.includes(m) ? settings.mode.filter((x) => x !== m) : [...settings.mode, m])
  }

  // 消費税の自動判定
  const taxBaseNum = parseInt(settings.tax_base_period_sales.replace(/,/g, '') || '0')
  const specificNum = parseInt(settings.specific_period_sales.replace(/,/g, '') || '0')
  const autoTaxStatus = taxBaseNum > 10_000_000 || specificNum > 10_000_000 ? '課税' : taxBaseNum === 0 ? '' : '免税'
  const canSimplified = taxBaseNum <= 50_000_000

  async function save(complete = false) {
    setSaving(true)
    const payload = {
      ...settings,
      tax_base_period_sales: taxBaseNum || null,
      specific_period_sales: specificNum || null,
      consumption_tax_status: settings.consumption_tax_status || autoTaxStatus || null,
      ...(complete ? { setup_completed_at: new Date().toISOString() } : {}),
    }
    await fetch(`/api/kaikei/clients/${clientId}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (complete) {
      setSaved(true)
      setTimeout(() => router.push(`/kaikei/clients/${clientId}`), 1200)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-emerald-700 text-white px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => router.push(`/kaikei/clients/${clientId}`)} className="flex items-center gap-1 text-emerald-200 hover:text-white text-xs mb-2">
            <ArrowLeft size={12} /> {clientName}
          </button>
          <h1 className="text-lg font-bold">初期設定ヒアリング</h1>
          <p className="text-xs text-emerald-200 mt-0.5">{clientName}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* ステップナビ */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap transition-colors ${
                i === step ? 'bg-emerald-600 text-white' :
                i < step ? 'bg-emerald-100 text-emerald-700' :
                'bg-gray-100 text-gray-500'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border p-6">

          {/* Q0: 関与形態 */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-bold text-gray-800">Q0. 関与形態・モード</h2>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">関与形態（複数選択可）</label>
                <div className="flex gap-3">
                  {['記帳代行', '自計化チェック'].map((m) => (
                    <button
                      key={m}
                      onClick={() => toggleMode(m)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        settings.mode.includes(m)
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      {m === '記帳代行' ? '① 記帳代行' : '② 自計化チェック'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">決算月</label>
                <select
                  value={settings.fiscal_month ?? ''}
                  onChange={(e) => set('fiscal_month', parseInt(e.target.value) || null)}
                  className="border rounded-lg px-3 py-2 text-sm w-32"
                >
                  <option value="">選択</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">月次提出サイクル</label>
                <div className="flex gap-2 flex-wrap">
                  {['毎月', '2ヶ月', '四半期', '半年', '年1回'].map((c) => (
                    <button
                      key={c}
                      onClick={() => set('submission_cycle', c)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        settings.submission_cycle === c
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Q1: 業種 */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-bold text-gray-800">Q1. 業種</h2>
              <Tip text="業種は消費税の簡易課税業種区分や、製造原価の要否判定に使用します。複数業種の場合は主たる業種を選んでください。" />
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">主たる業種</label>
                <input
                  type="text"
                  value={settings.industry}
                  onChange={(e) => set('industry', e.target.value)}
                  placeholder="例: 運送業、不動産賃貸業、製造業"
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">従たる業種（あれば）</label>
                <input
                  type="text"
                  value={settings.industry_sub}
                  onChange={(e) => set('industry_sub', e.target.value)}
                  placeholder="例: 小売業、コンサルティング"
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">製造原価の計算が必要か</label>
                <div className="flex gap-3">
                  {[['あり', true], ['なし', false]].map(([label, val]) => (
                    <button
                      key={String(label)}
                      onClick={() => set('has_manufacturing_cost', val as boolean)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        settings.has_manufacturing_cost === val
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      {String(label)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Q2: 売上・消費税 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-bold text-gray-800">Q2. 売上規模・消費税判定</h2>
              <Tip text="基準期間（2期前）の課税売上高が1,000万円超で課税事業者。5,000万円以下なら簡易課税を選択可。" />
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">基準期間の課税売上高（2期前）</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={settings.tax_base_period_sales}
                    onChange={(e) => set('tax_base_period_sales', e.target.value)}
                    placeholder="例: 8,500,000"
                    className="border rounded-lg px-3 py-2 text-sm w-48"
                  />
                  <span className="text-sm text-gray-500">円</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">特定期間の課税売上高</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={settings.specific_period_sales}
                    onChange={(e) => set('specific_period_sales', e.target.value)}
                    placeholder="例: 6,000,000"
                    className="border rounded-lg px-3 py-2 text-sm w-48"
                  />
                  <span className="text-sm text-gray-500">円</span>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.has_exempt_sales}
                    onChange={(e) => set('has_exempt_sales', e.target.checked)}
                    className="rounded"
                  />
                  非課税売上がある（住宅賃貸・土地・有価証券等）
                </label>
              </div>
              {autoTaxStatus && (
                <div className={`p-3 rounded-lg text-sm font-medium ${
                  autoTaxStatus === '課税' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 border border-gray-200'
                }`}>
                  判定結果: {autoTaxStatus}事業者
                  {autoTaxStatus === '課税' && canSimplified && '（簡易課税選択可）'}
                  {autoTaxStatus === '課税' && !canSimplified && '（簡易課税不可：基準期間売上 5,000万超）'}
                </div>
              )}
            </div>
          )}

          {/* Q3: 組織再編 */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-bold text-gray-800">Q3. 組織再編の有無</h2>
              <Tip text="合併・会社分割・株式交換・増減資等がある場合、消費税の納税義務判定に影響します。登記簿謄本から自動検知した情報も含めて確認してください。" />
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">直近2期以内の組織再編</label>
                <div className="flex gap-3">
                  {['なし', 'あり（要確認）'].map((v) => (
                    <button
                      key={v}
                      onClick={() => set('notes', { ...((settings.notes as Record<string, unknown>) || {}), reorganization: v })}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        ((settings.notes as Record<string, unknown>)?.reorganization ?? 'なし') === v
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Q4: 消費税確認 */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-bold text-gray-800">Q4. 消費税の最終確認</h2>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">納税義務</label>
                <div className="flex gap-3">
                  {['課税', '免税'].map((v) => (
                    <button
                      key={v}
                      onClick={() => set('consumption_tax_status', v)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        settings.consumption_tax_status === v
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      {v}事業者
                    </button>
                  ))}
                </div>
                {autoTaxStatus && settings.consumption_tax_status !== autoTaxStatus && (
                  <p className="text-xs text-orange-600 mt-1">⚠ Q2の売上データからの自動判定（{autoTaxStatus}）と異なります</p>
                )}
              </div>
              {settings.consumption_tax_status === '課税' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">課税方式</label>
                    <div className="flex gap-2 flex-wrap">
                      {['本則課税', '簡易課税', '2割特例'].map((v) => (
                        <button
                          key={v}
                          onClick={() => set('consumption_tax_method', v)}
                          disabled={v === '簡易課税' && !canSimplified}
                          className={`px-3 py-2 rounded-lg border text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            settings.consumption_tax_method === v
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  {settings.consumption_tax_method === '簡易課税' && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">簡易課税の業種区分</label>
                      <select
                        value={settings.simplified_tax_category}
                        onChange={(e) => set('simplified_tax_category', e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm w-full"
                      >
                        <option value="">選択してください</option>
                        {SIMPLIFIED_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">経理方式</label>
                    <div className="flex gap-3">
                      {['税抜', '税込'].map((v) => (
                        <button
                          key={v}
                          onClick={() => set('accounting_method', v)}
                          className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                            settings.accounting_method === v
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                          }`}
                        >
                          {v}経理
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Q5-11: その他 */}
          {step === 5 && (
            <div className="space-y-5">
              <h2 className="font-bold text-gray-800">Q5–Q11. その他設定</h2>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Q8. 従業員の有無</label>
                <div className="flex gap-3">
                  {[['あり', true], ['なし', false]].map(([label, val]) => (
                    <button
                      key={String(label)}
                      onClick={() => set('has_employees', val as boolean)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        settings.has_employees === val
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      {String(label)}
                    </button>
                  ))}
                </div>
              </div>
              {settings.has_employees && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">給与計算の主体</label>
                  <select
                    value={settings.payroll_method}
                    onChange={(e) => set('payroll_method', e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm w-full max-w-xs"
                  >
                    <option value="">選択</option>
                    {['自社', '社労士', '当事務所', 'ソフト（freee等）'].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Q9. リース取引の有無</label>
                <div className="flex gap-3">
                  {[['あり', true], ['なし', false]].map(([label, val]) => (
                    <button
                      key={String(label)}
                      onClick={() => set('has_lease', val as boolean)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        settings.has_lease === val
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      {String(label)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Q6. 部門別会計</label>
                <div className="flex gap-3">
                  {[['あり', true], ['なし', false]].map(([label, val]) => (
                    <button
                      key={String(label)}
                      onClick={() => set('has_department_accounting', val as boolean)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        settings.has_department_accounting === val
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      {String(label)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ナビゲーション */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 flex items-center gap-1"
            >
              <ArrowLeft size={14} /> 前へ
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {saving ? '保存中…' : '一時保存'}
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => { save(false); setStep(step + 1) }}
                  className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-1"
                >
                  次へ <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  onClick={() => save(true)}
                  disabled={saving}
                  className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"
                >
                  {saved ? <><CheckCircle2 size={14} /> 完了！</> : '設定完了'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
