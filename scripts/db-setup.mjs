import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://vgacihxzdbcfdcevsale.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnYWNpaHh6ZGJjZmRjZXZzYWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDA2NTI0NiwiZXhwIjoyMDg5NjQxMjQ2fQ.opKvnglk9baAwoN7WAXYbb527BN7Zcwq4Qs_ZsI0UDo'
)

// 現在のprofilesを取得
const { data, error } = await supabase.from('profiles').select('name, login_id, role, password_plain, department').order('login_id', { ascending: true, nullsFirst: false })

if (error) {
  console.error('エラー:', error.message)
  console.log('\n→ password_plainカラムがまだ存在しません。Supabaseのダッシュボードで以下のSQLを実行してください:')
  console.log('\nALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_plain text;')
  console.log('UPDATE profiles SET role = \'管理者\' WHERE name = \'上野　晃一\' OR name = \'上野晃一\';')
} else {
  console.log('\n=== 現在のユーザー一覧 ===\n')
  console.log('No. | 名前 | ログインID | 権限 | パスワード')
  console.log('----+------+------------+------+----------')
  data.forEach((p, i) => {
    const no = String(i + 1).padStart(2)
    const name = (p.name || '(名前なし)').padEnd(12)
    const id = (p.login_id || '(未設定)').padEnd(12)
    const role = (p.role || '担当者').padEnd(6)
    const pw = p.password_plain || '(未設定)'
    console.log(`${no}  | ${name} | ${id} | ${role} | ${pw}`)
  })
}
