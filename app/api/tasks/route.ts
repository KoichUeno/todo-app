import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getServiceClient } from '@/lib/api-auth'

// タスク一覧を取得
export async function GET() {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const { data, error } = await getServiceClient()
    .from('tasks')
    .select('*, subtasks(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// タスクナンバーを自動採番（案件区分＋年＋月＋連番3桁）
async function generateTaskNumber(taskType: string): Promise<string> {
  const prefix = taskType || '他';
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const base = `${prefix}${yyyy}${mm}`;

  const { data } = await getServiceClient()
    .from('tasks')
    .select('task_number')
    .like('task_number', `${base}%`)
    .order('task_number', { ascending: false })
    .limit(1);

  let seq = 1;
  if (data && data.length > 0 && data[0].task_number) {
    const lastSeq = parseInt(data[0].task_number.replace(base, ''), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${base}${String(seq).padStart(3, '0')}`;
}

// タスクを追加
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { title, description, due_date, important_note, assignee, project_name, is_recurring, importance, category, client_type, task_type, data_location, client_id } = body

  const task_number = await generateTaskNumber(task_type);

  const { data, error } = await getServiceClient()
    .from('tasks')
    .insert({ title, description, due_date, important_note, assignee, project_name, is_recurring, importance, category, client_type, task_type, data_location, client_id, task_number })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// タスクを更新
export async function PATCH(request: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { id, ...updates } = body

  const { data, error } = await getServiceClient()
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
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await getServiceClient()
    .from('tasks')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
