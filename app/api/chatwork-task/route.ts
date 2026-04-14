import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'
import { generateTaskNumber } from '@/lib/task-number'

/**
 * Chatwork → GAS → このエンドポイント経由でタスク+サブタスクを一括作成する。
 * 認証: Bearer <CHATWORK_TASK_TOKEN> (環境変数)
 * - ユーザーセッションは使わない (GAS はサーバー間通信のため)
 * - トークンが無い / 不一致 → 401
 *
 * Body:
 * {
 *   title: string,          // 必須
 *   description?: string,
 *   due_date?: string,      // YYYY-MM-DD
 *   assignee?: string,
 *   client_id?: string,
 *   client_name?: string,   // client_id が無い場合に名前から解決
 *   importance?: string,    // "最高" | "高" | "通常" | "低"
 *   category?: string,
 *   subtasks?: Array<{ title: string; assignee?: string }>
 * }
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CHATWORK_TASK_TOKEN
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'CHATWORK_TASK_TOKEN is not set on server' },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token || token !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // 顧客名 → client_id の解決 (client_id 未指定時)
  let clientId: string | null = typeof body.client_id === 'string' ? body.client_id : null
  if (!clientId && typeof body.client_name === 'string' && body.client_name.trim()) {
    const clientName = body.client_name.trim()
    const { data: clients } = await supabase.from('clients').select('id, name')
    if (clients) {
      const matched =
        clients.find((c) => c.name === clientName) ||
        clients.find((c) => clientName.includes(c.name))
      if (matched) clientId = matched.id
    }
  }

  const taskType =
    typeof body.task_type === 'string' && body.task_type.trim() ? body.task_type : 'スポット'
  const task_number = await generateTaskNumber(supabase, taskType)

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      title,
      description: typeof body.description === 'string' ? body.description : null,
      due_date: typeof body.due_date === 'string' ? body.due_date : null,
      assignee: typeof body.assignee === 'string' ? body.assignee : null,
      importance: typeof body.importance === 'string' ? body.importance : '通常',
      category: typeof body.category === 'string' ? body.category : null,
      client_id: clientId,
      task_type: taskType,
      task_number,
      status: '進行中',
    })
    .select()
    .single()

  if (taskError || !task) {
    return NextResponse.json(
      { ok: false, error: taskError?.message || 'failed to create task' },
      { status: 500 }
    )
  }

  // サブタスクを順に登録 (配列の順序がそのまま order_num になる)
  const subtasks: Array<{ title: string; assignee?: string }> = Array.isArray(body.subtasks)
    ? (body.subtasks as Array<{ title?: unknown; assignee?: unknown }>)
        .map((s, i) => ({
          title: typeof s?.title === 'string' ? s.title.trim() : '',
          assignee: typeof s?.assignee === 'string' ? s.assignee : undefined,
          _index: i,
        }))
        .filter((s) => s.title.length > 0)
    : []

  const createdSubtasks: Array<{ id: string; title: string }> = []
  for (let i = 0; i < subtasks.length; i++) {
    const s = subtasks[i]
    const { data: created, error: subErr } = await supabase
      .from('subtasks')
      .insert({
        task_id: task.id,
        title: s.title,
        assignee: s.assignee ?? null,
        order_num: i + 1,
      })
      .select('id, title')
      .single()
    if (subErr) {
      // 1 件の失敗でタスクごとロールバックはしない (ログに残すのみ)
      console.error('subtask insert failed:', subErr.message)
      continue
    }
    if (created) createdSubtasks.push(created)
  }

  return NextResponse.json({
    ok: true,
    task_id: task.id,
    task_number: task.task_number,
    title: task.title,
    subtasks_created: createdSubtasks.length,
  })
}
