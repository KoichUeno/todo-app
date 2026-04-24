import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getServiceClient } from '@/lib/api-auth'

type Params = { params: Promise<{ id: string }> }

const DEFAULT_CATEGORIES = ['預金', '領収書', '請求書', '売上', '仕入', '給与', 'その他']

export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error
  const { id } = await params
  const db = getServiceClient()

  const { data, error: err } = await db
    .from('kaikei_monthly_periods')
    .select('*, kaikei_monthly_submissions(*)')
    .eq('client_id', id)
    .order('period_ym', { ascending: false })
    .limit(12)

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error
  const { id } = await params
  const { period_ym } = await req.json()
  const db = getServiceClient()

  const { data: period, error: pErr } = await db
    .from('kaikei_monthly_periods')
    .upsert({ client_id: id, period_ym, status: '処理中' }, { onConflict: 'client_id,period_ym' })
    .select()
    .single()

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  // デフォルトカテゴリを作成（まだなければ）
  const submissionRows = DEFAULT_CATEGORIES.map((cat) => ({
    period_id: period.id,
    category: cat,
    status: '未提出',
  }))

  await db
    .from('kaikei_monthly_submissions')
    .upsert(submissionRows, { onConflict: 'period_id,category', ignoreDuplicates: true })

  return NextResponse.json(period, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error
  const { id: clientId } = await params
  const { period_id, status, reviewer } = await req.json()
  const db = getServiceClient()

  const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (reviewer) updateData.reviewer = reviewer
  if (status === '承認済') {
    updateData.approved_at = new Date().toISOString()
  }

  const { data, error: err } = await db
    .from('kaikei_monthly_periods')
    .update(updateData)
    .eq('id', period_id)
    .eq('client_id', clientId)
    .select()
    .single()

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json(data)
}
