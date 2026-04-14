import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getServiceClient } from '@/lib/api-auth'

// プロフィール一覧を取得
export async function GET() {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const { data, error } = await getServiceClient()
    .from('profiles')
    .select('*')
    .order('login_id', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// プロフィールを更新（管理者が使う）
export async function PATCH(request: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { id, ...updates } = body

  const { data, error } = await getServiceClient()
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
