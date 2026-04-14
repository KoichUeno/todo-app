import { NextRequest, NextResponse } from 'next/server'

// Optimistic auth check.
// Per Next.js 16 docs, Proxy must avoid slow data fetching, so we do NOT call
// supabase.auth.getUser() here (that was the old middleware's behavior and
// caused MIDDLEWARE_INVOCATION_TIMEOUT on Vercel).
// Instead, we just look for the presence of a Supabase auth cookie.
// Real session verification still happens in API routes / server components.
const SUPABASE_AUTH_COOKIE_REGEX = /^sb-.+-auth-token(\.\d+)?$/

export function proxy(request: NextRequest) {
  // /auth 自体はチェック対象外
  if (request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.next()
  }

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => SUPABASE_AUTH_COOKIE_REGEX.test(cookie.name))

  // ログインしていない場合、/auth へリダイレクト
  if (!hasAuthCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
