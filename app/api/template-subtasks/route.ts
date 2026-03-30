import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// テンプレートのサブタスク一覧を取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const template_id = searchParams.get('template_id')

  if (!template_id) return NextResponse.json({ error: 'template_id is required' }, { status: 400 })

  const { data, error } = await getSupabase()
    .from('template_subtasks')
    .select('*')
    .eq('template_id', template_id)
    .order('order_num', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// テンプレートにサブタスクを追加
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { template_id, title, assignee, order_num } = body

  const { data, error } = await getSupabase()
    .from('template_subtasks')
    .insert({ template_id, title, assignee, order_num })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// テンプレートのサブタスクを削除
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await getSupabase()
    .from('template_subtasks')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
