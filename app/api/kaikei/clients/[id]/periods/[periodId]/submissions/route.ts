import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getServiceClient } from '@/lib/api-auth'

type Params = { params: Promise<{ id: string; periodId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error
  const { periodId } = await params
  const { category, status, notes } = await req.json()
  const db = getServiceClient()

  const updateData: Record<string, unknown> = { status }
  if (notes !== undefined) updateData.notes = notes
  if (status === '提出済') updateData.submitted_at = new Date().toISOString()
  if (status === '完了宣言済') updateData.completed_at = new Date().toISOString()

  const { data, error: err } = await db
    .from('kaikei_monthly_submissions')
    .update(updateData)
    .eq('period_id', periodId)
    .eq('category', category)
    .select()
    .single()

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  // 預金カテゴリの場合：全銀行口座が提出済なら自動完了
  if (category === '預金' && status === '提出済') {
    const { data: bankStatuses } = await db
      .from('kaikei_bank_submission_status')
      .select('status')
      .eq('period_id', periodId)

    const allSubmitted = (bankStatuses ?? []).every((b) => b.status === '提出済')
    if (allSubmitted && (bankStatuses ?? []).length > 0) {
      await db
        .from('kaikei_monthly_submissions')
        .update({ status: '完了宣言済', completed_at: new Date().toISOString() })
        .eq('period_id', periodId)
        .eq('category', '預金')
    }
  }

  return NextResponse.json(data)
}
