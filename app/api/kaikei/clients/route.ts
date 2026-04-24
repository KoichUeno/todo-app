import { NextResponse } from 'next/server'
import { requireAuth, getServiceClient } from '@/lib/api-auth'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  const db = getServiceClient()

  const { data: clients, error: clientErr } = await db
    .from('clients')
    .select('id, name, client_type, fiscal_month')
    .order('name')

  if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 500 })

  const clientIds = (clients ?? []).map((c) => c.id)
  if (clientIds.length === 0) return NextResponse.json([])

  const currentYM = new Date().toISOString().slice(0, 7)

  const { data: settings } = await db
    .from('kaikei_client_settings')
    .select('client_id, fiscal_month, mode, submission_cycle, setup_completed_at')
    .in('client_id', clientIds)

  const { data: periods } = await db
    .from('kaikei_monthly_periods')
    .select('id, client_id, period_ym, status')
    .in('client_id', clientIds)
    .eq('period_ym', currentYM)

  const { data: issues } = await db
    .from('kaikei_issues')
    .select('client_id, status')
    .in('client_id', clientIds)
    .eq('status', '未完了')

  const settingsMap = Object.fromEntries((settings ?? []).map((s) => [s.client_id, s]))
  const periodMap = Object.fromEntries((periods ?? []).map((p) => [p.client_id, p]))
  const issueCountMap: Record<string, number> = {}
  for (const issue of issues ?? []) {
    issueCountMap[issue.client_id] = (issueCountMap[issue.client_id] ?? 0) + 1
  }

  const result = (clients ?? []).map((c) => ({
    ...c,
    kaikei_settings: settingsMap[c.id] ?? null,
    current_period: periodMap[c.id] ?? null,
    open_issues: issueCountMap[c.id] ?? 0,
  }))

  return NextResponse.json(result)
}
