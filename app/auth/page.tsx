"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async () => {
    if (!email || !password) {
      setMessage("メールアドレスとパスワードを入力してください");
      return;
    }
    setLoading(true);
    setMessage("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage("ログインに失敗しました：" + error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage("登録に失敗しました：" + error.message);
      } else {
        setMessage("確認メールを送信しました。メールを確認してください。");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">タスク管理</h1>
        <p className="text-sm text-gray-500 mb-6">
          {mode === "login" ? "ログインして始めましょう" : "新しいアカウントを作成"}
        </p>

        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => { setMode("login"); setMessage(""); }}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${
              mode === "login" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
            }`}
          >
            ログイン
          </button>
          <button
            onClick={() => { setMode("signup"); setMessage(""); }}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${
              mode === "signup" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
            }`}
          >
            新規登録
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <input
            type="password"
            placeholder="パスワード（6文字以上）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />

          {message && (
            <p className={`text-xs px-1 ${message.includes("送信") ? "text-green-600" : "text-red-500"}`}>
              {message}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? "処理中..." : mode === "login" ? "ログイン" : "アカウント作成"}
          </button>
        </div>
      </div>
    </div>
  );
}
