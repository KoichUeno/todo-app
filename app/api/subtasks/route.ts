import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// サブタスクを追加
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { task_id, title, description, order_num, assignee, important_note, due_date } = body

  const { data, error } = await supabase
    .from('subtasks')
    .insert({ task_id, title, description, order_num, assignee, important_note, due_date })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// サブタスクを更新
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, ...updates } = body

  const { data, error } = await supabase
    .from('subtasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// サブタスクを削除
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase
    .from('subtasks')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
