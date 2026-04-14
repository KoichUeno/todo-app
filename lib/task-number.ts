import { SupabaseClient } from '@supabase/supabase-js'

// タスクナンバーを自動採番（案件区分＋年＋月＋連番3桁）
// 例: "他202604001"
export async function generateTaskNumber(
  supabase: SupabaseClient,
  taskType: string | null | undefined
): Promise<string> {
  const prefix = taskType || '他'
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const base = `${prefix}${yyyy}${mm}`

  const { data } = await supabase
    .from('tasks')
    .select('task_number')
    .like('task_number', `${base}%`)
    .order('task_number', { ascending: false })
    .limit(1)

  let seq = 1
  if (data && data.length > 0 && data[0].task_number) {
    const lastSeq = parseInt(data[0].task_number.replace(base, ''), 10)
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }

  return `${base}${String(seq).padStart(3, '0')}`
}
