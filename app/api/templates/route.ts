import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// テンプレート一覧を取得
export async function GET() {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// テンプレートを追加
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { title } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'タイトルは必須です' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('templates')
    .insert({ title })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// テンプレートを削除
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })

  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
