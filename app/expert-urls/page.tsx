"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Copy, Check, ExternalLink, ShieldCheck } from "lucide-react";

type Profile = {
  id: string;
  name: string;
  department: string;
  role: string;
  login_id?: string;
  password_plain?: string;
};

export default function ExpertUrlsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [experts, setExperts] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appUrl, setAppUrl] = useState("");

  useEffect(() => {
    setAppUrl(window.location.origin);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/auth"); return; }

      const res = await fetch("/api/profiles");
      if (res.ok) {
        const allProfiles: Profile[] = await res.json();
        const myProfile = allProfiles.find((p) => p.id === session.user.id);
        const adminRoles = ["IT担当", "経営者", "管理者", "admin"];
        if (!myProfile || !adminRoles.includes(myProfile.role)) {
          router.push("/");
          return;
        }
        setIsAdmin(true);
        const expertProfiles = allProfiles
          .filter((p) => p.role === "AI専門家")
          .slice(0, 10);
        setExperts(expertProfiles);
      }
      setLoading(false);
    });
  }, []);

  const buildAccessText = (profile: Profile) => {
    const loginUrl = `${appUrl}/auth`;
    const lines = [
      `【アクセス情報】`,
      `URL: ${loginUrl}`,
      `ログインID: ${profile.login_id || "(未設定)"}`,
      `パスワード: ${profile.password_plain || "(未設定)"}`,
    ];
    return lines.join("\n");
  };

  const handleCopy = async (profile: Profile) => {
    try {
      await navigator.clipboard.writeText(buildAccessText(profile));
      setCopiedId(profile.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback: select text
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  const loginUrl = `${appUrl}/auth`;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">AI専門家 アクセスURL</h1>
            <p className="text-sm text-gray-400 mt-1">AI専門家ロールのユーザーにアクセス情報を共有できます（最大10名）</p>
          </div>
          <button
            onClick={() => router.push("/master")}
            className="text-sm text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            ← マスター管理
          </button>
        </div>

        {/* アプリURL */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-blue-500 font-semibold mb-0.5">アプリのログインURL</p>
            <p className="text-sm font-mono text-blue-700 break-all">{loginUrl}</p>
          </div>
          <a
            href={loginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
          >
            <ExternalLink size={16} />
          </a>
        </div>

        {/* 専門家リスト */}
        {experts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <ShieldCheck size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400 mb-1">AI専門家ロールのユーザーがいません</p>
            <p className="text-xs text-gray-300">マスター管理でユーザーを「AI専門家」ロールで登録してください</p>
            <button
              onClick={() => router.push("/master")}
              className="mt-4 text-xs text-blue-500 hover:text-blue-700 underline"
            >
              マスター管理へ
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {experts.map((expert, idx) => (
              <div
                key={expert.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-semibold w-5">{idx + 1}</span>
                    <p className="text-sm font-bold text-gray-800">{expert.name || "(名前未設定)"}</p>
                    {expert.department && (
                      <span className="text-xs text-gray-400">{expert.department}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleCopy(expert)}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      copiedId === expert.id
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-500"
                    }`}
                  >
                    {copiedId === expert.id ? (
                      <><Check size={12} /> コピー済み</>
                    ) : (
                      <><Copy size={12} /> アクセス情報をコピー</>
                    )}
                  </button>
                </div>

                <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs font-mono text-gray-600 space-y-1">
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-20 shrink-0">URL</span>
                    <span className="text-blue-600 break-all">{loginUrl}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-20 shrink-0">ログインID</span>
                    <span className="text-gray-700">{expert.login_id || <span className="text-gray-300">未設定</span>}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-20 shrink-0">パスワード</span>
                    <span className="text-gray-700">{expert.password_plain || <span className="text-gray-300">未設定</span>}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
