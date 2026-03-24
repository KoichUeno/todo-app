"use client";

import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Repeat,
  Folder,
  Building2,
  Crown,
  CalendarDays,
  Zap,
  User,
  CheckCircle2,
  FileText,
  DollarSign,
  Circle,
  ChevronDown,
  ChevronRight,
  LayoutList,
  Columns,
  Copy,
  Database,
  ClipboardList,
} from "lucide-react";

type Subtask = {
  id: string;
  title: string;
  description: string;
  important_note: string;
  is_completed: boolean;
  order_num: number;
  assignee: string;
};

type Profile = {
  id: string;
  name: string;
  department: string;
  role: string;
};

type TemplateSubtask = {
  id: string;
  template_id: string;
  title: string;
  assignee: string;
  order_num: number;
};

type Task = {
  id: string;
  title: string;
  description: string;
  due_date: string;
  is_completed: boolean;
  important_note: string;
  assignee: string;
  project_name: string;
  is_recurring: boolean;
  importance: string;
  client_type: string;
  task_type: string;
  status: string;
  data_location: string;
  category: string;
  client_id: string;
  task_number: string;
  subtasks: Subtask[];
  showSubtasks: boolean;
};

type Client = {
  id: string;
  name: string;
  client_type: string;
  head_office: string;
  representative: string;
  fiscal_month: string;
  note: string;
};

