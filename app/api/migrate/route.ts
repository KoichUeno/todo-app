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
      'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_plain text;',
      "UPDATE profiles SET role = '管理者' WHERE name = '上野　晃一' OR name = '上野晃一';"
    ]
  })
}
