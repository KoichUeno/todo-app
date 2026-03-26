import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const results: string[] = []

  // tasksにcategoryカラムを追加（存在チェック付き）
  const { error: e1 } = await supabaseAdmin.rpc('exec_migration', {
    sql: 'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category text'
  })

  // rpcが使えない場合はinsertで確認
  const { error: checkTask } = await supabaseAdmin
    .from('tasks')
    .select('category')
    .limit(1)

  if (checkTask?.message?.includes('column tasks.category does not exist')) {
    results.push('❌ tasks.category カラムが存在しません。Supabaseダッシュボードで手動実行が必要です。')
  } else {
    results.push('✅ tasks.category カラムOK')
  }

  // profilesにpassword_plainカラムを確認
  const { error: checkProfile } = await supabaseAdmin
    .from('profiles')
    .select('password_plain')
    .limit(1)

  if (checkProfile?.message?.includes('column profiles.password_plain does not exist')) {
    results.push('❌ profiles.password_plain カラムが存在しません。Supabaseダッシュボードで手動実行が必要です。')
  } else {
    results.push('✅ profiles.password_plain カラムOK')
  }

  // task_numberカラム確認
  const { error: checkTaskNum } = await supabaseAdmin
    .from('tasks')
    .select('task_number')
    .limit(1)

  if (checkTaskNum?.message?.includes('task_number')) {
    results.push('❌ tasks.task_number カラムが存在しません')
  } else {
    results.push('✅ tasks.task_number カラムOK')
  }

  // subtasks.statusカラム確認
  const { error: checkSubStatus } = await supabaseAdmin
    .from('subtasks')
    .select('status')
    .limit(1)

  if (checkSubStatus?.message?.includes('status')) {
    results.push('❌ subtasks.status カラムが存在しません')
  } else {
    results.push('✅ subtasks.status カラムOK')
  }

  // 上野晃一の権限確認
  const { data: adminCheck } = await supabaseAdmin
    .from('profiles')
    .select('name, role')
    .or("name.eq.上野晃一,name.eq.上野　晃一")

  results.push(`管理者確認: ${JSON.stringify(adminCheck)}`)

  return NextResponse.json({
    results,
    sql_to_run: [
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category text;',
      'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_number text;',
      'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_plain text;',
      "ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS status text DEFAULT '未着手';",
      "UPDATE subtasks SET status = CASE WHEN is_completed = true THEN '完了' ELSE '未着手' END WHERE status IS NULL;",
      "UPDATE profiles SET role = '管理者' WHERE name = '上野　晃一' OR name = '上野晃一';"
    ]
  })
}
