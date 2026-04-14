import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getServiceClient } from '@/lib/api-auth'

// ユーザーをIDとパスワードで作成する (管理者のみ)
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const supabaseAdmin = getServiceClient()
  const body = await request.json()
  const { login_id, password, name, role } = body

  if (!login_id || !password || !name) {
    return NextResponse.json({ error: 'login_id, password and name are required' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'パスワードは6文字以上で設定してください' }, { status: 400 })
  }

  // 内部メールアドレス（ユーザーには見えない）
  const email = `${login_id}@todo-app.internal`

  // Supabase Auth でユーザーを作成
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // profilesテーブルに登録（password_plainも保存 - 旧挙動維持）
  await supabaseAdmin
    .from('profiles')
    .upsert({ id: data.user.id, name, role, login_id, password_plain: password }, { onConflict: 'id' })

  return NextResponse.json({ success: true })
}

// ユーザーのパスワードをリセットする (管理者のみ)
export async function PATCH(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const supabaseAdmin = getServiceClient()
  const body = await request.json()
  const { user_id, new_password } = body

  if (!user_id || !new_password) {
    return NextResponse.json({ error: 'user_id and new_password are required' }, { status: 400 })
  }

  if (new_password.length < 6) {
    return NextResponse.json({ error: 'パスワードは6文字以上で設定してください' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
    password: new_password,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabaseAdmin.from('profiles').update({ password_plain: new_password }).eq('id', user_id)

  return NextResponse.json({ success: true })
}

// ユーザーを削除する (管理者のみ)
export async function DELETE(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const supabaseAdmin = getServiceClient()
  const { searchParams } = new URL(request.url)
  const user_id = searchParams.get('user_id')

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  await supabaseAdmin.from('profiles').delete().eq('id', user_id)

  const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
