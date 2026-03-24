import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// タスク一覧を取得
export async function GET() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, subtasks(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// タスクを追加
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { title, description, due_date, important_note, assignee, project_name, is_recurring, importance, category } = body

  const { data, error } = await supabase
    .from('tasks')
    .insert({ title, description, due_date, important_note, assignee, project_name, is_recurring, importance, category })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// タスクを更新（完了/未完了の切り替えなど）
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, ...updates } = body

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// タスクを削除
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
