import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export type AuthedProfile = {
  id: string
  name: string | null
  role: string | null
  login_id: string | null
  department: string | null
}

/**
 * Cookie に入っている Supabase セッションを検証し、
 * ログイン中のプロフィール情報を返す。未ログインなら null。
 *
 * フロント側は lib/supabase.ts の createBrowserClient を使うと
 * 自動で cookie にセッションが書かれるので、ここでそれを読む。
 */
export async function getAuthedProfile(): Promise<AuthedProfile | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          // Route Handler では cookie 書き込みは不要 (read-only 前提)
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // プロフィール情報はサービスロールで取得 (RLS バイパス)
  const service = getServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('id, name, role, login_id, department')
    .eq('id', user.id)
    .maybeSingle()

  return profile ?? null
}

/**
 * API Route の先頭で使う認証チェック。
 *   const { profile, error } = await requireAuth()
 *   if (error) return error
 */
export async function requireAuth(): Promise<
  { profile: AuthedProfile; error: null } | { profile: null; error: NextResponse }
> {
  const profile = await getAuthedProfile()
  if (!profile) {
    return {
      profile: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { profile, error: null }
}

const ADMIN_ROLES = ['admin', '管理者', 'IT担当', '経営者']

/**
 * 管理者ロールのみ許可する API Route 用のチェック。
 */
export async function requireAdmin(): Promise<
  { profile: AuthedProfile; error: null } | { profile: null; error: NextResponse }
> {
  const result = await requireAuth()
  if (result.error) return result
  if (!result.profile.role || !ADMIN_ROLES.includes(result.profile.role)) {
    return {
      profile: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }
  return result
}

/**
 * DB 操作用の service role クライアント (RLS バイパス)。
 * 既存の個別 createClient 呼び出しを置き換える。
 */
export function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
