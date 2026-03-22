"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ログインIDを内部メールアドレスに変換
  // "@" が含まれていればそのまま（管理者アカウント等）、なければ @todo-app.internal を付与
  const toEmail = (id: string) =>
    id.includes("@") ? id : `${id}@todo-app.internal`;

  const handleLogin = async () => {
    if (!loginId || !password) {
      setMessage("ログインIDとパスワードを入力してください");
      return;
    }
    setLoading(true);
    setMessage("");

    const email = toEmail(loginId.trim());
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage("ログインに失敗しました。IDまたはパスワードを確認してください。");
    } else {
      router.push("/");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">タスク管理</h1>
        <p className="text-sm text-gray-500 mb-6">ログインIDとパスワードを入力してください</p>

        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="ログインID"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
            autoComplete="current-password"
          />

          {message && (
            <p className="text-xs px-1 text-red-500">{message}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? "処理中..." : "ログイン"}
          </button>
        </div>
      </div>
    </div>
  );
}
