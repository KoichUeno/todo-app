"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { User, ClipboardList, ChevronDown, ChevronUp, AlertTriangle, ShieldCheck, UserRound, Plus } from "lucide-react";

type Profile = {
  id: string;
  name: string;
  department: string;
  role: string;
  login_id?: string;
  password_plain?: string;
};

type TemplateSubtask = {
  id: string;
  template_id: string;
  title: string;
  assignee: string;
  important_note?: string;
  order_num: number;
};

type Template = {
  id: string;
  title: string;
};

export default function MasterPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [tab, setTab] = useState<"users" | "templates">("users");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  // ユーザー
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editRole, setEditRole] = useState("担当者");
  const [editLoginId, setEditLoginId] = useState("");

  // 新規ユーザー登録
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLoginId, setInviteLoginId] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("担当者");
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");

  // パスワードリセット
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  // テンプレート
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateSubtasksMap, setTemplateSubtasksMap] = useState<Record<string, TemplateSubtask[]>>({});
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");

  // 新サブタスク入力
  const [newSubTitle, setNewSubTitle] = useState<Record<string, string>>({});
  const [newSubAssignee, setNewSubAssignee] = useState<Record<string, string>>({});
  const [newSubNote, setNewSubNote] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/auth"); return; }

      const res = await fetch("/api/profiles");
      if (res.ok) {
        const allProfiles = await res.json();
        const myProfile = allProfiles.find((p: Profile) => p.id === session.user.id);
        const adminRoles = ["IT担当", "経営者", "管理者", "admin"];
        if (!myProfile || !adminRoles.includes(myProfile.role)) {
          router.push("/");
          return;
        }
        setProfiles(allProfiles);
        setIsAdmin(true);
        setCurrentUserRole(myProfile.role);
      }
      fetchTemplates();
    });
  }, []);

  const fetchProfiles = async () => {
    const res = await fetch("/api/profiles");
    if (res.ok) setProfiles(await res.json());
  };

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`「${userName}」を削除しますか？この操作は取り消せません。`)) return;
    const res = await fetch(`/api/invite-user?user_id=${userId}`, { method: "DELETE" });
    if (res.ok) {
      setProfiles((prev) => prev.filter((p) => p.id !== userId));
    } else {
      const err = await res.json();
      alert(`削除に失敗しました: ${err.error}`);
    }
  };

  const fetchTemplates = async () => {
    const res = await fetch("/api/templates");
    if (res.ok) setTemplates(await res.json());
  };

  const fetchTemplateSubtasks = async (templateId: string) => {
    if (templateSubtasksMap[templateId]) return;
    const res = await fetch(`/api/template-subtasks?template_id=${templateId}`);
    if (res.ok) {
      const data = await res.json();
      setTemplateSubtasksMap((prev) => ({ ...prev, [templateId]: data || [] }));
    }
  };

  const saveProfile = async () => {
    if (!editingProfile) return;
    await fetch("/api/profiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingProfile.id, name: editName, department: editDept, role: editRole, login_id: editLoginId }),
    });
    setProfiles((prev) =>
      prev.map((p) => p.id === editingProfile.id ? { ...p, name: editName, department: editDept, role: editRole, login_id: editLoginId } : p)
    );
    setEditingProfile(null);
  };

  const registerUser = async () => {
    if (!inviteLoginId.trim() || !invitePassword.trim() || !inviteName.trim()) return;
    setInviting(true);
    setInviteMessage("");
    try {
      const res = await fetch("/api/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id: inviteLoginId.trim(), password: invitePassword, name: inviteName.trim(), role: inviteRole }),
      });
      if (res.ok) {
        setInviteMessage(`「${inviteName}」さんを登録しました`);
        setInviteLoginId("");
        setInvitePassword("");
        setInviteName("");
        setInviteRole("担当者");
        setTimeout(() => { setShowInvite(false); setInviteMessage(""); fetchProfiles(); }, 2000);
      } else {
        const err = await res.json();
        setInviteMessage(`エラー: ${err.error || "登録に失敗しました"}`);
      }
    } finally {
      setInviting(false);
    }
  };

  const resetUserPassword = async () => {
    if (!resetUserId || !resetPassword.trim()) return;
    const res = await fetch("/api/invite-user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: resetUserId, new_password: resetPassword }),
    });
    if (res.ok) {
      setResetMessage("パスワードを変更しました");
      setTimeout(() => { setResetUserId(null); setResetPassword(""); setResetMessage(""); }, 2000);
    } else {
      const err = await res.json();
      setResetMessage(`エラー: ${err.error}`);
    }
  };

  const addTemplate = async () => {
    if (!newTemplateTitle.trim()) return;
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTemplateTitle.trim() }),
    });
    if (res.ok) {
      const t = await res.json();
      setTemplates((prev) => [...prev, t]);
      setNewTemplateTitle("");
    }
  };

  const deleteTemplate = async (id: string) => {
    await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (expandedTemplate === id) setExpandedTemplate(null);
  };

  const addSubtask = async (templateId: string) => {
    const title = newSubTitle[templateId]?.trim();
    if (!title) return;
    const assignee = newSubAssignee[templateId] || "";
    const important_note = newSubNote[templateId] || "";
    const order_num = (templateSubtasksMap[templateId]?.length ?? 0) + 1;
    const res = await fetch("/api/template-subtasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: templateId, title, assignee, important_note, order_num }),
    });
    if (res.ok) {
      const sub = await res.json();
      setTemplateSubtasksMap((prev) => ({ ...prev, [templateId]: [...(prev[templateId] || []), sub] }));
      setNewSubTitle((p) => ({ ...p, [templateId]: "" }));
      setNewSubAssignee((p) => ({ ...p, [templateId]: "" }));
      setNewSubNote((p) => ({ ...p, [templateId]: "" }));
    }
  };

  const deleteSubtask = async (templateId: string, subtaskId: string) => {
    await fetch(`/api/template-subtasks?id=${subtaskId}`, { method: "DELETE" });
    setTemplateSubtasksMap((prev) => ({
      ...prev,
      [templateId]: (prev[templateId] || []).filter((s) => s.id !== subtaskId),
    }));
  };

  const toggleExpand = (templateId: string) => {
    if (expandedTemplate === templateId) {
      setExpandedTemplate(null);
    } else {
      setExpandedTemplate(templateId);
      fetchTemplateSubtasks(templateId);
    }
  };

  const roleLabel = (role: string) => {
    if (role === "admin") return "IT担当";
    if (["IT担当", "経営者", "管理者", "担当者"].includes(role)) return role;
    return "担当者";
  };

  const roleBadgeClass = (role: string) => {
    if (role === "IT担当" || role === "admin") return "bg-purple-100 text-purple-600";
    if (role === "経営者") return "bg-red-100 text-red-600";
    if (role === "管理者") return "bg-blue-100 text-blue-600";
    return "bg-gray-100 text-gray-500";
  };

  // パスワード表示権限：IT担当・経営者のみ
  const canViewPasswords = currentUserRole === "IT担当" || currentUserRole === "経営者" || currentUserRole === "admin";

  if (isAdmin === null) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">

        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">マスター管理</h1>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => router.push("/clients")} className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg font-semibold">
              クライアントマスター
            </button>
            <button onClick={() => router.push("/dashboard")} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">
              ダッシュボード
            </button>
            <button onClick={() => router.push("/")} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">
              タスク一覧
            </button>
          </div>
        </div>

        {/* タブ */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("users")}
            className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-colors ${tab === "users" ? "bg-blue-500 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
          >
            <User size={14} /> ユーザー
          </button>
          <button
            onClick={() => setTab("templates")}
            className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-colors ${tab === "templates" ? "bg-blue-500 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
          >
            <ClipboardList size={14} /> タスクテンプレート
          </button>
        </div>

        {/* ユーザータブ */}
        {tab === "users" && (
          <div>
            {/* 招待ボタン */}
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setShowInvite((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={13} /> ユーザーを登録
              </button>
            </div>

            {/* ユーザー登録フォーム */}
            {showInvite && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-4">
                <h3 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-1.5"><Plus size={14} /> 新しいユーザーを登録</h3>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="名前 *"
                      className="flex-1 min-w-[120px] border border-blue-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    />
                    <input
                      type="text"
                      value={inviteLoginId}
                      onChange={(e) => setInviteLoginId(e.target.value)}
                      placeholder="ログインID *"
                      className="flex-1 min-w-[120px] border border-blue-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                      autoComplete="off"
                    />
                    <input
                      type="password"
                      value={invitePassword}
                      onChange={(e) => setInvitePassword(e.target.value)}
                      placeholder="パスワード（6文字以上）*"
                      className="flex-1 min-w-[140px] border border-blue-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                      autoComplete="new-password"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-28 border border-blue-200 rounded-lg px-2 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value="IT担当">IT担当</option>
                      <option value="経営者">経営者</option>
                      <option value="管理者">管理者</option>
                      <option value="担当者">担当者</option>
                    </select>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={registerUser}
                      disabled={inviting}
                      className="text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {inviting ? "登録中..." : "登録する"}
                    </button>
                    <button
                      onClick={() => { setShowInvite(false); setInviteMessage(""); }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      キャンセル
                    </button>
                    {inviteMessage && (
                      <span className={`text-xs ml-2 ${inviteMessage.startsWith("エラー") ? "text-red-500" : "text-green-600"}`}>{inviteMessage}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-700">登録ユーザー一覧</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {profiles.map((profile) => (
                  <div key={profile.id} className="px-6 py-4">
                    {editingProfile?.id === profile.id ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2 flex-wrap">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="名前"
                            className="flex-1 min-w-[120px] border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            autoFocus
                          />
                          <input
                            value={editDept}
                            onChange={(e) => setEditDept(e.target.value)}
                            placeholder="部署"
                            className="flex-1 min-w-[120px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                          <input
                            value={editLoginId}
                            onChange={(e) => setEditLoginId(e.target.value)}
                            placeholder="ログインID"
                            className="flex-1 min-w-[120px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                          >
                            <option value="IT担当">IT担当</option>
                            <option value="経営者">経営者</option>
                            <option value="管理者">管理者</option>
                            <option value="担当者">担当者</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveProfile} className="text-xs text-blue-500 hover:text-blue-700 font-semibold">保存</button>
                          <button onClick={() => setEditingProfile(null)} className="text-xs text-gray-400 hover:text-gray-600">キャンセル</button>
                        </div>
                      </div>
                    ) : resetUserId === profile.id ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-gray-500">「{profile.name}」のパスワードをリセット</p>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder="新しいパスワード（6文字以上）"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            autoComplete="new-password"
                            autoFocus
                          />
                          <button onClick={resetUserPassword} className="text-xs text-blue-500 hover:text-blue-700 font-semibold">変更</button>
                          <button onClick={() => { setResetUserId(null); setResetPassword(""); setResetMessage(""); }} className="text-xs text-gray-400 hover:text-gray-600">キャンセル</button>
                        </div>
                        {resetMessage && <p className={`text-xs ${resetMessage.startsWith("エラー") ? "text-red-500" : "text-green-600"}`}>{resetMessage}</p>}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                              <UserRound size={14} className="text-gray-400" /> {profile.name}
                            </p>
                            <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${roleBadgeClass(profile.role)}`}>
                              {(profile.role === "担当者" || !profile.role) ? <UserRound size={9} /> : <ShieldCheck size={9} />}
                              {roleLabel(profile.role)}
                            </span>
                          </div>
                          {profile.department && <p className="text-xs text-gray-400 mt-0.5">{profile.department}</p>}
                          {profile.login_id && <p className="text-xs text-gray-400 mt-0.5">ID: {profile.login_id}</p>}
                          {canViewPasswords && profile.password_plain && (
                            <p className="text-xs text-gray-500 mt-0.5 font-mono">PW: {profile.password_plain}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setResetUserId(profile.id); setResetPassword(""); setResetMessage(""); setEditingProfile(null); }}
                            className="text-xs text-orange-400 hover:text-orange-600 transition-colors"
                          >
                            PW変更
                          </button>
                          <button
                            onClick={() => { setEditingProfile(profile); setEditName(profile.name); setEditDept(profile.department ?? ""); setEditRole(profile.role === "admin" ? "管理者" : (profile.role || "担当者")); setEditLoginId(profile.login_id ?? ""); setResetUserId(null); }}
                            className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => deleteUser(profile.id, profile.name)}
                            className="text-xs text-gray-300 hover:text-red-500 transition-colors"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {profiles.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-8">ユーザーが登録されていません</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* テンプレートタブ */}
        {tab === "templates" && (
          <div>
            {/* 新規テンプレート追加 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTemplate()}
                  placeholder="新しいテンプレート名を入力..."
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={addTemplate}
                  className="inline-flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                >
                  <Plus size={14} /> 追加
                </button>
              </div>
            </div>

            {/* テンプレート一覧 */}
            <div className="flex flex-col gap-3">
              {templates.map((template) => {
                const isExpanded = expandedTemplate === template.id;
                const subs = templateSubtasksMap[template.id] || [];
                return (
                  <div key={template.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* テンプレートヘッダー */}
                    <div className="flex items-center justify-between px-5 py-4">
                      <button
                        onClick={() => toggleExpand(template.id)}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <span className="text-sm font-bold text-gray-800">{template.title}</span>
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                          {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          サブタスク {isExpanded ? subs.length + "件" : ""}
                        </span>
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="text-xs text-gray-300 hover:text-red-400 transition-colors ml-4"
                      >
                        削除
                      </button>
                    </div>

                    {/* サブタスク一覧 */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-5 pb-4">
                        <p className="text-xs font-semibold text-gray-400 mt-3 mb-2">サブタスク</p>

                        {subs.length === 0 && (
                          <p className="text-xs text-gray-300 mb-3">サブタスクがまだありません</p>
                        )}

                        {subs.map((sub, idx) => (
                          <div key={sub.id} className="flex items-start gap-2 mb-2 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-xs text-gray-400 mt-0.5 shrink-0">{idx + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 font-medium">{sub.title}</p>
                              {sub.assignee && (
                                <p className="text-xs text-blue-400 mt-0.5 flex items-center gap-0.5"><User size={10} /> {sub.assignee}</p>
                              )}
                              {sub.important_note && (
                                <p className="text-xs text-orange-500 mt-0.5 flex items-center gap-0.5"><AlertTriangle size={10} /> {sub.important_note}</p>
                              )}
                            </div>
                            <button
                              onClick={() => deleteSubtask(template.id, sub.id)}
                              className="text-gray-300 hover:text-red-400 transition-colors text-xs shrink-0"
                            >
                              削除
                            </button>
                          </div>
                        ))}

                        {/* 新規サブタスク追加 */}
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <p className="text-xs text-gray-400 mb-2 font-semibold">サブタスクを追加</p>
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              placeholder="サブタスク名 *"
                              value={newSubTitle[template.id] ?? ""}
                              onChange={(e) => setNewSubTitle((p) => ({ ...p, [template.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && addSubtask(template.id)}
                              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <div className="flex gap-2">
                              <select
                                value={newSubAssignee[template.id] ?? ""}
                                onChange={(e) => setNewSubAssignee((p) => ({ ...p, [template.id]: e.target.value }))}
                                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                              >
                                <option value="">担当者（任意）</option>
                                {profiles.map((p) => (
                                  <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                placeholder="重要事項（任意）"
                                value={newSubNote[template.id] ?? ""}
                                onChange={(e) => setNewSubNote((p) => ({ ...p, [template.id]: e.target.value }))}
                                className="flex-1 border border-orange-200 rounded-lg px-3 py-1.5 text-sm text-orange-700 bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-300 placeholder-orange-300"
                              />
                              <button
                                onClick={() => addSubtask(template.id)}
                                className="text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors shrink-0"
                              >
                                追加
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {templates.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">テンプレートがまだありません</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
