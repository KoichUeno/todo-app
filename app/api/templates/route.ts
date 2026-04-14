import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getServiceClient } from '@/lib/api-auth'

// テンプレート一覧を取得
export async function GET() {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const { data, error } = await getServiceClient()
    .from('templates')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// テンプレートを追加
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { title } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'タイトルは必須です' }, { status: 400 })
  }

  const { data, error } = await getServiceClient()
    .from('templates')
    .insert({ title })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// テンプレートを削除
export async function DELETE(request: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })

  const { error } = await getServiceClient()
    .from('templates')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
