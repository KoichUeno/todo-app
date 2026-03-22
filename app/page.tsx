"use client";

import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

type Subtask = {
  id: string;
  title: string;
  description: string;
  is_completed: boolean;
  order_num: number;
  assignee: string;
};

type Task = {
  id: string;
  title: string;
  description: string;
  due_date: string;
  is_completed: boolean;
  subtasks: Subtask[];
  showSubtasks: boolean;
};

// B. テンプレート一覧
const TASK_TEMPLATES = [
  "毎週の報告書",
  "プレゼン資料作成",
  "ミーティング準備",
  "メールの返信をまとめてする",
  "タスクの棚卸し・整理",
];

export default function Home() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  };

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateDueDate, setTemplateDueDate] = useState("");

  const [newSubtaskTitles, setNewSubtaskTitles] = useState<Record<string, string>>({});

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskDescription, setEditingTaskDescription] = useState("");
  const [editingTaskDueDate, setEditingTaskDueDate] = useState("");

  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [editingSubtaskDescription, setEditingSubtaskDescription] = useState("");
  const [editingSubtaskAssignee, setEditingSubtaskAssignee] = useState("");

  const [newSubtaskAssignees, setNewSubtaskAssignees] = useState<Record<string, string>>({});

  // DBからタスク一覧を取得
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const res = await fetch('/api/tasks');
    const data = await res.json();
    const tasksWithUI = (data || []).map((t: Task) => ({ ...t, showSubtasks: false }));
    setTasks(tasksWithUI);
    setLoading(false);
  };

  // テンプレートからタスクを追加する
  const addFromTemplate = async () => {
    if (!selectedTemplate) return;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: selectedTemplate, due_date: templateDueDate || null }),
    });
    const newTask = await res.json();
    setTasks((prev) => [{ ...newTask, subtasks: [], showSubtasks: false }, ...prev]);
    setSelectedTemplate(null);
    setTemplateDueDate("");
  };

  // タスクを追加する
  const addTask = async () => {
    if (!newTitle.trim()) return;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, due_date: newDueDate || null }),
    });
    const newTask = await res.json();
    setTasks((prev) => [{ ...newTask, subtasks: [], showSubtasks: false }, ...prev]);
    setNewTitle("");
    setNewDueDate("");
  };

  // タスクを完了にする／完了を取り消す
  const toggleCompleteTask = async (id: string, current: boolean) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_completed: !current }),
    });
    setTasks(tasks.map((t) => (t.id === id ? { ...t, is_completed: !current } : t)));
  };

  // タスクの編集を保存する
  const saveTaskEdit = async (id: string) => {
    if (!editingTaskTitle.trim()) return;
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: editingTaskTitle, description: editingTaskDescription, due_date: editingTaskDueDate || null }),
    });
    setTasks(tasks.map((t) =>
      t.id === id ? { ...t, title: editingTaskTitle, description: editingTaskDescription, due_date: editingTaskDueDate } : t
    ));
    setEditingTaskId(null);
  };

  // タスクを削除する
  const deleteTask = async (id: string) => {
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
    setTasks(tasks.filter((t) => t.id !== id));
  };

  // タスクを30分単位のサブタスクに分解する
  const decomposeTask = async (task: Task) => {
    const subtaskDefs = [
      { title: `【30分】${task.title}の内容を整理する`, order_num: 1 },
      { title: `【30分】必要な情報・素材を集める`, order_num: 2 },
      { title: `【30分】最初のドラフトを作る`, order_num: 3 },
      { title: `【30分】見直して仕上げる`, order_num: 4 },
    ];
    const created: Subtask[] = [];
    for (const def of subtaskDefs) {
      const res = await fetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: task.id, title: def.title, order_num: def.order_num }),
      });
      const sub = await res.json();
      created.push(sub);
    }
    setTasks(tasks.map((t) => t.id === task.id ? { ...t, subtasks: created, showSubtasks: true } : t));
  };

  // サブタスクの完了・取り消しを切り替える
  const toggleCompleteSubtask = async (taskId: string, subtaskId: string, current: boolean) => {
    await fetch('/api/subtasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subtaskId, is_completed: !current }),
    });
    setTasks(tasks.map((t) => {
      if (t.id !== taskId) return t;
      const updatedSubtasks = t.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, is_completed: !current } : s
      );
      const allDone = updatedSubtasks.every((s) => s.is_completed);
      return { ...t, subtasks: updatedSubtasks, is_completed: allDone };
    }));
  };

  // サブタスクを追加する
  const addSubtask = async (taskId: string) => {
    const title = newSubtaskTitles[taskId]?.trim();
    if (!title) return;
    const task = tasks.find((t) => t.id === taskId);
    const order_num = (task?.subtasks.length ?? 0) + 1;
    const assignee = newSubtaskAssignees[taskId]?.trim() || "";
    const res = await fetch('/api/subtasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, title, assignee, order_num }),
    });
    const newSubtask = await res.json();
    setTasks(tasks.map((t) => t.id === taskId ? { ...t, subtasks: [...t.subtasks, newSubtask] } : t));
    setNewSubtaskTitles({ ...newSubtaskTitles, [taskId]: "" });
    setNewSubtaskAssignees({ ...newSubtaskAssignees, [taskId]: "" });
  };

  // サブタスクを削除する
  const deleteSubtask = async (taskId: string, subtaskId: string) => {
    await fetch(`/api/subtasks?id=${subtaskId}`, { method: 'DELETE' });
    setTasks(tasks.map((t) =>
      t.id !== taskId ? t : { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
    ));
  };

  // サブタスクの編集を保存する
  const saveSubtaskEdit = async (taskId: string, subtaskId: string) => {
    if (!editingSubtaskTitle.trim()) return;
    await fetch('/api/subtasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subtaskId, title: editingSubtaskTitle, description: editingSubtaskDescription, assignee: editingSubtaskAssignee }),
    });
    setTasks(tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        subtasks: t.subtasks.map((s) =>
          s.id === subtaskId ? { ...s, title: editingSubtaskTitle, description: editingSubtaskDescription, assignee: editingSubtaskAssignee } : s
        ),
      };
    }));
    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
  };

  // サブタスクをドラッグ＆ドロップで並び替える
  const reorderSubtasks = async (taskId: string, result: DropResult) => {
    if (!result.destination) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const reordered = Array.from(task.subtasks);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    // ローカルの順番をすぐ更新
    setTasks(tasks.map((t) => t.id === taskId ? { ...t, subtasks: reordered } : t));

    // DBのorder_numを更新
    await Promise.all(
      reordered.map((sub, index) =>
        fetch('/api/subtasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: sub.id, order_num: index + 1 }),
        })
      )
    );
  };

  // サブタスクの表示・非表示を切り替える
  const toggleSubtasks = (id: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, showSubtasks: !t.showSubtasks } : t)));
  };

  const activeTasks = tasks.filter((t) => !t.is_completed);
  const completedTasks = tasks.filter((t) => t.is_completed);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-6xl mx-auto">

        {/* タイトル */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-800">タスク管理</h1>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            ログアウト
          </button>
        </div>
        <p className="text-gray-500 mb-8 text-sm">タスクを30分単位に分解して、今すぐ着手しよう。</p>

        {/* 2カラムレイアウト */}
        <div className="flex gap-6 items-start">

          {/* 左カラム */}
          <div className="flex-1 min-w-0">

            {/* タスク追加フォーム */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-8 border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">新しいタスクを追加</h2>
              <input
                type="text"
                placeholder="タスク名を入力..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 mb-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <div className="flex gap-3">
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={addTask}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                >
                  追加
                </button>
              </div>
            </div>

            {/* テンプレートから追加 */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">テンプレートから追加</h2>
              <div className="flex flex-wrap gap-2">
                {TASK_TEMPLATES.map((template) => (
                  <button
                    key={template}
                    onClick={() => { setSelectedTemplate(template); setTemplateDueDate(""); }}
                    className={`text-xs border px-3 py-1.5 rounded-full transition-colors shadow-sm ${
                      selectedTemplate === template
                        ? "bg-blue-500 border-blue-500 text-white"
                        : "bg-white border-gray-200 hover:border-blue-300 hover:text-blue-500 text-gray-600"
                    }`}
                  >
                    + {template}
                  </button>
                ))}
              </div>

              {selectedTemplate && (
                <div className="mt-3 flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <span className="text-sm text-blue-700 font-semibold shrink-0">{selectedTemplate}</span>
                  <input
                    type="date"
                    value={templateDueDate}
                    onChange={(e) => setTemplateDueDate(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button
                    onClick={addFromTemplate}
                    className="text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    追加
                  </button>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                  >
                    キャンセル
                  </button>
                </div>
              )}
            </div>

            {/* ローディング */}
            {loading && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm">読み込み中...</p>
              </div>
            )}

            {/* 進行中タスク一覧 */}
            {!loading && activeTasks.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">進行中 ({activeTasks.length})</h2>
                <div className="flex flex-col gap-3">
                  {activeTasks.map((task) => (
                    <div key={task.id} className="bg-white rounded-2xl shadow-sm border border-gray-100">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            {editingTaskId === task.id ? (
                              <div className="flex flex-col gap-2">
                                <input
                                  type="text"
                                  value={editingTaskTitle}
                                  onChange={(e) => setEditingTaskTitle(e.target.value)}
                                  placeholder="タスク名"
                                  className="border border-blue-300 rounded-lg px-3 py-1 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  autoFocus
                                />
                                <textarea
                                  value={editingTaskDescription}
                                  onChange={(e) => setEditingTaskDescription(e.target.value)}
                                  placeholder="概要（任意）"
                                  rows={2}
                                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                                />
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="date"
                                    value={editingTaskDueDate}
                                    onChange={(e) => setEditingTaskDueDate(e.target.value)}
                                    className="border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  />
                                  <button
                                    onClick={() => saveTaskEdit(task.id)}
                                    className="text-xs text-blue-500 hover:text-blue-700 font-semibold"
                                  >
                                    保存
                                  </button>
                                  <button
                                    onClick={() => setEditingTaskId(null)}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                  >
                                    キャンセル
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="cursor-pointer group"
                                onClick={() => { setEditingTaskId(task.id); setEditingTaskTitle(task.title); setEditingTaskDescription(task.description ?? ""); setEditingTaskDueDate(task.due_date ?? ""); }}
                              >
                                <p className="font-semibold text-gray-800 group-hover:text-blue-500 transition-colors">{task.title}</p>
                                {task.description && (
                                  <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                                )}
                                {task.due_date && (
                                  <p className="text-xs text-gray-400 mt-1">締め切り：{task.due_date}</p>
                                )}
                                {!task.due_date && !task.description && (
                                  <p className="text-xs text-gray-300 mt-1">クリックして編集</p>
                                )}
                              </div>
                            )}
                            {/* 進捗バー */}
                            {task.subtasks.length > 0 && (() => {
                              const done = task.subtasks.filter(s => s.is_completed).length;
                              const total = task.subtasks.length;
                              const pct = Math.round((done / total) * 100);
                              return (
                                <div className="mt-2">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs text-gray-400">進捗</span>
                                    <span className="text-xs font-semibold text-blue-500">{pct}%</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                                    <div
                                      className="bg-blue-400 h-1.5 rounded-full transition-all duration-300"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {task.subtasks.length === 0 ? (
                              <button
                                onClick={() => decomposeTask(task)}
                                className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-600 font-semibold px-3 py-1 rounded-full transition-colors"
                              >
                                分解する
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleSubtasks(task.id)}
                                className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-600 font-semibold px-3 py-1 rounded-full transition-colors"
                              >
                                {task.showSubtasks ? "閉じる" : `${task.subtasks.filter(s => s.is_completed).length}/${task.subtasks.length}`}
                              </button>
                            )}
                            <button
                              onClick={() => toggleCompleteTask(task.id, task.is_completed)}
                              className="text-xs bg-green-100 hover:bg-green-200 text-green-600 font-semibold px-3 py-1 rounded-full transition-colors"
                            >
                              完了
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="text-xs bg-red-100 hover:bg-red-200 text-red-500 font-semibold px-3 py-1 rounded-full transition-colors"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* サブタスク一覧 */}
                      {task.showSubtasks && (
                        <div className="border-t border-gray-100 px-4 py-3">
                          <p className="text-xs font-semibold text-gray-400 mb-2">30分ステップ</p>
                          <DragDropContext onDragEnd={(result) => reorderSubtasks(task.id, result)}>
                            <Droppable droppableId={task.id}>
                              {(provided) => (
                                <div
                                  className="flex flex-col gap-2"
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                >
                                  {task.subtasks.map((sub, index) => (
                                    <Draggable key={sub.id} draggableId={sub.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          className={`flex items-start gap-2 rounded-lg ${snapshot.isDragging ? "bg-blue-50 shadow-md" : ""}`}
                                        >
                                          {/* ドラッグハンドル */}
                                          <span
                                            {...provided.dragHandleProps}
                                            className="mt-1.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 text-sm"
                                            title="ドラッグして並び替え"
                                          >
                                            ⠿
                                          </span>
                                          <button
                                            onClick={() => toggleCompleteSubtask(task.id, sub.id, sub.is_completed)}
                                            className={`mt-1 w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${
                                              sub.is_completed
                                                ? "bg-green-400 border-green-400"
                                                : "border-gray-300 hover:border-green-400"
                                            }`}
                                          />
                                          {editingSubtaskId === sub.id ? (
                                            <div className="flex-1 flex flex-col gap-1">
                                              <input
                                                type="text"
                                                value={editingSubtaskTitle}
                                                onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                                                placeholder="サブタスク名"
                                                className="border border-blue-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                autoFocus
                                              />
                                              <textarea
                                                value={editingSubtaskDescription}
                                                onChange={(e) => setEditingSubtaskDescription(e.target.value)}
                                                placeholder="概要（任意）"
                                                rows={2}
                                                className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                                              />
                                              <input
                                                type="text"
                                                value={editingSubtaskAssignee}
                                                onChange={(e) => setEditingSubtaskAssignee(e.target.value)}
                                                placeholder="担当者（任意）"
                                                className="border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                              />
                                            </div>
                                          ) : (
                                            <div className="flex-1">
                                              <span className={`text-sm ${sub.is_completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                                                {sub.title}
                                              </span>
                                              {sub.description && (
                                                <p className="text-xs text-gray-400 mt-0.5">{sub.description}</p>
                                              )}
                                              {sub.assignee && (
                                                <p className="text-xs text-blue-400 mt-0.5">👤 {sub.assignee}</p>
                                              )}
                                            </div>
                                          )}
                                          {editingSubtaskId === sub.id ? (
                                            <button
                                              onClick={() => saveSubtaskEdit(task.id, sub.id)}
                                              className="text-xs text-blue-500 hover:text-blue-700 transition-colors shrink-0"
                                            >
                                              保存
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => { setEditingSubtaskId(sub.id); setEditingSubtaskTitle(sub.title); setEditingSubtaskDescription(sub.description ?? ""); setEditingSubtaskAssignee(sub.assignee ?? ""); }}
                                              className="text-xs text-gray-400 hover:text-blue-400 transition-colors shrink-0"
                                            >
                                              編集
                                            </button>
                                          )}
                                          <button
                                            onClick={() => deleteSubtask(task.id, sub.id)}
                                            className="text-xs text-gray-300 hover:text-red-400 transition-colors shrink-0"
                                          >
                                            削除
                                          </button>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </DragDropContext>
                          <div className="flex flex-col gap-2 mt-3">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="サブタスクを追加..."
                                value={newSubtaskTitles[task.id] ?? ""}
                                onChange={(e) => setNewSubtaskTitles({ ...newSubtaskTitles, [task.id]: e.target.value })}
                                onKeyDown={(e) => e.key === "Enter" && addSubtask(task.id)}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                              />
                              <input
                                type="text"
                                placeholder="担当者"
                                value={newSubtaskAssignees[task.id] ?? ""}
                                onChange={(e) => setNewSubtaskAssignees({ ...newSubtaskAssignees, [task.id]: e.target.value })}
                                className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                              />
                              <button
                                onClick={() => addSubtask(task.id)}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold px-3 py-1.5 rounded-lg transition-colors"
                              >
                                追加
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 完了済みタスク */}
            {!loading && completedTasks.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">完了済み ({completedTasks.length})</h2>
                <div className="flex flex-col gap-2">
                  {completedTasks.map((task) => (
                    <div key={task.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between opacity-60">
                      <p className="line-through text-gray-400 text-sm">{task.title}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleCompleteTask(task.id, task.is_completed)}
                          className="text-xs text-blue-400 hover:text-blue-600 transition-colors"
                        >
                          戻す
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* タスクがない場合 */}
            {!loading && tasks.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-4">📝</p>
                <p className="text-sm">タスクを追加してみましょう！</p>
              </div>
            )}

          </div>

          {/* 右カラム：未完了タスク一覧 */}
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-10">
              <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                未完了 ({activeTasks.length})
              </h2>
              {activeTasks.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">すべて完了！🎉</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {activeTasks.map((task) => (
                    <li key={task.id} className="flex items-start gap-2">
                      <span className="mt-1 w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700 leading-snug">{task.title}</p>
                        {task.due_date && (
                          <p className="text-xs text-gray-400">締切：{task.due_date}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
