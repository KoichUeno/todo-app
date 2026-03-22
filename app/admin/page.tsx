"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Profile = {
  id: string;
  name: string;
  department: string;
  role: string;
};

type Subtask = {
  id: string;
  title: string;
  is_completed: boolean;
  assignee: string;
};

type Task = {
  id: string;
  title: string;
  due_date: string;
  is_completed: boolean;
  assignee: string;
  subtasks: Subtask[];
};

export default function AdminPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [tab, setTab] = useState<"users" | "status">("users");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editRole, setEditRole] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth"); return; }

    const [profilesRes, tasksRes] = await Promise.all([
      fetch('/api/profiles'),
      fetch('/api/tasks'),
    ]);

    if (profilesRes.ok) {
      const data: Profile[] = await profilesRes.json();
      setProfiles(data);
      const me = data.find((p) => p.id === user.id);
      setCurrentUserRole(me?.role ?? "member");
    }

    if (tasksRes.ok) {
      const data: Task[] = await tasksRes.json();
      setTasks(data);
    }

    setLoading(false);
  };

  const startEdit = (p: Profile) => {
    setEditingId(p.id);
    setEditName(p.name ?? "");
    setEditDepartment(p.department ?? "");
    setEditRole(p.role ?? "member");
  };

  const saveEdit = async (id: string) => {
    const res = await fetch('/api/profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName, department: editDepartment, role: editRole }),
    });
    if (res.ok) {
      setProfiles(profiles.map((p) =>
        p.id === id ? { ...p, name: editName, department: editDepartment, role: editRole } : p
      ));
      setEditingId(null);
      setMessage("更新しました");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  // 担当者ごとのサブタスク状況を集計
  const getAssigneeStatus = () => {
    const map: Record<string, { pending: { taskTitle: string; subtaskTitle: string; dueDate: string }[]; done: number }> = {};

    for (const task of tasks) {
      for (const sub of task.subtasks) {
        const key = sub.assignee?.trim() || "未割当";
        if (!map[key]) map[key] = { pending: [], done: 0 };
        if (sub.is_completed) {
          map[key].done++;
        } else {
          map[key].pending.push({
            taskTitle: task.title,
            subtaskTitle: sub.title,
            dueDate: task.due_date,
          });
        }
      }
    }
    return map;
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">読み込み中...</p>
    </div>
  );

  if (currentUserRole !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-gray-500 text-sm mb-4">この画面は管理者のみアクセスできます。</p>
          <button onClick={() => router.push("/")} className="text-sm text-blue-500 hover:text-blue-700">
            ← タスク一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  const assigneeStatus = getAssigneeStatus();

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">管理者ダッシュボード</h1>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            ← タスク一覧に戻る
          </button>
        </div>

        {/* タブ */}
        <div className="flex mb-6 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setTab("users")}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === "users" ? "bg-blue-500 text-white" : "text-gray-500 hover:text-gray-700"}`}
          >
            ユーザー管理
          </button>
          <button
            onClick={() => setTab("status")}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === "status" ? "bg-blue-500 text-white" : "text-gray-500 hover:text-gray-700"}`}
          >
            担当者別タスク状況
          </button>
        </div>

        {message && (
          <div className="mb-4 bg-green-50 text-green-700 text-sm px-4 py-2 rounded-lg border border-green-100">
            {message}
          </div>
        )}

        {/* ユーザー管理タブ */}
        {tab === "users" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">氏名</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">部署</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">権限</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {profiles.map((p) => (
                  <tr key={p.id}>
                    {editingId === p.id ? (
                      <>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editDepartment}
                            onChange={(e) => setEditDepartment(e.target.value)}
                            placeholder="部署名"
                            className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                          >
                            <option value="member">一般</option>
                            <option value="admin">管理者</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => saveEdit(p.id)}
                              className="text-xs text-blue-500 hover:text-blue-700 font-semibold"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              キャンセル
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-gray-800">{p.name || <span className="text-gray-300">未設定</span>}</td>
                        <td className="px-4 py-3 text-gray-500">{p.department || <span className="text-gray-300">未設定</span>}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.role === "admin" ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"}`}>
                            {p.role === "admin" ? "管理者" : "一般"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => startEdit(p)}
                            className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
                          >
                            編集
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 px-4 py-3 border-t border-gray-50">
              ※ ユーザーはログイン時に自動登録されます。氏名・部署・権限をここで設定してください。
            </p>
          </div>
        )}

        {/* 担当者別タスク状況タブ */}
        {tab === "status" && (
          <div className="flex flex-col gap-4">
            {Object.keys(assigneeStatus).length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-400 text-sm">
                担当者が設定されたサブタスクがありません
              </div>
            ) : (
              Object.entries(assigneeStatus)
                .sort(([a], [b]) => {
                  if (a === "未割当") return 1;
                  if (b === "未割当") return -1;
                  return a.localeCompare(b, "ja");
                })
                .map(([assignee, stat]) => {
                  const total = stat.pending.length + stat.done;
                  const pct = total > 0 ? Math.round((stat.done / total) * 100) : 0;
                  return (
                    <div key={assignee} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <span className="font-semibold text-gray-700 text-sm">👤 {assignee}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">完了 {stat.done} / {total}</span>
                          <div className="w-24 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-400 h-1.5 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-blue-500">{pct}%</span>
                        </div>
                      </div>
                      {stat.pending.length > 0 ? (
                        <ul className="divide-y divide-gray-50">
                          {stat.pending.map((item, i) => (
                            <li key={i} className="px-4 py-2.5 flex items-start gap-3">
                              <span className="w-2 h-2 rounded-full bg-orange-300 mt-1.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-700 truncate">{item.subtaskTitle}</p>
                                <p className="text-[11px] text-gray-400 truncate">タスク: {item.taskTitle}</p>
                              </div>
                              {item.dueDate && (
                                <span className="text-[11px] text-gray-400 shrink-0">締切: {item.dueDate}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="px-4 py-3 text-xs text-green-500 font-semibold">✓ すべて完了！</p>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
