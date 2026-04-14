import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cookie ベースでセッションを保持するため createBrowserClient を使用。
// これにより API Route (サーバー側) が createServerClient + cookies() で
// 同じセッションを読めるようになる。
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