type Template = {
  id: string;
  title: string;
};

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

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newImportantNote, setNewImportantNote] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateDueDate, setTemplateDueDate] = useState("");
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [showAddTemplate, setShowAddTemplate] = useState(false);

  const [newSubtaskTitles, setNewSubtaskTitles] = useState<Record<string, string>>({});

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskDescription, setEditingTaskDescription] = useState("");
  const [editingTaskDueDate, setEditingTaskDueDate] = useState("");
  const [editingTaskDataLocation, setEditingTaskDataLocation] = useState("");
  const [editingTaskProjectName, setEditingTaskProjectName] = useState("");
  const [editingTaskImportance, setEditingTaskImportance] = useState("通常");
  const [editingTaskClientType, setEditingTaskClientType] = useState("");
  const [editingTaskTaskType, setEditingTaskTaskType] = useState("");
  const [editingTaskAssignee, setEditingTaskAssignee] = useState("");
  const [editingTaskClientId, setEditingTaskClientId] = useState("");

  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [editingSubtaskDescription, setEditingSubtaskDescription] = useState("");
  const [editingSubtaskImportantNote, setEditingSubtaskImportantNote] = useState("");
  const [editingSubtaskAssignee, setEditingSubtaskAssignee] = useState("");

  const [newSubtaskAssignees, setNewSubtaskAssignees] = useState<Record<string, string>>({});

  const [newProjectName, setNewProjectName] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newIsRecurring, setNewIsRecurring] = useState(false);
  const [newImportance, setNewImportance] = useState("通常");
  const [newClientType, setNewClientType] = useState("");
  const [newTaskType, setNewTaskType] = useState("");
  const [newDataLocation, setNewDataLocation] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryOther, setNewCategoryOther] = useState("");

  const [editingTaskCategory, setEditingTaskCategory] = useState("");
  const [editingTaskCategoryOther, setEditingTaskCategoryOther] = useState("");

  const [filterCategory, setFilterCategory] = useState("");
  const [filterClientType, setFilterClientType] = useState("");

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateSubtasksMap, setTemplateSubtasksMap] = useState<Record<string, TemplateSubtask[]>>({});
  const [newTplSubtaskTitle, setNewTplSubtaskTitle] = useState<Record<string, string>>({});
  const [newTplSubtaskAssignee, setNewTplSubtaskAssignee] = useState<Record<string, string>>({});

  const [view, setView] = useState<"list" | "kanban" | "project">("list");

  // DBからタスク一覧・プロフィール・テンプレートを取得
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const res = await fetch('/api/profiles');
      if (res.ok) {
        const allProfiles = await res.json();
        setProfiles(allProfiles || []);
        const me = allProfiles.find((p: Profile) => p.id === session.user.id);
        setCurrentUser(me || null);
      }
    });
    fetchTasks();
    fetchTemplates();
    fetchClients();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const res = await fetch('/api/tasks');
    const data = await res.json();
    const tasksWithUI = (data || []).map((t: Task) => ({ ...t, showSubtasks: false }));
    setTasks(tasksWithUI);
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const res = await fetch('/api/profiles');
    if (res.ok) setProfiles(await res.json() || []);
  };

  const fetchTemplates = async () => {
    const res = await fetch('/api/templates');
    if (res.ok) {
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    }
  };

  const fetchClients = async () => {
    const res = await fetch('/api/clients');
    if (res.ok) setClients(await res.json() || []);
  };

  const fetchTemplateSubtasks = async (templateId: string) => {
    if (templateSubtasksMap[templateId]) return;
    const res = await fetch(`/api/template-subtasks?template_id=${templateId}`);
    if (res.ok) {
      const data = await res.json();
      setTemplateSubtasksMap((prev) => ({ ...prev, [templateId]: data || [] }));
    }
  };

  const addTemplateSubtask = async (templateId: string) => {
    const title = newTplSubtaskTitle[templateId]?.trim();
    if (!title) return;
    const assignee = newTplSubtaskAssignee[templateId] || "";
    const order_num = (templateSubtasksMap[templateId]?.length ?? 0) + 1;
    const res = await fetch('/api/template-subtasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, title, assignee, order_num }),
    });
    if (res.ok) {
      const sub = await res.json();
      setTemplateSubtasksMap((prev) => ({ ...prev, [templateId]: [...(prev[templateId] || []), sub] }));
      setNewTplSubtaskTitle((prev) => ({ ...prev, [templateId]: "" }));
      setNewTplSubtaskAssignee((prev) => ({ ...prev, [templateId]: "" }));
    }
  };

  const deleteTemplateSubtask = async (templateId: string, subtaskId: string) => {
    await fetch(`/api/template-subtasks?id=${subtaskId}`, { method: 'DELETE' });
    setTemplateSubtasksMap((prev) => ({
      ...prev,
      [templateId]: (prev[templateId] || []).filter((s) => s.id !== subtaskId),
    }));
  };

  const registerAsTemplate = async (task: Task) => {
    // テンプレート作成
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: task.title }),
    });
    if (!res.ok) return;
    const newTemplate = await res.json();

    // サブタスクをテンプレートにひも付け
    const subs = await Promise.all(
      task.subtasks.map((sub, i) =>
        fetch('/api/template-subtasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: newTemplate.id,
            title: sub.title,
            assignee: sub.assignee || "",
            important_note: sub.important_note || "",
            order_num: i + 1,
          }),
        }).then((r) => r.json())
      )
    );

    setTemplates((prev) => [...prev, newTemplate]);
    setTemplateSubtasksMap((prev) => ({ ...prev, [newTemplate.id]: subs }));
    alert(`「${task.title}」をテンプレートに登録しました`);
  };

  const generateMonthlyTask = async (task: Task) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const dueDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: task.title,
        project_name: task.project_name,
        assignee: task.assignee,
        is_recurring: true,
        due_date: dueDate,
      }),
    });
    const newTask = await res.json();

    for (const sub of task.subtasks) {
      await fetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: newTask.id, title: sub.title, assignee: sub.assignee, order_num: sub.order_num }),
      });
    }
    fetchTasks();
  };

  const addTemplate = async () => {
    if (!newTemplateTitle.trim()) return;
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTemplateTitle.trim() }),
    });
    if (res.ok) {
      const t = await res.json();
      setTemplates((prev) => [...prev, t]);
    }
    setNewTemplateTitle("");
    setShowAddTemplate(false);
  };

  const deleteTemplate = async (id: string) => {
    await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setSelectedTemplate(null);
  };

  // テンプレートからタスクを追加する
  const addFromTemplate = async () => {
    if (!selectedTemplate || !selectedTemplateId) return;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: selectedTemplate, due_date: templateDueDate || null, is_recurring: true }),
    });
    const newTask = await res.json();

    const subs = templateSubtasksMap[selectedTemplateId] || [];
    const createdSubs = await Promise.all(
      subs.map((sub, i) =>
        fetch('/api/subtasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: newTask.id, title: sub.title, assignee: sub.assignee, order_num: i + 1 }),
        }).then((r) => r.json())
      )
    );

    setTasks((prev) => [{ ...newTask, subtasks: createdSubs, showSubtasks: false }, ...prev]);
    setSelectedTemplate(null);
    setSelectedTemplateId(null);
    setTemplateDueDate("");
  };

  // タスクを追加する
  const addTask = async () => {
    if (!newTitle.trim()) return;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, due_date: newDueDate || null, important_note: newImportantNote || null, assignee: newAssignee || null, project_name: newProjectName || null, is_recurring: newIsRecurring, importance: newImportance, client_type: newClientType || null, task_type: newTaskType || null, data_location: newDataLocation || null, category: resolveCategory(newCategory, newCategoryOther) || null, client_id: newClientId || null }),
    });
    const newTask = await res.json();
    setTasks((prev) => [{ ...newTask, subtasks: [], showSubtasks: false }, ...prev]);
    setNewTitle("");
    setNewDueDate("");
    setNewImportantNote("");
    setNewAssignee("");
    setNewProjectName("");
    setNewIsRecurring(false);
    setNewImportance("通常");
    setNewClientType("");
    setNewTaskType("");
    setNewDataLocation("");
    setNewCategory("");
    setNewCategoryOther("");
    setNewClientId("");
  };

  // タスクを完了にする／完了を取り消す
  const toggleCompleteTask = async (id: string, current: boolean) => {
    const newStatus = current ? '進行中' : '完了（未請求）';
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_completed: !current, status: newStatus }),
    });
    setTasks(tasks.map((t) => (t.id === id ? { ...t, is_completed: !current, status: newStatus } : t)));
  };

  // ステータスを変更する
  const changeTaskStatus = async (id: string, newStatus: string) => {
    const is_completed = newStatus !== '進行中';
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus, is_completed }),
    });
    setTasks(tasks.map((t) => (t.id === id ? { ...t, status: newStatus, is_completed } : t)));
  };

  // タスクの編集を保存する
  const saveTaskEdit = async (id: string) => {
    if (!editingTaskTitle.trim()) return;
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        title: editingTaskTitle,
        description: editingTaskDescription,
        due_date: editingTaskDueDate || null,
        data_location: editingTaskDataLocation || null,
        project_name: editingTaskProjectName || null,
        importance: editingTaskImportance,
        client_type: editingTaskClientType || null,
        task_type: editingTaskTaskType || null,
        assignee: editingTaskAssignee || null,
        category: resolveCategory(editingTaskCategory, editingTaskCategoryOther) || null,
        client_id: editingTaskClientId || null,
      }),
    });
    setTasks(tasks.map((t) =>
      t.id === id ? { ...t, title: editingTaskTitle, description: editingTaskDescription, due_date: editingTaskDueDate, data_location: editingTaskDataLocation, project_name: editingTaskProjectName, importance: editingTaskImportance, client_type: editingTaskClientType, task_type: editingTaskTaskType, assignee: editingTaskAssignee, category: resolveCategory(editingTaskCategory, editingTaskCategoryOther), client_id: editingTaskClientId } : t
    ));
    setEditingTaskId(null);
  };

  // タスクを削除する
  const deleteTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!confirm(`「${task?.title || 'このタスク'}」を削除しますか？この操作は取り消せません。`)) return;
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
    setTasks(tasks.filter((t) => t.id !== id));
  };

  // 同名タスクの過去サブタスクを取得してベースにする

  // サブタスクの完了・取り消しを切り替える
  const toggleCompleteSubtask = async (taskId: string, subtaskId: string, current: boolean) => {
    await fetch('/api/subtasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subtaskId, is_completed: !current }),
    });
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updatedSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, is_completed: !current } : s
    );
    const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.is_completed);
    const wasActive = task.status === '進行中' || (!task.status && !task.is_completed);
    // 全サブタスク完了 → ステータスを「完了（未請求）」に自動変更
    if (allDone && wasActive) {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, is_completed: true, status: '完了（未請求）' }),
      });
      setTasks(tasks.map((t) =>
        t.id !== taskId ? t : { ...t, subtasks: updatedSubtasks, is_completed: true, status: '完了（未請求）' }
      ));
    } else if (!allDone && task.status === '完了（未請求）') {
      // サブタスクが未完了に戻されたら「進行中」に戻す
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, is_completed: false, status: '進行中' }),
      });
      setTasks(tasks.map((t) =>
        t.id !== taskId ? t : { ...t, subtasks: updatedSubtasks, is_completed: false, status: '進行中' }
      ));
    } else {
      setTasks(tasks.map((t) =>
        t.id !== taskId ? t : { ...t, subtasks: updatedSubtasks }
      ));
    }
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
    const task = tasks.find((t) => t.id === taskId);
    const sub = task?.subtasks.find((s) => s.id === subtaskId);
    if (!confirm(`「${sub?.title || 'このサブタスク'}」を削除しますか？`)) return;
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
      body: JSON.stringify({ id: subtaskId, title: editingSubtaskTitle, description: editingSubtaskDescription, important_note: editingSubtaskImportantNote, assignee: editingSubtaskAssignee }),
    });
    setTasks(tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        subtasks: t.subtasks.map((s) =>
          s.id === subtaskId ? { ...s, title: editingSubtaskTitle, description: editingSubtaskDescription, important_note: editingSubtaskImportantNote, assignee: editingSubtaskAssignee } : s
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

  const isAdmin = !currentUser || currentUser.role === '管理者' || currentUser.role === 'admin';

  const CATEGORIES = ["総務", "帳簿入力", "申告", "コンサルティング", "その他"];

  // カテゴリーの実際の保存値を取得（「その他」の場合は自由入力値）
  const resolveCategory = (cat: string, other: string) =>
    cat === "その他" && other.trim() ? `その他：${other.trim()}` : cat;

  // カテゴリーフィルター適用
  const categoryFilter = (t: Task) => {
    if (!filterCategory) return true;
    if (!t.category) return true; // カテゴリー未設定のタスクは常に表示
    if (filterCategory === "その他") return t.category.startsWith("その他");
    return t.category === filterCategory;
  };

  // クライアント区分フィルター
  const clientTypeFilter = (t: Task) => {
    if (!filterClientType) return true;
    return t.client_type === filterClientType;
  };

  const activeTasks = tasks.filter((t) => (t.status === '進行中' || (!t.status && !t.is_completed)) && categoryFilter(t) && clientTypeFilter(t));
  const completedTasks = tasks.filter((t) => (t.status === '完了（未請求）' || (t.is_completed && !t.status)) && categoryFilter(t) && clientTypeFilter(t));
  const invoicedTasks = tasks.filter((t) => t.status === '請求済' && categoryFilter(t) && clientTypeFilter(t));
  const collectedTasks = tasks.filter((t) => t.status === '回収済' && categoryFilter(t) && clientTypeFilter(t));

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-7xl mx-auto">

        {/* タイトル */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-800">タスク管理</h1>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              ダッシュボード
            </button>
            <button
              onClick={() => router.push("/clients")}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              クライアント
            </button>
            <button
              onClick={() => router.push("/master")}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              マスター管理
            </button>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
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
              <div className="flex gap-3 mb-2">
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <select
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                >
                  <option value="">責任者を選択</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 mb-2 flex-wrap">
                <select
                  value={newClientId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setNewClientId(cid);
                    const c = clients.find((cl) => cl.id === cid);
                    setNewProjectName(c?.name || "");
                    if (c?.client_type) setNewClientType(c.client_type);
                  }}
                  className="flex-1 min-w-[120px] border border-gray-200 rounded-lg px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-sm"
                >
                  <option value="">クライアント選択</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={newImportance}
                  onChange={(e) => setNewImportance(e.target.value)}
                  className="w-28 border border-gray-200 rounded-lg px-2 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-sm"
                >
                  <option value="最高">最高</option>
                  <option value="高">高</option>
                  <option value="通常">通常</option>
                </select>
                <select
                  value={newClientType}
                  onChange={(e) => setNewClientType(e.target.value)}
                  className="w-24 border border-gray-200 rounded-lg px-2 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-sm"
                >
                  <option value="">顧客区分</option>
                  <option value="企業">企業</option>
                  <option value="資産家">資産家</option>
                  <option value="一般社団法人">一般社団法人</option>
                  <option value="個人事業">個人事業</option>
                  <option value="その他">その他</option>
                  <option value="自社">自社</option>
                </select>
                <select
                  value={newTaskType}
                  onChange={(e) => setNewTaskType(e.target.value)}
                  className="w-24 border border-gray-200 rounded-lg px-2 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-sm"
                >
                  <option value="">頻度</option>
                  <option value="定例">📅 定例</option>
                  <option value="スポット">⚡ スポット</option>
                </select>
                <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={newIsRecurring}
                    onChange={(e) => setNewIsRecurring(e.target.checked)}
                    className="rounded"
                  />
                  毎月繰り返し
                </label>
              </div>
              <div className="flex gap-3 mb-2">
                <input
                  type="text"
                  placeholder="重要事項（任意）"
                  value={newImportantNote}
                  onChange={(e) => setNewImportantNote(e.target.value)}
                  className="flex-1 border border-orange-200 rounded-lg px-4 py-2 text-orange-700 bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-300 placeholder-orange-300"
                />
              </div>
              <div className="flex gap-3 flex-wrap">
                <select
                  value={newCategory}
                  onChange={(e) => { setNewCategory(e.target.value); setNewCategoryOther(""); }}
                  className="border border-purple-200 rounded-lg px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm"
                >
                  <option value="">カテゴリー（任意）</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {newCategory === "その他" && (
                  <input
                    type="text"
                    value={newCategoryOther}
                    onChange={(e) => setNewCategoryOther(e.target.value)}
                    placeholder="カテゴリーを入力"
                    className="border border-purple-200 rounded-lg px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-300 text-sm"
                  />
                )}
                <input
                  type="text"
                  placeholder="データ保存場所（任意）"
                  value={newDataLocation}
                  onChange={(e) => setNewDataLocation(e.target.value)}
                  className="flex-1 min-w-[160px] border border-gray-200 rounded-lg px-4 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
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
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">テンプレートから追加</h2>
                <button
                  onClick={() => setShowAddTemplate((v) => !v)}
                  className="text-xs text-blue-500 hover:text-blue-600 font-semibold border border-blue-200 px-2.5 py-1 rounded-lg transition-colors"
                >
                  ＋ テンプレートを追加
                </button>
              </div>

              {showAddTemplate && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newTemplateTitle}
                    onChange={(e) => setNewTemplateTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTemplate()}
                    placeholder="テンプレート名を入力"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    autoFocus
                  />
                  <button
                    onClick={addTemplate}
                    className="text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => { setShowAddTemplate(false); setNewTemplateTitle(""); }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <div key={template.id} className="group relative">
                    <button
                      onClick={() => { setSelectedTemplate(template.title); setSelectedTemplateId(template.id); setTemplateDueDate(""); fetchTemplateSubtasks(template.id); }}
                      className={`text-xs border px-3 py-1.5 rounded-full transition-colors shadow-sm pr-7 ${
                        selectedTemplate === template.title
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "bg-white border-gray-200 hover:border-blue-300 hover:text-blue-500 text-gray-600"
                      }`}
                    >
                      + {template.title}
                    </button>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400 transition-colors text-xs font-bold leading-none"
                      title="削除"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {templates.length === 0 && (
                  <p className="text-xs text-gray-400">テンプレートがまだありません。「＋ テンプレートを追加」から登録してください。</p>
                )}
              </div>

              {selectedTemplate && selectedTemplateId && (
                <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3 mb-3">
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
                      onClick={() => { setSelectedTemplate(null); setSelectedTemplateId(null); }}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                    >
                      キャンセル
                    </button>
                  </div>

                  {/* テンプレートのサブタスク一覧 */}
                  <div className="border-t border-blue-100 pt-2">
                    <p className="text-xs text-blue-600 font-semibold mb-1.5">サブタスクテンプレート</p>
                    {(templateSubtasksMap[selectedTemplateId] || []).map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-600 flex-1">・{sub.title}{sub.assignee && <span className="text-blue-400 ml-1">👤{sub.assignee}</span>}</span>
                        <button
                          onClick={() => deleteTemplateSubtask(selectedTemplateId, sub.id)}
                          className="text-gray-300 hover:text-red-400 text-xs"
                        >×</button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="サブタスクを追加..."
                        value={newTplSubtaskTitle[selectedTemplateId] ?? ""}
                        onChange={(e) => setNewTplSubtaskTitle((p) => ({ ...p, [selectedTemplateId]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addTemplateSubtask(selectedTemplateId)}
                        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <select
                        value={newTplSubtaskAssignee[selectedTemplateId] ?? ""}
                        onChange={(e) => setNewTplSubtaskAssignee((p) => ({ ...p, [selectedTemplateId]: e.target.value }))}
                        className="w-24 border border-gray-200 rounded px-1 py-1 text-xs text-gray-600 bg-white focus:outline-none"
                      >
                        <option value="">責任者</option>
                        {profiles.map((p) => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => addTemplateSubtask(selectedTemplateId)}
                        className="text-xs bg-blue-400 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors"
                      >追加</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* フィルター */}
            <div className="flex gap-2 flex-wrap mb-2">
              <span className="text-[10px] text-gray-400 self-center">カテゴリー:</span>
              <button onClick={() => setFilterCategory("")} className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${!filterCategory ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>すべて</button>
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setFilterCategory(filterCategory === c ? "" : c)} className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${filterCategory === c ? "bg-purple-500 text-white" : "bg-purple-50 text-purple-600 hover:bg-purple-100"}`}>{c}</button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap mb-3">
              <span className="text-[10px] text-gray-400 self-center">顧客区分:</span>
              <button onClick={() => setFilterClientType("")} className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${!filterClientType ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>すべて</button>
              {["企業", "資産家"].map((ct) => (
                <button key={ct} onClick={() => setFilterClientType(filterClientType === ct ? "" : ct)} className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${filterClientType === ct ? "bg-blue-500 text-white" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}>{ct}</button>
              ))}
            </div>

            {/* ビュー切り替え */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setView("list")}
                className={`inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full font-semibold transition-colors ${view === "list" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                <LayoutList size={12} /> リスト
              </button>
              <button
                onClick={() => setView("kanban")}
                className={`inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full font-semibold transition-colors ${view === "kanban" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                <Columns size={12} /> カラム
              </button>
              <button
                onClick={() => setView("project")}
                className={`inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full font-semibold transition-colors ${view === "project" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                <Folder size={12} /> 案件別
              </button>
            </div>

            {/* ローディング */}
            {loading && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm">読み込み中...</p>
              </div>
            )}

            {/* カンバンビュー */}
            {!loading && view === "kanban" && (
              <KanbanView tasks={tasks} onStatusChange={changeTaskStatus} onDelete={deleteTask} onRegisterTemplate={registerAsTemplate} />
            )}

            {/* 案件別ビュー */}
            {!loading && view === "project" && (
              <ProjectView activeTasks={activeTasks} onToggleComplete={toggleCompleteTask} onDelete={deleteTask} onGenerate={generateMonthlyTask} />
            )}

            {/* 進行中タスク一覧（テーブル＋展開式） */}
            {!loading && view === "list" && activeTasks.length > 0 && (

              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">進行中 ({activeTasks.length})</h2>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] text-gray-400 border-b border-gray-100 bg-gray-50">
                        <th className="text-left py-2 px-3 font-semibold w-8">重要度</th>
                        <th className="text-left py-2 px-3 font-semibold">タスク名</th>
                        <th className="text-left py-2 px-3 font-semibold hidden sm:table-cell">クライアント</th>
                        <th className="text-left py-2 px-3 font-semibold hidden md:table-cell">カテゴリ</th>
                        <th className="text-left py-2 px-3 font-semibold hidden md:table-cell">責任者</th>
                        <th className="text-left py-2 px-3 font-semibold hidden sm:table-cell">締切</th>
                        <th className="text-left py-2 px-3 font-semibold w-16">進捗</th>
                        <th className="text-left py-2 px-3 font-semibold w-24">ステータス</th>
                      </tr>
                    </thead>
                    <tbody>
                  {activeTasks.map((task) => {
                    const done = task.subtasks.filter(s => s.is_completed).length;
                    const total = task.subtasks.length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : null;
                    const isExpanded = task.showSubtasks || editingTaskId === task.id;
                    return (
                    <React.Fragment key={task.id}>
                      <tr
                        className={`border-b border-gray-50 hover:bg-blue-50/50 cursor-pointer transition-colors ${isExpanded ? "bg-blue-50/30" : ""}`}
                        onClick={() => toggleSubtasks(task.id)}
                      >
                        <td className="py-2.5 px-3">
                          {task.importance === "最高" && <span className="inline-flex items-center gap-0.5 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold"><Circle size={7} className="fill-red-500 text-red-500" /> 最高</span>}
                          {task.importance === "高" && <span className="inline-flex items-center gap-0.5 text-[10px] bg-orange-100 text-orange-500 px-1.5 py-0.5 rounded-full font-semibold"><Circle size={7} className="fill-orange-400 text-orange-400" /> 高</span>}
                          {(!task.importance || task.importance === "通常" || task.importance === "中") && <span className="text-[10px] text-gray-300">通常</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            {task.task_number && <span className="text-[9px] bg-gray-200 text-gray-500 px-1 py-0.5 rounded font-mono">{task.task_number}</span>}
                            <span className="font-medium text-gray-800">{task.title}</span>
                            {task.client_type === "企業" && <span className="inline-flex items-center gap-0.5 text-[9px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded-full sm:hidden"><Building2 size={8} /></span>}
                            {task.task_type === "定例" && <span className="inline-flex items-center text-[9px] bg-teal-100 text-teal-600 px-1 py-0.5 rounded-full"><CalendarDays size={8} /></span>}
                            {task.task_type === "スポット" && <span className="inline-flex items-center text-[9px] bg-orange-100 text-orange-500 px-1 py-0.5 rounded-full"><Zap size={8} /></span>}
                            {task.is_recurring && <span className="inline-flex items-center text-[9px] bg-purple-100 text-purple-600 px-1 py-0.5 rounded-full"><Repeat size={8} /></span>}
                          </div>
                          {task.important_note && <p className="text-[10px] text-orange-500 mt-0.5"><AlertTriangle size={9} className="inline" /> {task.important_note}</p>}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-500 hidden sm:table-cell">{task.project_name || "—"}</td>
                        <td className="py-2.5 px-3 hidden md:table-cell">
                          {task.category ? <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">{task.category}</span> : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-500 hidden md:table-cell">{task.assignee || "—"}</td>
                        <td className="py-2.5 px-3 text-xs text-gray-500 hidden sm:table-cell">{task.due_date || "—"}</td>
                        <td className="py-2.5 px-3">
                          {pct !== null ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-10 bg-gray-100 rounded-full h-1.5"><div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} /></div>
                              <span className="text-[10px] text-gray-400">{done}/{total}</span>
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={task.status || '進行中'}
                            onChange={(e) => changeTaskStatus(task.id, e.target.value)}
                            className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-600 focus:outline-none cursor-pointer"
                          >
                            <option value="進行中">進行中</option>
                            <option value="完了（未請求）">完了（未請求）</option>
                            <option value="請求済">請求済</option>
                            <option value="回収済">回収済</option>
                          </select>
                        </td>
                      </tr>
                      {/* 展開エリア：編集フォーム＋サブタスク＋アクション */}
                      {isExpanded && (
                        <tr><td colSpan={8} className="p-0">
                          <div className="bg-gray-50/50 border-b border-gray-100 px-4 py-3">
                            {/* 編集フォーム */}
                            {editingTaskId === task.id ? (
                              <div className="flex flex-col gap-2 mb-3 bg-white rounded-xl p-3 border border-blue-100">
                                <div className="flex gap-2 flex-wrap">
                                <input
                                  type="text"
                                  value={editingTaskTitle}
                                  onChange={(e) => setEditingTaskTitle(e.target.value)}
                                  placeholder="タスク名"
                                  className="flex-1 min-w-[200px] border border-blue-300 rounded-lg px-3 py-1 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  autoFocus
                                />
                                <textarea
                                  value={editingTaskDescription}
                                  onChange={(e) => setEditingTaskDescription(e.target.value)}
                                  placeholder="概要（任意）"
                                  rows={1}
                                  className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-1 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                                />
                                <div className="flex gap-2 flex-wrap">
                                  <select
                                    value={editingTaskClientId}
                                    onChange={(e) => {
                                      const cid = e.target.value;
                                      setEditingTaskClientId(cid);
                                      const c = clients.find((cl) => cl.id === cid);
                                      setEditingTaskProjectName(c?.name || "");
                                      if (c?.client_type) setEditingTaskClientType(c.client_type);
                                    }}
                                    className="flex-1 min-w-[120px] border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  >
                                    <option value="">クライアント選択</option>
                                    {clients.map((c) => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={editingTaskAssignee}
                                    onChange={(e) => setEditingTaskAssignee(e.target.value)}
                                    className="w-32 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  >
                                    <option value="">責任者</option>
                                    {profiles.map((p) => (
                                      <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={editingTaskImportance}
                                    onChange={(e) => setEditingTaskImportance(e.target.value)}
                                    className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  >
                                    <option value="最高">最高</option>
                                    <option value="高">高</option>
                                    <option value="通常">通常</option>
                                  </select>
                                  <select
                                    value={editingTaskClientType}
                                    onChange={(e) => setEditingTaskClientType(e.target.value)}
                                    className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  >
                                    <option value="">顧客区分</option>
                                    <option value="企業">企業</option>
                                    <option value="資産家">資産家</option>
                                    <option value="一般社団法人">一般社団法人</option>
                                    <option value="その他">その他</option>
                                    <option value="自社">自社</option>
                                  </select>
                                  <select
                                    value={editingTaskTaskType}
                                    onChange={(e) => setEditingTaskTaskType(e.target.value)}
                                    className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  >
                                    <option value="">頻度</option>
                                    <option value="定例">定例</option>
                                    <option value="スポット">スポット</option>
                                  </select>
                                </div>
                                <div className="flex gap-2 items-center flex-wrap">
                                  <select
                                    value={editingTaskCategory}
                                    onChange={(e) => { setEditingTaskCategory(e.target.value); setEditingTaskCategoryOther(""); }}
                                    className="w-36 border border-purple-200 rounded-lg px-2 py-1 text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                                  >
                                    <option value="">カテゴリー</option>
                                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                  {editingTaskCategory === "その他" && (
                                    <input
                                      type="text"
                                      value={editingTaskCategoryOther}
                                      onChange={(e) => setEditingTaskCategoryOther(e.target.value)}
                                      placeholder="カテゴリー入力"
                                      className="w-32 border border-purple-200 rounded-lg px-2 py-0.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    />
                                  )}
                                </div>
                                <div className="flex gap-2 items-center flex-wrap">
                                  <input
                                    type="date"
                                    value={editingTaskDueDate}
                                    onChange={(e) => setEditingTaskDueDate(e.target.value)}
                                    className="border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  />
                                  <input
                                    type="text"
                                    value={editingTaskDataLocation}
                                    onChange={(e) => setEditingTaskDataLocation(e.target.value)}
                                    placeholder="データ保存場所"
                                    className="flex-1 border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  />
                                  <button
                                    onClick={() => saveTaskEdit(task.id)}
                                    className="text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold px-3 py-1 rounded-lg transition-colors"
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
                            </div>
                            ) : (
                              <div className="flex flex-wrap gap-2 mb-3">
                                <button
                                  onClick={() => {
  setEditingTaskId(task.id); setEditingTaskTitle(task.title); setEditingTaskDescription(task.description ?? ""); setEditingTaskDueDate(task.due_date ?? ""); setEditingTaskDataLocation(task.data_location ?? ""); setEditingTaskProjectName(task.project_name ?? ""); setEditingTaskImportance(task.importance || "通常"); setEditingTaskClientType(task.client_type ?? ""); setEditingTaskTaskType(task.task_type ?? ""); setEditingTaskAssignee(task.assignee ?? ""); setEditingTaskClientId(task.client_id ?? "");
  const cat = task.category ?? ""; const isOther = cat.startsWith("その他："); setEditingTaskCategory(isOther ? "その他" : cat); setEditingTaskCategoryOther(isOther ? cat.replace("その他：", "") : "");
}}
                                  className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 hover:border-blue-400 px-2.5 py-1 rounded-lg transition-colors font-semibold"
                                >
                                  編集
                                </button>
                                {task.is_recurring && (
                                  <button onClick={() => generateMonthlyTask(task)} className="inline-flex items-center gap-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-600 font-semibold px-2.5 py-1 rounded-lg transition-colors"><Copy size={11} /> 今月分</button>
                                )}
                                <button onClick={() => registerAsTemplate(task)} className="inline-flex items-center gap-1 text-xs text-green-500 hover:text-green-700 border border-green-200 hover:border-green-400 px-2.5 py-1 rounded-lg transition-colors font-semibold"><ClipboardList size={11} /> テンプレ登録</button>
                                <button onClick={() => deleteTask(task.id)} className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2.5 py-1 rounded-lg transition-colors font-semibold">削除</button>
                              </div>
                            )}
                            {/* サブタスク一覧 */}
                            <div>
                              <p className="text-xs font-semibold text-gray-400 mb-2">サブタスク</p>
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
                                                value={editingSubtaskImportantNote}
                                                onChange={(e) => setEditingSubtaskImportantNote(e.target.value)}
                                                placeholder="重要事項（任意）"
                                                className="border border-orange-200 rounded px-2 py-0.5 text-xs text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-orange-50"
                                              />
                                              <select
                                                value={editingSubtaskAssignee}
                                                onChange={(e) => setEditingSubtaskAssignee(e.target.value)}
                                                className="border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                              >
                                                <option value="">責任者を選択</option>
                                                {profiles.map((p) => (
                                                  <option key={p.id} value={p.name}>{p.name}</option>
                                                ))}
                                              </select>
                                            </div>
                                          ) : (
                                            <div className="flex-1">
                                              <span className={`text-sm ${sub.is_completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                                                {sub.title}
                                              </span>
                                              {sub.description && (
                                                <p className="text-xs text-gray-400 mt-0.5">{sub.description}</p>
                                              )}
                                              {sub.important_note && (
                                                <p className="text-xs text-orange-500 mt-0.5 flex items-center gap-0.5"><AlertTriangle size={10} /> {sub.important_note}</p>
                                              )}
                                              {sub.assignee && (
                                                <p className="text-xs text-blue-400 mt-0.5 flex items-center gap-0.5"><User size={10} /> {sub.assignee}</p>
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
                                              onClick={() => { setEditingSubtaskId(sub.id); setEditingSubtaskTitle(sub.title); setEditingSubtaskDescription(sub.description ?? ""); setEditingSubtaskImportantNote(sub.important_note ?? ""); setEditingSubtaskAssignee(sub.assignee ?? ""); }}
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
                              <select
                                value={newSubtaskAssignees[task.id] ?? ""}
                                onChange={(e) => setNewSubtaskAssignees({ ...newSubtaskAssignees, [task.id]: e.target.value })}
                                className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                              >
                                <option value="">責任者</option>
                                {profiles.map((p) => (
                                  <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => addSubtask(task.id)}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold px-3 py-1.5 rounded-lg transition-colors"
                              >
                                追加
                              </button>
                            </div>
                            </div>
                          </div>
                          </div>
                        </td>
                      </tr>
                      )}
                    </React.Fragment>
                    );
                  })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ステータス別セクション（完了以降）- リスト表示のみ */}
            {!loading && view === "list" && (
              <>
                {[
                  { label: "完了（未請求）", tasks: completedTasks, color: "text-green-600", border: "border-green-100" },
                  { label: "請求済", tasks: invoicedTasks, color: "text-blue-600", border: "border-blue-100" },
                  { label: "回収済", tasks: collectedTasks, color: "text-gray-500", border: "border-gray-100" },
                ].map(({ label, tasks: statusTasks, color, border }) =>
                  statusTasks.length > 0 ? (
                    <div key={label} className="mb-6">
                      <h2 className={`text-sm font-semibold mb-3 ${color}`}>{label} ({statusTasks.length})</h2>
                      <div className="flex flex-col gap-2">
                        {statusTasks.map((task) => (
                          <div key={task.id} className={`bg-white rounded-2xl border ${border} p-4 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity`}>
                            <div className="flex-1 min-w-0 mr-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm text-gray-600 font-medium truncate">{task.title}</p>
                                {task.client_type === "企業" && <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full"><Building2 size={9} /> 企業</span>}
                                {task.client_type === "資産家" && <span className="inline-flex items-center gap-0.5 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full"><Crown size={9} /> 資産家</span>}
                                {task.task_type && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{task.task_type}</span>}
                              </div>
                              {task.project_name && <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5"><Folder size={9} /> {task.project_name}</p>}
                              {task.subtasks.length > 0 && <p className="text-[10px] text-gray-300 mt-0.5">サブタスク {task.subtasks.length}件</p>}
                            </div>
                            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                              <button
                                onClick={() => registerAsTemplate(task)}
                                className="inline-flex items-center gap-1 text-xs text-green-500 hover:text-green-700 border border-green-200 hover:border-green-400 px-2.5 py-1 rounded-full transition-colors font-semibold"
                              >
                                <ClipboardList size={11} /> テンプレ登録
                              </button>
                              <select
                                value={task.status || '完了（未請求）'}
                                onChange={(e) => changeTaskStatus(task.id, e.target.value)}
                                className="text-xs border border-gray-200 rounded-full px-2 py-1 bg-white text-gray-600 focus:outline-none cursor-pointer"
                              >
                                <option value="進行中">進行中</option>
                                <option value="完了（未請求）">完了（未請求）</option>
                                <option value="請求済">請求済</option>
                                <option value="回収済">回収済</option>
                              </select>
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
                  ) : null
                )}
              </>
            )}

            {/* タスクがない場合 */}
            {!loading && view === "list" && tasks.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <LayoutList size={40} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">タスクを追加してみましょう！</p>
              </div>
            )}

          </div>

          {/* 右カラム：担当者ごと未完了一覧 */}
          <div className="w-56 shrink-0 hidden lg:block">
            <SidebarByAssignee activeTasks={activeTasks} />
          </div>

        </div>
      </div>
    </div>
  );
}

// カンバンビュー（ステータス別カラム表示）
const KANBAN_COLUMNS = [
  { status: "進行中", label: "進行中", bg: "bg-blue-50", header: "bg-blue-100 text-blue-700" },
  { status: "完了（未請求）", label: "完了（未請求）", bg: "bg-green-50", header: "bg-green-100 text-green-700" },
  { status: "請求済", label: "請求済", bg: "bg-purple-50", header: "bg-purple-100 text-purple-700" },
  { status: "回収済", label: "回収済", bg: "bg-gray-50", header: "bg-gray-100 text-gray-600" },
];

function KanbanView({
  tasks,
  onStatusChange,
  onDelete,
  onRegisterTemplate,
}: {
  tasks: Task[];
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onRegisterTemplate: (task: Task) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 mb-8" style={{ minWidth: 0 }}>
      {KANBAN_COLUMNS.map(({ status, label, bg, header }) => {
        const col = tasks.filter((t) => (t.status || "進行中") === status);
        return (
          <div key={status} className={`${bg} rounded-2xl flex-shrink-0 w-64`}>
            <div className={`${header} rounded-t-2xl px-4 py-2.5 flex items-center justify-between`}>
              <span className="text-xs font-bold">{label}</span>
              <span className="text-xs font-semibold opacity-70">{col.length}</span>
            </div>
            <div className="px-3 py-3 flex flex-col gap-2">
              {col.length === 0 && (
                <p className="text-[10px] text-gray-400 text-center py-4">なし</p>
              )}
              {col.map((task) => {
                const done = task.subtasks.filter((s) => s.is_completed).length;
                const total = task.subtasks.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : null;
                return (
                  <div key={task.id} className="bg-white rounded-xl shadow-sm p-3 border border-white">
                    <p className="text-sm font-semibold text-gray-800 mb-1 leading-snug">{task.title}</p>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {task.importance === "最高" && <span className="inline-flex items-center gap-0.5 text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded-full"><Circle size={7} className="fill-red-500 text-red-500" /> 最高</span>}
                      {task.importance === "高" && <span className="inline-flex items-center gap-0.5 text-[9px] bg-orange-100 text-orange-500 px-1 py-0.5 rounded-full"><Circle size={7} className="fill-orange-400 text-orange-400" /> 高</span>}
                      {task.client_type === "企業" && <span className="inline-flex items-center gap-0.5 text-[9px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded-full"><Building2 size={8} /></span>}
                      {task.client_type === "資産家" && <span className="inline-flex items-center gap-0.5 text-[9px] bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded-full"><Crown size={8} /></span>}
                      {task.task_type && <span className="text-[9px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded-full">{task.task_type}</span>}
                    </div>
                    {task.due_date && <p className="text-[10px] text-gray-400 mb-1 flex items-center gap-0.5"><CalendarDays size={9} /> {task.due_date}</p>}
                    {task.assignee && <p className="text-[10px] text-blue-400 mb-1 flex items-center gap-0.5"><User size={9} /> {task.assignee}</p>}
                    {pct !== null && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1">
                          <div className="bg-blue-400 h-1 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[9px] text-gray-400">{done}/{total}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <select
                        value={task.status || "進行中"}
                        onChange={(e) => onStatusChange(task.id, e.target.value)}
                        className="flex-1 text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 focus:outline-none cursor-pointer"
                      >
                        <option value="進行中">進行中</option>
                        <option value="完了（未請求）">完了</option>
                        <option value="請求済">請求済</option>
                        <option value="回収済">回収済</option>
                      </select>
                      <button
                        onClick={() => onRegisterTemplate(task)}
                        className="text-[10px] text-green-500 hover:text-green-700 shrink-0"
                        title="テンプレートに登録"
                      ><ClipboardList size={12} /></button>
                      <button
                        onClick={() => onDelete(task.id)}
                        className="text-[10px] text-gray-300 hover:text-red-400 shrink-0"
                      >✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 案件別ビュー
function ProjectView({
  activeTasks,
  onToggleComplete,
  onDelete,
  onGenerate,
}: {
  activeTasks: Task[];
  onToggleComplete: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  onGenerate: (task: Task) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // project_name でグループ化（未設定は「その他」）
  const groups: Record<string, Task[]> = {};
  for (const task of activeTasks) {
    const key = task.project_name?.trim() || "その他";
    if (!groups[key]) groups[key] = [];
    groups[key].push(task);
  }

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === "その他") return 1;
    if (b === "その他") return -1;
    return a.localeCompare(b, "ja");
  });

  if (sortedKeys.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-8">未完了タスクなし</p>;
  }

  return (
    <div className="flex flex-col gap-4 mb-8">
      {sortedKeys.map((project) => {
        const tasks = groups[project];
        const isCollapsed = collapsed[project] ?? false;
        const recurringTasks = tasks.filter((t) => t.is_recurring);
        return (
          <div key={project} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => setCollapsed((p) => ({ ...p, [project]: !p[project] }))}
              className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-700 flex items-center gap-1"><Folder size={13} /> {project}</span>
                {recurringTasks.length > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold"><Repeat size={9} /> {recurringTasks.length}件 毎月</span>
                )}
              </div>
              <span className="text-xs text-gray-400 flex items-center gap-0.5">{isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />} {tasks.length}件</span>
            </button>

            {!isCollapsed && (
              <div className="divide-y divide-gray-50">
                {tasks.map((task) => {
                  const done = task.subtasks.filter((s) => s.is_completed).length;
                  const total = task.subtasks.length;
                  const pct = total > 0 ? Math.round((done / total) * 100) : null;
                  return (
                    <div key={task.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800 truncate">{task.title}</p>
                          {task.is_recurring && <span className="inline-flex items-center text-[10px] bg-purple-100 text-purple-600 px-1 py-0.5 rounded-full shrink-0"><Repeat size={9} /></span>}
                        </div>
                        {task.due_date && <p className="text-xs text-gray-400">締切: {task.due_date}</p>}
                        {task.assignee && <p className="text-xs text-blue-400 flex items-center gap-0.5"><User size={10} /> {task.assignee}</p>}
                        {pct !== null && (
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-400">{done}/{total}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {task.is_recurring && (
                          <button
                            onClick={() => onGenerate(task)}
                            className="inline-flex items-center gap-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-600 font-semibold px-2 py-1 rounded-full transition-colors"
                          >
                            <Copy size={11} /> 今月分
                          </button>
                        )}
                        <button
                          onClick={() => onToggleComplete(task.id, task.is_completed)}
                          className="text-xs bg-green-100 hover:bg-green-200 text-green-600 font-semibold px-2 py-1 rounded-full transition-colors"
                        >
                          完了
                        </button>
                        <button
                          onClick={() => onDelete(task.id)}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-500 font-semibold px-2 py-1 rounded-full transition-colors"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 担当者ごとの未完了タスク一覧サイドバー
function SidebarByAssignee({ activeTasks }: { activeTasks: Task[] }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = (assignee: string) => {
    setCollapsed((prev) => ({ ...prev, [assignee]: !prev[assignee] }));
  };

  // 担当者ごとにグループ化（タスク担当者 + サブタスク担当者を含む、担当者なしは「未割当」）
  const groups: Record<string, Task[]> = {};
  for (const task of activeTasks) {
    const assignees = new Set<string>();
    const taskAssignee = task.assignee?.trim();
    if (taskAssignee) assignees.add(taskAssignee); else assignees.add("未割当");
    // サブタスクの担当者も追加
    for (const sub of task.subtasks || []) {
      if (sub.assignee?.trim()) assignees.add(sub.assignee.trim());
    }
    for (const key of assignees) {
      if (!groups[key]) groups[key] = [];
      if (!groups[key].find((t) => t.id === task.id)) groups[key].push(task);
    }
  }

  // 担当者名でソート（「未割当」は最後）
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === "未割当") return 1;
    if (b === "未割当") return -1;
    return a.localeCompare(b, "ja");
  });

  if (sortedKeys.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">責任者別</h2>
        <p className="text-xs text-gray-300 text-center py-4">未完了タスクなし</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">責任者別</h2>
      <div className="flex flex-col gap-3">
        {sortedKeys.map((assignee) => {
          const tasks = groups[assignee];
          const isCollapsed = collapsed[assignee] ?? false;
          return (
            <div key={assignee} className="border border-gray-100 rounded-xl overflow-hidden">
              {/* 担当者ヘッダー */}
              <button
                onClick={() => toggleCollapse(assignee)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-xs font-bold text-gray-700 truncate flex items-center gap-1"><User size={11} /> {assignee}</span>
                <span className="text-xs text-gray-400 shrink-0 ml-1">
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />} {tasks.length}
                </span>
              </button>

              {/* タスク一覧 */}
              {!isCollapsed && (
                <div className="px-2 py-2 flex flex-col gap-2">
                  {tasks.map((task) => {
                    const activeSubs = task.subtasks.filter((s) => !s.is_completed);
                    return (
                      <div key={task.id}>
                        {/* タスク行 */}
                        <div className="flex items-start gap-1.5">
                          <span className="text-blue-400 text-xs mt-0.5 shrink-0">●</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">{task.title}</p>
                            {task.due_date && (
                              <p className="text-[10px] text-gray-400">締切: {task.due_date}</p>
                            )}
                            {task.important_note && (
                              <p className="text-[10px] text-orange-500 truncate flex items-center gap-0.5"><AlertTriangle size={9} /> {task.important_note}</p>
                            )}
                          </div>
                        </div>

                        {/* サブタスク行（未完了のみ） */}
                        {activeSubs.length > 0 && (
                          <div className="ml-4 mt-1 flex flex-col gap-1">
                            {activeSubs.map((sub) => (
                              <div key={sub.id} className="flex items-start gap-1">
                                <span className="text-gray-300 text-[10px] mt-0.5 shrink-0">└</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] text-gray-500 truncate">{sub.title}</p>
                                  {sub.assignee && sub.assignee !== assignee && (
                                    <p className="text-[10px] text-blue-400 flex items-center gap-0.5"><User size={9} /> {sub.assignee}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
