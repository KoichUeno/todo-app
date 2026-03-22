"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Clock, Circle, Folder, User, Building2, Crown, CalendarDays, Zap, AlertTriangle } from "lucide-react";

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
  important_note: string;
  assignee: string;
  project_name: string;
  importance: string;
  client_type: string;
  task_type: string;
  subtasks: Subtask[];
};

const IMPORTANCE_ORDER: Record<string, number> = { 最高: 0, 高: 1, 中: 2, 低: 3 };

const importanceBadge = (imp: string) => {
  if (imp === "最高") return <span className="inline-flex items-center gap-0.5 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold"><Circle size={7} className="fill-red-500 text-red-500" /> 最高</span>;
  if (imp === "高") return <span className="inline-flex items-center gap-0.5 text-[10px] bg-orange-100 text-orange-500 px-1.5 py-0.5 rounded-full font-semibold"><Circle size={7} className="fill-orange-400 text-orange-400" /> 高</span>;
  if (imp === "中") return <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">中</span>;
  return <span className="text-[10px] bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded-full">低</span>;
};

export default function Dashboard() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth"); return; }
      fetchTasks();
    };
    checkAuth();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks((data || []).filter((t: Task) => !t.is_completed));
    setLoading(false);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 期限が7日以内のタスク（期限切れ含む）
  const urgentTasks = tasks
    .filter((t) => {
      if (!t.due_date) return false;
      const due = new Date(t.due_date);
      const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff <= 7;
    })
    .sort((a, b) => {
      const da = new Date(a.due_date).getTime();
      const db = new Date(b.due_date).getTime();
      return da - db;
    });

  // 重要度「最高」のタスク
  const criticalTasks = tasks
    .filter((t) => t.importance === "最高")
    .sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

  // 全タスクを重要度順
  const allByImportance = [...tasks].sort(
    (a, b) => (IMPORTANCE_ORDER[a.importance] ?? 3) - (IMPORTANCE_ORDER[b.importance] ?? 3)
  );

  const getDiffLabel = (dueDate: string) => {
    const due = new Date(dueDate);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `${Math.abs(diff)}日超過`, color: "text-red-600 font-bold" };
    if (diff === 0) return { label: "今日締切", color: "text-red-500 font-bold" };
    if (diff === 1) return { label: "明日締切", color: "text-orange-500 font-bold" };
    return { label: `あと${diff}日`, color: "text-yellow-600 font-semibold" };
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">

        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ダッシュボード</h1>
            <p className="text-xs text-gray-400 mt-0.5">{today.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              タスク一覧
            </button>
            <button
              onClick={() => router.push("/admin")}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              マスター管理
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">読み込み中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* 期限が迫っているタスク */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Clock size={16} className="text-gray-500" /> 期限が迫っているタスク
                <span className="ml-auto text-[10px] text-gray-400 font-normal">7日以内</span>
              </h2>
              {urgentTasks.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">期限が迫っているタスクはありません</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {urgentTasks.map((task) => {
                    const { label, color } = getDiffLabel(task.due_date);
                    const done = task.subtasks.filter((s) => s.is_completed).length;
                    const total = task.subtasks.length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : null;
                    return (
                      <div key={task.id} className="border border-gray-100 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold text-gray-800">{task.title}</p>
                              {importanceBadge(task.importance)}
                            </div>
                            {task.project_name && (
                              <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5"><Folder size={9} /> {task.project_name}</p>
                            )}
                            {task.assignee && (
                              <p className="text-[10px] text-blue-400 flex items-center gap-0.5"><User size={9} /> {task.assignee}</p>
                            )}
                            {pct !== null && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                  <div className="bg-blue-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] text-gray-400">{done}/{total}</span>
                              </div>
                            )}
                          </div>
                          <span className={`text-xs shrink-0 ${color}`}>{label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 重要度「最高」タスクの進捗 */}
            <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Circle size={14} className="fill-red-500 text-red-500" /> 重要度「最高」の進捗
                <span className="ml-auto text-[10px] bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-semibold">{criticalTasks.length}件</span>
              </h2>
              {criticalTasks.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">重要度「最高」のタスクはありません</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {criticalTasks.map((task) => {
                    const done = task.subtasks.filter((s) => s.is_completed).length;
                    const total = task.subtasks.length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : null;
                    return (
                      <div key={task.id} className="border border-red-50 rounded-xl p-3 bg-red-50/30">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{task.title}</p>
                            {task.project_name && <p className="text-[10px] text-gray-400 flex items-center gap-0.5"><Folder size={9} /> {task.project_name}</p>}
                            {task.assignee && <p className="text-[10px] text-blue-400 flex items-center gap-0.5"><User size={9} /> {task.assignee}</p>}
                            {task.important_note && (
                              <p className="text-[10px] text-orange-500 mt-0.5 flex items-center gap-0.5"><AlertTriangle size={9} /> {task.important_note}</p>
                            )}
                          </div>
                          {task.due_date && (() => {
                            const { label, color } = getDiffLabel(task.due_date);
                            return <span className={`text-xs shrink-0 ${color}`}>{label}</span>;
                          })()}
                        </div>
                        {pct !== null ? (
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] text-gray-400">進捗</span>
                              <span className="text-xs font-bold text-red-500">{pct}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${pct === 100 ? "bg-green-400" : pct >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5 text-right">{done}/{total} 完了</p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-300">サブタスクなし</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 全タスク重要度別一覧 */}
            <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <CalendarDays size={16} className="text-gray-500" /> 未完了タスク一覧（重要度順）
                <span className="ml-auto text-[10px] text-gray-400 font-normal">{tasks.length}件</span>
              </h2>
              {allByImportance.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">未完了タスクはありません</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-100">
                        <th className="text-left pb-2 font-semibold">重要度</th>
                        <th className="text-left pb-2 font-semibold">タスク名</th>
                        <th className="text-left pb-2 font-semibold">案件</th>
                        <th className="text-left pb-2 font-semibold">顧客区分</th>
                        <th className="text-left pb-2 font-semibold">案件区分</th>
                        <th className="text-left pb-2 font-semibold">担当者</th>
                        <th className="text-left pb-2 font-semibold">締切</th>
                        <th className="text-left pb-2 font-semibold">進捗</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allByImportance.map((task) => {
                        const done = task.subtasks.filter((s) => s.is_completed).length;
                        const total = task.subtasks.length;
                        const pct = total > 0 ? Math.round((done / total) * 100) : null;
                        const hasDue = !!task.due_date;
                        const isOverdue = hasDue && new Date(task.due_date) < today;
                        return (
                          <tr key={task.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="py-2 pr-3">{importanceBadge(task.importance)}</td>
                            <td className="py-2 pr-3">
                              <p className="font-medium text-gray-800 truncate max-w-[180px]">{task.title}</p>
                              {task.important_note && <p className="text-[10px] text-orange-500 truncate max-w-[180px]">⚠ {task.important_note}</p>}
                            </td>
                            <td className="py-2 pr-3 text-xs text-gray-500">{task.project_name || "—"}</td>
                            <td className="py-2 pr-3">
                              {task.client_type === "企業" && <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full"><Building2 size={9} /> 企業</span>}
                              {task.client_type === "資産家" && <span className="inline-flex items-center gap-0.5 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full"><Crown size={9} /> 資産家</span>}
                              {!task.client_type && <span className="text-xs text-gray-300">—</span>}
                            </td>
                            <td className="py-2 pr-3">
                              {task.task_type === "定例" && <span className="inline-flex items-center gap-0.5 text-[10px] bg-teal-100 text-teal-600 px-1.5 py-0.5 rounded-full"><CalendarDays size={9} /> 定例</span>}
                              {task.task_type === "スポット" && <span className="inline-flex items-center gap-0.5 text-[10px] bg-orange-100 text-orange-500 px-1.5 py-0.5 rounded-full"><Zap size={9} /> スポット</span>}
                              {!task.task_type && <span className="text-xs text-gray-300">—</span>}
                            </td>
                            <td className="py-2 pr-3 text-xs text-blue-400">{task.assignee || "—"}</td>
                            <td className={`py-2 pr-3 text-xs ${isOverdue ? "text-red-500 font-bold" : "text-gray-500"}`}>
                              {task.due_date || "—"}
                              {isOverdue && " ⚠"}
                            </td>
                            <td className="py-2 min-w-[100px]">
                              {pct !== null ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full ${pct === 100 ? "bg-green-400" : "bg-blue-400"}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[10px] text-gray-400 shrink-0">{pct}%</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
