import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getServiceClient } from '@/lib/api-auth'

// メモ一覧を取得（subtask_id指定）
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const subtaskId = searchParams.get('subtask_id')

  if (!subtaskId) return NextResponse.json({ error: 'subtask_id is required' }, { status: 400 })

  const { data, error } = await getServiceClient()
    .from('subtask_memos')
    .select('*')
    .eq('subtask_id', subtaskId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// メモを追加
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { subtask_id, content, user_name } = body

  if (!subtask_id || !content) {
    return NextResponse.json({ error: 'subtask_id and content are required' }, { status: 400 })
  }

  const { data, error } = await getServiceClient()
    .from('subtask_memos')
    .insert({ subtask_id, content, user_name })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// メモを削除
export async function DELETE(request: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await getServiceClient()
    .from('subtask_memos')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
