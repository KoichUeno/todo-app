"use client";

import React, { useState, useEffect, Suspense } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { applyPlaceholders, detectPlaceholders } from "@/lib/template-placeholders";
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
  status: '未着手' | '進行中' | '完了';
  order_num: number;
  assignee: string;
  due_date: string;
  start_date: string;
};

type Profile = {
  id: string;
  name: string;
  department: string;
  role: string;
};

type SubtaskMemo = {
  id: string;
  subtask_id: string;
  content: string;
  user_name: string;
  created_at: string;
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
  start_date: string;
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

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newImportantNote, setNewImportantNote] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [loading, setLoading] = useState(true);
  const [insertSubtaskAfter, setInsertSubtaskAfter] = useState<{ taskId: string; afterIndex: number } | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateDueDate, setTemplateDueDate] = useState("");
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  // テンプレートのプレースホルダ置換用の入力値
  const [templateMonth, setTemplateMonth] = useState<string>(
    () => String(new Date().getMonth() + 1)
  );
  const [templateClientId, setTemplateClientId] = useState<string>("");

  // 完了サブタスクの折り畳み状態(taskId ごと、既定=折り畳み)
  const [expandedCompletedSubtasks, setExpandedCompletedSubtasks] = useState<Record<string, boolean>>({});

  // サブタスク担当者一括設定モーダル
  const [bulkAssigneeTaskId, setBulkAssigneeTaskId] = useState<string | null>(null);
  const [bulkAssigneePending, setBulkAssigneePending] = useState<Record<string, string>>({});
  const [bulkAssigneeSaving, setBulkAssigneeSaving] = useState(false);

  const openBulkAssigneeModal = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const initial: Record<string, string> = {};
    task.subtasks.forEach((s) => { initial[s.id] = s.assignee || ""; });
    setBulkAssigneePending(initial);
    setBulkAssigneeTaskId(taskId);
  };

  const closeBulkAssigneeModal = () => {
    setBulkAssigneeTaskId(null);
    setBulkAssigneePending({});
  };

  const saveBulkAssignees = async () => {
    if (!bulkAssigneeTaskId) return;
    const task = tasks.find((t) => t.id === bulkAssigneeTaskId);
    if (!task) return;
    // 変更のあったサブタスクだけ PATCH する
    const changed = task.subtasks.filter((s) => {
      const newVal = (bulkAssigneePending[s.id] ?? "").trim();
      const oldVal = (s.assignee || "").trim();
      return newVal !== oldVal;
    });
    if (changed.length === 0) {
      closeBulkAssigneeModal();
      return;
    }
    setBulkAssigneeSaving(true);
    try {
      await Promise.all(
        changed.map((s) =>
          fetch('/api/subtasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: s.id, assignee: bulkAssigneePending[s.id] || null }),
          })
        )
      );
      // ローカル状態を更新
      setTasks((prev) =>
        prev.map((t) =>
          t.id === bulkAssigneeTaskId
            ? {
                ...t,
                subtasks: t.subtasks.map((s) => ({
                  ...s,
                  assignee: bulkAssigneePending[s.id] ?? s.assignee,
                })),
              }
            : t
        )
      );
      closeBulkAssigneeModal();
    } finally {
      setBulkAssigneeSaving(false);
    }
  };

  const applyBulkAssigneeToAll = (name: string) => {
    if (!bulkAssigneeTaskId) return;
    const task = tasks.find((t) => t.id === bulkAssigneeTaskId);
    if (!task) return;
    const next: Record<string, string> = {};
    task.subtasks.forEach((s) => { next[s.id] = name; });
    setBulkAssigneePending(next);
  };

  // 繰越シリーズの過去履歴
  type HistoryItem = {
    id: string;
    title: string;
    task_number: string | null;
    due_date: string | null;
    status: string | null;
    is_completed: boolean;
    important_note: string | null;
    created_at: string;
    assignee: string | null;
    project_name: string | null;
    subtasks: Array<{
      id: string;
      title: string;
      is_completed: boolean;
      important_note: string | null;
      description: string | null;
      assignee: string | null;
      order_num: number;
    }>;
  };
  const [taskHistoryMap, setTaskHistoryMap] = useState<Record<string, HistoryItem[]>>({});
  const [taskHistoryLoading, setTaskHistoryLoading] = useState<Record<string, boolean>>({});
  // 履歴項目ごとの詳細展開状態(historyItemId → 展開中か)
  const [expandedHistoryItems, setExpandedHistoryItems] = useState<Record<string, boolean>>({});

  const fetchTaskHistory = async (taskId: string) => {
    setTaskHistoryLoading((p) => ({ ...p, [taskId]: true }));
    try {
      const res = await fetch(`/api/tasks/history?task_id=${taskId}&months=12`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.history)) {
        setTaskHistoryMap((prev) => ({ ...prev, [taskId]: data.history }));
      }
    } finally {
      setTaskHistoryLoading((p) => ({ ...p, [taskId]: false }));
    }
  };

  // タスクが展開されたら、まだ履歴が無いものを自動ロード
  useEffect(() => {
    const needsFetch = tasks
      .filter((t) => t.showSubtasks && !taskHistoryMap[t.id] && !taskHistoryLoading[t.id])
      .map((t) => t.id);
    if (needsFetch.length === 0) return;
    needsFetch.forEach((id) => { fetchTaskHistory(id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.map((t) => `${t.id}:${t.showSubtasks}`).join('|')]);

  // タスク単位のチャット/メモ
  type TaskMemo = {
    id: string;
    task_id: string;
    content: string;
    user_name: string;
    created_at: string;
  };
  const [taskMemosMap, setTaskMemosMap] = useState<Record<string, TaskMemo[]>>({});
  const [newTaskMemoInput, setNewTaskMemoInput] = useState<Record<string, string>>({});
  const [taskMemoLoading, setTaskMemoLoading] = useState<Record<string, boolean>>({});

  const fetchTaskMemos = async (taskId: string) => {
    const res = await fetch(`/api/task-memos?task_id=${taskId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) {
      setTaskMemosMap((prev) => ({ ...prev, [taskId]: data }));
    }
  };

  const postTaskMemo = async (taskId: string) => {
    const content = (newTaskMemoInput[taskId] || "").trim();
    if (!content) return;
    setTaskMemoLoading((p) => ({ ...p, [taskId]: true }));
    try {
      const res = await fetch('/api/task-memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          content,
          user_name: currentUser?.name || '',
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setTaskMemosMap((prev) => ({
          ...prev,
          [taskId]: [created, ...(prev[taskId] || [])],
        }));
        setNewTaskMemoInput((p) => ({ ...p, [taskId]: "" }));
      }
    } finally {
      setTaskMemoLoading((p) => ({ ...p, [taskId]: false }));
    }
  };

  const deleteTaskMemo = async (taskId: string, memoId: string) => {
    const res = await fetch(`/api/task-memos?id=${memoId}`, { method: 'DELETE' });
    if (res.ok) {
      setTaskMemosMap((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] || []).filter((m) => m.id !== memoId),
      }));
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || '削除できません');
    }
  };

  // AI 重要事項サポート(上野さん限定、/api/ai/suggest-concerns を呼ぶ)
  // scope をキーにして複数の入力箇所で独立に状態管理する:
  //   - 'new-task' = 新規タスク作成フォーム
  //   - 'sub:<taskId>' = 該当タスクへの新規サブタスク追加フォーム
  //   - 'edit-sub:<subtaskId>' = 既存サブタスク編集フォーム
  const [aiConcernsMap, setAiConcernsMap] = useState<
    Record<string, { questions: string[]; loading: boolean; error: string | null }>
  >({});

  const fetchAIConcerns = async (
    scope: string,
    params: { task_title?: string; subtask_title?: string; client_id?: string; category?: string }
  ) => {
    setAiConcernsMap((prev) => ({
      ...prev,
      [scope]: { questions: [], loading: true, error: null },
    }));
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch('/api/ai/suggest-concerns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'AI 相談に失敗しました');
      }
      setAiConcernsMap((prev) => ({
        ...prev,
        [scope]: { questions: data.questions as string[], loading: false, error: null },
      }));
    } catch (e) {
      setAiConcernsMap((prev) => ({
        ...prev,
        [scope]: {
          questions: [],
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        },
      }));
    }
  };

  const clearAIConcerns = (scope: string) => {
    setAiConcernsMap((prev) => {
      const next = { ...prev };
      delete next[scope];
      return next;
    });
  };

  // 重要事項の AI 問いかけはログイン済み全ユーザーが利用可能
  // (2026-04-16 に上野さん限定を解除)
  const canUseAIConcerns = !!currentUser;

  const [newSubtaskTitles, setNewSubtaskTitles] = useState<Record<string, string>>({});

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskDescription, setEditingTaskDescription] = useState("");
  const [editingTaskDueDate, setEditingTaskDueDate] = useState("");
  const [editingTaskDataLocation, setEditingTaskDataLocation] = useState("");
  const [editingTaskStartDate, setEditingTaskStartDate] = useState("");
  const [editingTaskProjectName, setEditingTaskProjectName] = useState("");
  const [editingTaskImportance, setEditingTaskImportance] = useState("通常");
  const [editingTaskClientType, setEditingTaskClientType] = useState("");
  const [editingTaskTaskType, setEditingTaskTaskType] = useState("");
  const [editingTaskAssignee, setEditingTaskAssignee] = useState("");
  const [editingTaskClientId, setEditingTaskClientId] = useState("");
  const [editingTaskImportantNote, setEditingTaskImportantNote] = useState("");

  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskParentTaskId, setEditingSubtaskParentTaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [editingSubtaskDescription, setEditingSubtaskDescription] = useState("");
  const [editingSubtaskImportantNote, setEditingSubtaskImportantNote] = useState("");
  const [editingSubtaskAssignee, setEditingSubtaskAssignee] = useState("");
  const [editingSubtaskDueDate, setEditingSubtaskDueDate] = useState("");
  const [editingSubtaskStartDate, setEditingSubtaskStartDate] = useState("");
  const [editingSubtaskStatus, setEditingSubtaskStatus] = useState<'未着手' | '進行中' | '完了'>('未着手');

  const [subtaskMemos, setSubtaskMemos] = useState<SubtaskMemo[]>([]);
  const [newMemoContent, setNewMemoContent] = useState("");
  const [loadingMemos, setLoadingMemos] = useState(false);

  const [newSubtaskAssignees, setNewSubtaskAssignees] = useState<Record<string, string>>({});
  const [newSubtaskDescriptions, setNewSubtaskDescriptions] = useState<Record<string, string>>({});
  const [newSubtaskNotes, setNewSubtaskNotes] = useState<Record<string, string>>({});
  const [newSubtaskNoteErrors, setNewSubtaskNoteErrors] = useState<Record<string, string>>({});
  const [editingSubtaskNoteError, setEditingSubtaskNoteError] = useState("");
  const [newSubtaskDueDates, setNewSubtaskDueDates] = useState<Record<string, string>>({});
  const [newSubtaskStartDates, setNewSubtaskStartDates] = useState<Record<string, string>>({});

  const [newProjectName, setNewProjectName] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newIsRecurring, setNewIsRecurring] = useState(false);
  const [newImportance, setNewImportance] = useState("通常");
  const [newClientType, setNewClientType] = useState("");
  const [newTaskType, setNewTaskType] = useState("");
  const [newDataLocation, setNewDataLocation] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryOther, setNewCategoryOther] = useState("");
  // 新規タスクと一緒に登録するサブタスク (空行は登録時に無視される)
  const [newInitialSubtasks, setNewInitialSubtasks] = useState<Array<{ title: string; assignee: string }>>([
    { title: "", assignee: "" },
  ]);

  // 新規タスクフォームの下書き自動保存・復元
  useEffect(() => {
    try {
      const draft = localStorage.getItem("taskDraft");
      if (draft) {
        const d = JSON.parse(draft);
        if (d.title) setNewTitle(d.title);
        if (d.description) setNewDescription(d.description);
        if (d.dueDate) setNewDueDate(d.dueDate);
        if (d.importantNote) setNewImportantNote(d.importantNote);
        if (d.assignee) setNewAssignee(d.assignee);
        if (d.projectName) setNewProjectName(d.projectName);
        if (d.clientId) setNewClientId(d.clientId);
        if (d.isRecurring) setNewIsRecurring(d.isRecurring);
        if (d.importance && d.importance !== "通常") setNewImportance(d.importance);
        if (d.clientType) setNewClientType(d.clientType);
        if (d.taskType) setNewTaskType(d.taskType);
        if (d.dataLocation) setNewDataLocation(d.dataLocation);
        if (d.category) setNewCategory(d.category);
        if (d.categoryOther) setNewCategoryOther(d.categoryOther);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const draft = {
      title: newTitle, description: newDescription, dueDate: newDueDate,
      importantNote: newImportantNote, assignee: newAssignee, projectName: newProjectName,
      clientId: newClientId, isRecurring: newIsRecurring, importance: newImportance,
      clientType: newClientType, taskType: newTaskType, dataLocation: newDataLocation,
      category: newCategory, categoryOther: newCategoryOther,
    };
    // 何か入力があるときだけ保存
    if (newTitle || newDescription || newDueDate || newImportantNote) {
      localStorage.setItem("taskDraft", JSON.stringify(draft));
    }
  }, [newTitle, newDescription, newDueDate, newImportantNote, newAssignee, newProjectName, newClientId, newIsRecurring, newImportance, newClientType, newTaskType, newDataLocation, newCategory, newCategoryOther]);

  // サブタスク編集パネルの下書き自動保存・復元
  useEffect(() => {
    try {
      const draft = localStorage.getItem("subtaskDraft");
      if (draft) {
        const d = JSON.parse(draft);
        if (d.parentTaskId) setEditingSubtaskParentTaskId(d.parentTaskId);
        if (d.subtaskId) setEditingSubtaskId(d.subtaskId);
        if (d.title) setEditingSubtaskTitle(d.title);
        if (d.description) setEditingSubtaskDescription(d.description);
        if (d.importantNote) setEditingSubtaskImportantNote(d.importantNote);
        if (d.assignee) setEditingSubtaskAssignee(d.assignee);
        if (d.dueDate) setEditingSubtaskDueDate(d.dueDate);
        if (d.startDate) setEditingSubtaskStartDate(d.startDate);
        if (d.status) setEditingSubtaskStatus(d.status);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (editingSubtaskId && (editingSubtaskTitle || editingSubtaskDescription || editingSubtaskImportantNote)) {
      const draft = {
        parentTaskId: editingSubtaskParentTaskId,
        subtaskId: editingSubtaskId,
        title: editingSubtaskTitle,
        description: editingSubtaskDescription,
        importantNote: editingSubtaskImportantNote,
        assignee: editingSubtaskAssignee,
        dueDate: editingSubtaskDueDate,
        startDate: editingSubtaskStartDate,
        status: editingSubtaskStatus,
      };
      localStorage.setItem("subtaskDraft", JSON.stringify(draft));
    }
  }, [editingSubtaskId, editingSubtaskParentTaskId, editingSubtaskTitle, editingSubtaskDescription, editingSubtaskImportantNote, editingSubtaskAssignee, editingSubtaskDueDate, editingSubtaskStartDate, editingSubtaskStatus]);

  const clearSubtaskDraft = () => {
    localStorage.removeItem("subtaskDraft");
  };

  const [editingTaskCategory, setEditingTaskCategory] = useState("");
  const [editingTaskCategoryOther, setEditingTaskCategoryOther] = useState("");

  const [filterCategory, setFilterCategory] = useState("");
  const [filterClientType, setFilterClientType] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterClientName, setFilterClientName] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateSubtasksMap, setTemplateSubtasksMap] = useState<Record<string, TemplateSubtask[]>>({});
  const [selectedTplSubtaskIds, setSelectedTplSubtaskIds] = useState<Record<string, boolean>>({});
  const [tplErrors, setTplErrors] = useState<{ client?: string; date?: string }>({});
  const [newTplSubtaskTitle, setNewTplSubtaskTitle] = useState<Record<string, string>>({});
  const [newTplSubtaskAssignee, setNewTplSubtaskAssignee] = useState<Record<string, string>>({});

  const [view, setView] = useState<"list" | "kanban" | "project" | "assignee">("list");

  // Undoバー用
  const [undoInfo, setUndoInfo] = useState<{ taskId: string; taskTitle: string; subtasks: Subtask[] } | null>(null);
  const undoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // URLパラメータ ?task=ID で指定タスクを自動で編集モードにする
  useEffect(() => {
    const taskId = searchParams.get('task');
    if (taskId && tasks.length > 0 && !editingTaskId) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setEditingTaskId(task.id);
        setEditingTaskTitle(task.title);
        setEditingTaskDescription(task.description ?? "");
        setEditingTaskDueDate(task.due_date ?? "");
        setEditingTaskStartDate(task.start_date ?? "");
        setEditingTaskDataLocation(task.data_location ?? "");
        setEditingTaskProjectName(task.project_name ?? "");
        setEditingTaskImportance(task.importance || "通常");
        setEditingTaskClientType(task.client_type ?? "");
        setEditingTaskTaskType(task.task_type ?? "");
        setEditingTaskAssignee(task.assignee ?? "");
        setEditingTaskClientId(task.client_id ?? "");
        setEditingTaskImportantNote(task.important_note ?? "");
        const cat = task.category ?? "";
        const isOther = cat.startsWith("その他：");
        setEditingTaskCategory(isOther ? "その他" : cat);
        setEditingTaskCategoryOther(isOther ? cat.replace("その他：", "") : "");
        // 該当タスクのサブタスクを展開してスクロール
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, showSubtasks: true } : t));
        setTimeout(() => {
          const el = document.getElementById(`task-${taskId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [searchParams, tasks]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        console.error('fetchTasks failed:', data);
        setTasks([]);
        return;
      }
      const tasksWithUI = data.map((t: Task) => ({
        ...t,
        showSubtasks: false,
      }));
      setTasks(tasksWithUI);
    } catch (e) {
      console.error('fetchTasks error:', e);
      setTasks([]);
    } finally {
      setLoading(false);
    }
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
    if (templateSubtasksMap[templateId]) {
      // 既にロード済み → 全て選択済みに戻す
      const ids: Record<string, boolean> = {};
      templateSubtasksMap[templateId].forEach((s) => { ids[s.id] = true; });
      setSelectedTplSubtaskIds(ids);
      return;
    }
    const res = await fetch(`/api/template-subtasks?template_id=${templateId}`);
    if (res.ok) {
      const data: TemplateSubtask[] = await res.json();
      setTemplateSubtasksMap((prev) => ({ ...prev, [templateId]: data || [] }));
      // 全サブタスクを選択済みで初期化
      const ids: Record<string, boolean> = {};
      (data || []).forEach((s) => { ids[s.id] = true; });
      setSelectedTplSubtaskIds(ids);
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

    // バリデーション
    const placeholders = detectPlaceholders(selectedTemplate);
    const needsClient = placeholders.includes('clientName');
    const errors: { client?: string; date?: string } = {};
    if (needsClient && !templateClientId) errors.client = "会社を選択してください";
    if (!templateDueDate) errors.date = "締切日を入力してください";
    if (Object.keys(errors).length > 0) {
      setTplErrors(errors);
      return;
    }
    setTplErrors({});

    // プレースホルダ置換用の値を組み立てる
    const selectedClient = clients.find((c) => c.id === templateClientId);
    const placeholderValues = {
      month: templateMonth || String(new Date().getMonth() + 1),
      clientName: selectedClient?.name ?? null,
    };

    // タイトルにプレースホルダが含まれていれば置換
    const resolvedTitle = applyPlaceholders(selectedTemplate, placeholderValues);

    // テンプレ名から task_type / category を推定(申告・月次入力の定例運用向け)
    let inferredTaskType: string | null = null;
    let inferredCategory: string | null = null;
    if (selectedTemplate.includes("申告")) {
      inferredTaskType = "定例";
      inferredCategory = "申告";
    } else if (selectedTemplate.includes("月次")) {
      inferredTaskType = "定例";
      inferredCategory = "帳簿入力";
    }

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: resolvedTitle,
        due_date: templateDueDate || null,
        is_recurring: true,
        client_id: selectedClient?.id || null,
        project_name: selectedClient?.name || null,
        task_type: inferredTaskType,
        category: inferredCategory,
        source_template_id: selectedTemplateId,
      }),
    });
    const newTask = await res.json();

    const subs = (templateSubtasksMap[selectedTemplateId] || []).filter((s) => selectedTplSubtaskIds[s.id]);
    const createdSubs = await Promise.all(
      subs.map((sub, i) =>
        fetch('/api/subtasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_id: newTask.id,
            title: applyPlaceholders(sub.title, placeholderValues),
            assignee: sub.assignee,
            order_num: i + 1,
          }),
        }).then((r) => r.json())
      )
    );

    setTasks((prev) => [{ ...newTask, subtasks: createdSubs, showSubtasks: false }, ...prev]);
    setSelectedTemplate(null);
    setSelectedTemplateId(null);
    setTemplateDueDate("");
    setTemplateClientId("");
  };

  // タスクを追加する
  const [addingTask, setAddingTask] = useState(false);
  const [addTaskError, setAddTaskError] = useState("");

  const addTask = async () => {
    if (!newTitle.trim() || addingTask) return;
    if (!newImportantNote.trim()) {
      setAddTaskError("重要事項を入力してください。重要な注意点や確認事項を記録しておきましょう。");
      return;
    }
    setAddingTask(true);
    setAddTaskError("");
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, description: newDescription || null, due_date: newDueDate || null, important_note: newImportantNote || null, assignee: newAssignee || null, project_name: newProjectName || null, is_recurring: newIsRecurring, importance: newImportance, client_type: newClientType || null, task_type: newTaskType || null, data_location: newDataLocation || null, category: resolveCategory(newCategory, newCategoryOther) || null, client_id: newClientId || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        setAddTaskError(`登録に失敗しました: ${err.error || res.statusText}`);
        return;
      }
      const newTask = await res.json();

      // 初期サブタスクがあれば順に登録
      const subtasksToCreate = newInitialSubtasks
        .map((s) => ({ title: s.title.trim(), assignee: s.assignee.trim() }))
        .filter((s) => s.title.length > 0);
      const createdSubtasks: Subtask[] = [];
      for (let i = 0; i < subtasksToCreate.length; i++) {
        const s = subtasksToCreate[i];
        try {
          const sres = await fetch('/api/subtasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              task_id: newTask.id,
              title: s.title,
              assignee: s.assignee || null,
              order_num: i + 1,
            }),
          });
          if (sres.ok) {
            const created = await sres.json();
            createdSubtasks.push(created);
          }
        } catch {
          // 1 件失敗してもタスク自体は登録できているので続行
        }
      }

      setTasks((prev) => [
        { ...newTask, subtasks: createdSubtasks, showSubtasks: createdSubtasks.length > 0 },
        ...prev,
      ]);
      setNewTitle("");
      setNewDescription("");
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
      setNewInitialSubtasks([{ title: "", assignee: "" }]);
      localStorage.removeItem("taskDraft");
    } catch (e) {
      setAddTaskError("ネットワークエラーが発生しました。再度お試しください。");
    } finally {
      setAddingTask(false);
    }
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
  const [savingTask, setSavingTask] = useState(false);
  const [saveTaskError, setSaveTaskError] = useState("");

  const saveTaskEdit = async (id: string) => {
    if (!editingTaskTitle.trim() || savingTask) return;
    setSavingTask(true);
    setSaveTaskError("");
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: editingTaskTitle,
          description: editingTaskDescription,
          due_date: editingTaskDueDate || null,
          start_date: editingTaskStartDate || null,
          data_location: editingTaskDataLocation || null,
          project_name: editingTaskProjectName || null,
          importance: editingTaskImportance,
          client_type: editingTaskClientType || null,
          task_type: editingTaskTaskType || null,
          assignee: editingTaskAssignee || null,
          category: resolveCategory(editingTaskCategory, editingTaskCategoryOther) || null,
          client_id: editingTaskClientId || null,
          important_note: editingTaskImportantNote || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSaveTaskError(`保存に失敗しました: ${err.error || res.statusText}`);
        return;
      }
      setTasks(tasks.map((t) =>
        t.id === id ? { ...t, title: editingTaskTitle, description: editingTaskDescription, due_date: editingTaskDueDate, start_date: editingTaskStartDate, data_location: editingTaskDataLocation, project_name: editingTaskProjectName, importance: editingTaskImportance, client_type: editingTaskClientType, task_type: editingTaskTaskType, assignee: editingTaskAssignee, category: resolveCategory(editingTaskCategory, editingTaskCategoryOther), client_id: editingTaskClientId, important_note: editingTaskImportantNote } : t
      ));
      setEditingTaskId(null);
    } catch (e) {
      setSaveTaskError("ネットワークエラーが発生しました。再度お試しください。");
    } finally {
      setSavingTask(false);
    }
  };

  // タスクを削除する
  const deleteTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!confirm(`「${task?.title || 'このタスク'}」を削除しますか？この操作は取り消せません。`)) return;
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
    setTasks(tasks.filter((t) => t.id !== id));
  };

  // タスクを丸ごとコピー（サブタスク含む）
  const duplicateTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    // タスク本体をコピー
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${task.title}（コピー）`,
        description: task.description,
        due_date: task.due_date,
        start_date: task.start_date,
        important_note: task.important_note,
        assignee: task.assignee,
        project_name: task.project_name,
        importance: task.importance,
        client_type: task.client_type,
        task_type: task.task_type,
        is_recurring: task.is_recurring,
        data_location: task.data_location,
        category: task.category,
        client_id: task.client_id,
      }),
    });
    if (!res.ok) return;
    const newTask = await res.json();
    // サブタスクもコピー
    for (const sub of task.subtasks) {
      await fetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: newTask.id,
          title: sub.title,
          description: sub.description,
          important_note: sub.important_note,
          order_num: sub.order_num,
          assignee: sub.assignee,
          due_date: sub.due_date,
          start_date: sub.start_date,
        }),
      });
    }
    await fetchTasks();
  };

  // 同名タスクの過去サブタスクを取得してベースにする

  // サブタスクのステータスを3段階でサイクルする（未着手→進行中→完了）
  const cycleSubtaskStatus = async (taskId: string, subtaskId: string, currentStatus: string) => {
    const nextMap: Record<string, { status: string; is_completed: boolean }> = {
      '未着手': { status: '進行中', is_completed: false },
      '進行中': { status: '完了', is_completed: true },
      '完了': { status: '未着手', is_completed: false },
    };
    const next = nextMap[currentStatus] || nextMap['未着手'];
    await fetch('/api/subtasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subtaskId, status: next.status, is_completed: next.is_completed }),
    });
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updatedSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, status: next.status as Subtask['status'], is_completed: next.is_completed } : s
    );
    const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.is_completed);
    const wasActive = task.status === '進行中' || (!task.status && !task.is_completed);
    // 全サブタスク完了 → ステータスを「完了（未請求）」に自動変更 + Undoバー表示
    if (allDone && wasActive) {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, is_completed: true, status: '完了（未請求）' }),
      });
      setTasks(tasks.map((t) =>
        t.id !== taskId ? t : { ...t, subtasks: updatedSubtasks, is_completed: true, status: '完了（未請求）' }
      ));
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoInfo({ taskId, taskTitle: task.title, subtasks: updatedSubtasks });
      undoTimerRef.current = setTimeout(() => setUndoInfo(null), 8000);
    } else if (!allDone && task.status === '完了（未請求）') {
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

  // Undo: 完了に変わったタスクを進行中に戻す
  const undoAutoComplete = async () => {
    if (!undoInfo) return;
    const { taskId, subtasks } = undoInfo;
    // 最後のサブタスクを未完了に戻す
    const lastDone = [...subtasks].reverse().find((s) => s.is_completed);
    if (lastDone) {
      await fetch('/api/subtasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lastDone.id, is_completed: false }),
      });
    }
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, is_completed: false, status: '進行中' }),
    });
    setTasks(tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        is_completed: false,
        status: '進行中',
        showSubtasks: true,
        subtasks: t.subtasks.map((s) =>
          s.id === lastDone?.id ? { ...s, is_completed: false } : s
        ),
      };
    }));
    setUndoInfo(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

  // サブタスク編集パネルを開く
  const openSubtaskEditPanel = (taskId: string, subtask: Subtask) => {
    setEditingSubtaskParentTaskId(taskId);
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
    setEditingSubtaskDescription(subtask.description ?? "");
    setEditingSubtaskImportantNote(subtask.important_note ?? "");
    setEditingSubtaskAssignee(subtask.assignee ?? "");
    setEditingSubtaskDueDate(subtask.due_date ?? "");
    setEditingSubtaskStartDate(subtask.start_date ?? "");
    setEditingSubtaskStatus(subtask.status || '未着手');
    setNewMemoContent("");
    fetchMemos(subtask.id);
  };

  // サブタスクのメモを取得
  const fetchMemos = async (subtaskId: string) => {
    setLoadingMemos(true);
    const res = await fetch(`/api/subtask-memos?subtask_id=${subtaskId}`);
    if (res.ok) {
      const data = await res.json();
      setSubtaskMemos(data);
    }
    setLoadingMemos(false);
  };

  // メモを追加
  const addMemo = async (subtaskId: string) => {
    const content = newMemoContent.trim();
    if (!content) return;
    const res = await fetch('/api/subtask-memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtask_id: subtaskId, content, user_name: currentUser?.name || '' }),
    });
    if (res.ok) {
      const memo = await res.json();
      setSubtaskMemos([memo, ...subtaskMemos]);
      setNewMemoContent("");
    }
  };

  // メモを削除
  const deleteMemo = async (memoId: string) => {
    const res = await fetch(`/api/subtask-memos?id=${memoId}`, { method: 'DELETE' });
    if (res.ok) {
      setSubtaskMemos(subtaskMemos.filter(m => m.id !== memoId));
    }
  };

  // サブタスクを追加する
  const addSubtask = async (taskId: string) => {
    const title = newSubtaskTitles[taskId]?.trim();
    if (!title) return;
    const important_note = newSubtaskNotes[taskId]?.trim() || "";
    if (!important_note) {
      setNewSubtaskNoteErrors((p) => ({ ...p, [taskId]: "重要事項を入力してください" }));
      return;
    }
    setNewSubtaskNoteErrors((p) => ({ ...p, [taskId]: "" }));
    const task = tasks.find((t) => t.id === taskId);
    const order_num = (task?.subtasks.length ?? 0) + 1;
    const assignee = newSubtaskAssignees[taskId]?.trim() || "";
    const description = newSubtaskDescriptions[taskId]?.trim() || "";
    const due_date = newSubtaskDueDates[taskId] || null;
    const start_date = newSubtaskStartDates[taskId] || null;
    const res = await fetch('/api/subtasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, title, assignee, order_num, description: description || null, important_note: important_note || null, due_date, start_date }),
    });
    const newSubtask = await res.json();
    setTasks(tasks.map((t) => t.id === taskId ? { ...t, subtasks: [...t.subtasks, newSubtask] } : t));
    setNewSubtaskTitles({ ...newSubtaskTitles, [taskId]: "" });
    setNewSubtaskAssignees({ ...newSubtaskAssignees, [taskId]: "" });
    setNewSubtaskDescriptions({ ...newSubtaskDescriptions, [taskId]: "" });
    setNewSubtaskNotes({ ...newSubtaskNotes, [taskId]: "" });
    setNewSubtaskDueDates({ ...newSubtaskDueDates, [taskId]: "" });
    setNewSubtaskStartDates({ ...newSubtaskStartDates, [taskId]: "" });
  };

  // サブタスクを途中に挿入する
  const insertSubtask = async (taskId: string, afterIndex: number) => {
    const title = newSubtaskTitles[taskId]?.trim();
    if (!title) return;
    const important_note = newSubtaskNotes[taskId]?.trim() || "";
    if (!important_note) {
      setNewSubtaskNoteErrors((p) => ({ ...p, [taskId]: "重要事項を入力してください" }));
      return;
    }
    setNewSubtaskNoteErrors((p) => ({ ...p, [taskId]: "" }));
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const order_num = afterIndex + 2;
    const assignee = newSubtaskAssignees[taskId]?.trim() || "";
    const description = newSubtaskDescriptions[taskId]?.trim() || "";
    const due_date = newSubtaskDueDates[taskId] || null;
    const start_date = newSubtaskStartDates[taskId] || null;
    const res = await fetch('/api/subtasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, title, assignee, order_num, description: description || null, important_note: important_note || null, due_date, start_date }),
    });
    const newSub = await res.json();
    const subs = [...task.subtasks];
    subs.splice(afterIndex + 1, 0, newSub);
    setTasks(tasks.map((t) => t.id === taskId ? { ...t, subtasks: subs } : t));
    setNewSubtaskTitles({ ...newSubtaskTitles, [taskId]: "" });
    setNewSubtaskAssignees({ ...newSubtaskAssignees, [taskId]: "" });
    setNewSubtaskDescriptions({ ...newSubtaskDescriptions, [taskId]: "" });
    setNewSubtaskNotes({ ...newSubtaskNotes, [taskId]: "" });
    setNewSubtaskDueDates({ ...newSubtaskDueDates, [taskId]: "" });
    setNewSubtaskStartDates({ ...newSubtaskStartDates, [taskId]: "" });
    setInsertSubtaskAfter(null);
  };

  // サブタスクをコピーする
  const duplicateSubtask = async (taskId: string, subtaskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const sub = task?.subtasks.find((s) => s.id === subtaskId);
    if (!task || !sub) return;
    const order_num = task.subtasks.length + 1;
    const res = await fetch('/api/subtasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId,
        title: sub.title + '（コピー）',
        assignee: sub.assignee || "",
        order_num,
        description: sub.description || null,
        important_note: sub.important_note || null,
        due_date: sub.due_date || null,
        start_date: sub.start_date || null,
      }),
    });
    if (res.ok) {
      const newSub = await res.json();
      setTasks(tasks.map((t) => t.id === taskId ? { ...t, subtasks: [...t.subtasks, newSub] } : t));
    }
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
    if (!editingSubtaskImportantNote.trim()) {
      setEditingSubtaskNoteError("重要事項を入力してください");
      return;
    }
    setEditingSubtaskNoteError("");
    await fetch('/api/subtasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subtaskId, title: editingSubtaskTitle, description: editingSubtaskDescription, important_note: editingSubtaskImportantNote, assignee: editingSubtaskAssignee, due_date: editingSubtaskDueDate || null, start_date: editingSubtaskStartDate || null, status: editingSubtaskStatus, is_completed: editingSubtaskStatus === '完了' }),
    });
    setTasks(tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        subtasks: t.subtasks.map((s) =>
          s.id === subtaskId ? { ...s, title: editingSubtaskTitle, description: editingSubtaskDescription, important_note: editingSubtaskImportantNote, assignee: editingSubtaskAssignee, due_date: editingSubtaskDueDate, start_date: editingSubtaskStartDate, status: editingSubtaskStatus, is_completed: editingSubtaskStatus === '完了' } : s
        ),
      };
    }));
    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
    clearSubtaskDraft();
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

  // サブタスクの表示・非表示を切り替える（閉じる時は編集中サブタスクを自動保存）
  const toggleSubtasks = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task?.showSubtasks && editingSubtaskId) {
      // 閉じる前に編集中のサブタスクを自動保存
      const sub = task.subtasks.find((s) => s.id === editingSubtaskId);
      if (sub && editingSubtaskTitle.trim()) {
        saveSubtaskEdit(id, editingSubtaskId);
      }
      setEditingSubtaskId(null);
    }
    // 閉じる前に入力途中のサブタスクがあれば追加保存
    if (task?.showSubtasks) {
      const pendingTitle = newSubtaskTitles[id]?.trim();
      if (pendingTitle) {
        addSubtask(id);
      }
    }
    setTasks(tasks.map((t) => (t.id === id ? { ...t, showSubtasks: !t.showSubtasks } : t)));
  };

  const isAdmin = !currentUser || currentUser.role === '管理者' || currentUser.role === 'admin';

  const CATEGORIES = ["総務", "帳簿入力", "帳簿確認", "申告", "コンサルティング", "その他"];

  // 重要事項・概要のプリセットテンプレート
  const NOTE_PRESETS = ["発送先・内容を二重確認", "税務調査で指摘されやすい項目あり", "届出書の提出要否を確認", "みなし配当・組織再編の影響に注意", "個人経費と法人経費の区分を確認", "前年度との差異を重点確認", "預り資料の返却を忘れずに", "承継・遺留分の検討が必要"];
  const DESC_PRESETS = ["資料収集後に着手", "前年度を参照して進める", "通達・裁決例を確認してから着手", "事前にヒアリングしてから作成"];

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

  // 月フィルター（due_dateのYYYY-MMで判定）
  const monthFilter = (t: Task) => {
    if (!filterMonth) return true;
    return t.due_date?.startsWith(filterMonth);
  };

  // クライアント名フィルター
  const clientNameFilter = (t: Task) => {
    if (!filterClientName) return true;
    return t.project_name?.toLowerCase().includes(filterClientName.toLowerCase());
  };

  // ステータスフィルター
  const statusFilter = (t: Task) => {
    if (!filterStatus) return true;
    const s = t.status || (t.is_completed ? '完了（未請求）' : '進行中');
    return s === filterStatus;
  };

  const allFilters = (t: Task) => categoryFilter(t) && clientTypeFilter(t) && monthFilter(t) && clientNameFilter(t) && statusFilter(t);

  const activeTasks = tasks.filter((t) => (t.status === '進行中' || (!t.status && !t.is_completed)) && allFilters(t));
  const allActiveTasks = tasks.filter((t) => t.status === '進行中' || (!t.status && !t.is_completed)); // フィルタなし（サイドバー用）
  const completedTasks = tasks.filter((t) => (t.status === '完了（未請求）' || (t.is_completed && !t.status)) && allFilters(t));
  const invoicedTasks = tasks.filter((t) => t.status === '請求済' && allFilters(t));
  const collectedTasks = tasks.filter((t) => t.status === '回収済' && allFilters(t));

  // 月の選択肢を生成（タスクのdue_dateから）
  const availableMonths = [...new Set(tasks.filter(t => t.due_date).map(t => t.due_date.substring(0, 7)))].sort().reverse();

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      {/* Undoトースト */}
      {undoInfo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-4 animate-fade-in">
          <span className="text-sm">「{undoInfo.taskTitle}」を完了にしました</span>
          <button
            onClick={undoAutoComplete}
            className="text-blue-300 hover:text-blue-100 font-bold text-sm underline"
          >
            元に戻す
          </button>
          <button
            onClick={() => { setUndoInfo(null); if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }}
            className="text-gray-400 hover:text-white text-lg ml-1"
          >
            ×
          </button>
        </div>
      )}
      {/* サブタスク編集パネル（左側固定） */}
      {editingSubtaskId && (
        <div className="fixed left-0 top-0 h-full w-72 bg-white border-r-2 border-blue-200 shadow-xl z-50 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-700">{editingSubtaskId === 'new' ? 'サブタスク追加' : 'サブタスク編集'}</h3>
              {(editingSubtaskTitle || editingSubtaskDescription) && (
                <span className="text-[9px] text-green-500">💾 下書き保存中</span>
              )}
            </div>
            <button onClick={() => { setEditingSubtaskId(null); setEditingSubtaskParentTaskId(null); clearSubtaskDraft(); }} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-gray-400 font-semibold">サブタスク名</label>
            <input
              type="text"
              value={editingSubtaskTitle}
              onChange={(e) => setEditingSubtaskTitle(e.target.value)}
              placeholder="サブタスク名"
              className="border border-blue-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus
            />
            <label className="text-[10px] text-gray-400 font-semibold">概要</label>
            <textarea
              value={editingSubtaskDescription}
              onChange={(e) => setEditingSubtaskDescription(e.target.value)}
              placeholder="概要（任意）"
              rows={3}
              className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
            <div className="flex flex-wrap gap-1 mt-0.5">
              {DESC_PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setEditingSubtaskDescription(p)}
                  className="text-[10px] bg-gray-50 border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors">
                  {p}
                </button>
              ))}
            </div>
            <label className="text-[10px] text-gray-400 font-semibold">重要事項 <span className="text-red-400">*必須</span></label>
            <input
              type="text"
              value={editingSubtaskImportantNote}
              onChange={(e) => { setEditingSubtaskImportantNote(e.target.value); if (editingSubtaskNoteError) setEditingSubtaskNoteError(""); }}
              placeholder="⚠ このサブタスクで注意すべき点はありますか?(必須)"
              className={`border rounded px-2 py-1.5 text-xs text-orange-700 focus:outline-none focus:ring-2 bg-orange-50 ${editingSubtaskNoteError ? "border-red-400 focus:ring-red-300" : "border-orange-200 focus:ring-orange-300"}`}
            />
            <div className="flex flex-wrap gap-1 mt-0.5">
              {NOTE_PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => { setEditingSubtaskImportantNote(p); setEditingSubtaskNoteError(""); }}
                  className="text-[10px] bg-orange-50 border border-orange-200 text-orange-600 px-1.5 py-0.5 rounded hover:bg-orange-100 transition-colors">
                  {p}
                </button>
              ))}
            </div>
            {editingSubtaskNoteError && <p className="text-[10px] text-red-500">⚠ {editingSubtaskNoteError}</p>}
            {canUseAIConcerns && (() => {
              const scope = `edit-sub:${editingSubtaskId}`;
              const ai = aiConcernsMap[scope];
              const parentTask = tasks.find((t) => t.id === editingSubtaskParentTaskId);
              return (
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!editingSubtaskTitle.trim()) return;
                        fetchAIConcerns(scope, {
                          subtask_title: editingSubtaskTitle,
                          task_title: parentTask?.title || '',
                          client_id: parentTask?.client_id || undefined,
                          category: parentTask?.category || undefined,
                        });
                      }}
                      disabled={!editingSubtaskTitle.trim() || ai?.loading}
                      className="text-[10px] bg-amber-100 hover:bg-amber-200 disabled:bg-gray-100 disabled:text-gray-400 text-amber-700 font-semibold px-2 py-0.5 rounded-full border border-amber-300 disabled:border-gray-200 transition-colors"
                    >
                      {ai?.loading ? '🤔 考え中...' : '🤔 想定論点をAIに聞く'}
                    </button>
                    {ai && !ai.loading && (
                      <button
                        type="button"
                        onClick={() => clearAIConcerns(scope)}
                        className="text-[9px] text-gray-400 hover:text-gray-600"
                      >
                        閉じる
                      </button>
                    )}
                  </div>
                  {ai?.error && (
                    <div className="text-[10px] text-red-500 bg-red-50 border border-red-200 rounded p-2 mt-1">
                      {ai.error}
                    </div>
                  )}
                  {ai?.questions && ai.questions.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-1">
                      <p className="text-[9px] text-amber-700 font-semibold mb-1">
                        🤔 AI からの問いかけ(参考・自分の言葉で書いてください)
                      </p>
                      <ol className="text-[10px] text-gray-700 space-y-1 list-decimal list-inside">
                        {ai.questions.map((q, i) => (
                          <li key={i} className="leading-snug">{q}</li>
                        ))}
                      </ol>
                      <p className="text-[8px] text-gray-400 mt-1">
                        ※ ヒントです。入力欄に自動挿入されません。
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
            <label className="text-[10px] text-gray-400 font-semibold">ステータス</label>
            <select
              value={editingSubtaskStatus}
              onChange={(e) => setEditingSubtaskStatus(e.target.value as '未着手' | '進行中' | '完了')}
              className={`border rounded px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 bg-white ${
                editingSubtaskStatus === '完了' ? 'border-green-300 text-green-600 focus:ring-green-300' :
                editingSubtaskStatus === '進行中' ? 'border-blue-300 text-blue-600 focus:ring-blue-300' :
                'border-gray-200 text-gray-600 focus:ring-gray-300'
              }`}
            >
              <option value="未着手">未着手</option>
              <option value="進行中">進行中</option>
              <option value="完了">完了</option>
            </select>
            <label className="text-[10px] text-gray-400 font-semibold">責任者</label>
            <select
              value={editingSubtaskAssignee}
              onChange={(e) => setEditingSubtaskAssignee(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            >
              <option value="">責任者を選択</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
            <label className="text-[10px] text-gray-400 font-semibold">開始日</label>
            <input
              type="date"
              value={editingSubtaskStartDate}
              onChange={(e) => setEditingSubtaskStartDate(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <label className="text-[10px] text-gray-400 font-semibold">締切日</label>
            <input
              type="date"
              value={editingSubtaskDueDate}
              onChange={(e) => setEditingSubtaskDueDate(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          {/* メモセクション（編集モードのみ） */}
          {editingSubtaskId && editingSubtaskId !== 'new' && (
            <div className="border-t border-gray-200 pt-3 mt-1">
              <label className="text-[10px] text-gray-400 font-semibold">メモ・進捗記録</label>
              <div className="flex gap-1 mt-1">
                <input
                  type="text"
                  value={newMemoContent}
                  onChange={(e) => setNewMemoContent(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMemo(editingSubtaskId)}
                  placeholder="メモを入力..."
                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={() => addMemo(editingSubtaskId)}
                  className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded font-semibold shrink-0"
                >追加</button>
              </div>
              <div className="mt-2 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {loadingMemos ? (
                  <p className="text-[10px] text-gray-400">読み込み中...</p>
                ) : subtaskMemos.length === 0 ? (
                  <p className="text-[10px] text-gray-400">メモはまだありません</p>
                ) : subtaskMemos.map(memo => (
                  <div key={memo.id} className="bg-gray-50 rounded px-2 py-1.5 text-xs group">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-gray-400">
                        {memo.user_name && <span className="font-semibold text-gray-500">{memo.user_name}</span>}
                        {' '}{new Date(memo.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={() => deleteMemo(memo.id)}
                        className="text-[10px] text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >×</button>
                    </div>
                    <p className="text-gray-700 mt-0.5 whitespace-pre-wrap">{memo.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <button
              onClick={async () => {
                if (!editingSubtaskParentTaskId) return;
                if (editingSubtaskId === 'new') {
                  // 新規追加
                  const title = editingSubtaskTitle.trim();
                  if (!title) return;
                  if (!editingSubtaskImportantNote.trim()) {
                    setEditingSubtaskNoteError("重要事項を入力してください");
                    return;
                  }
                  setEditingSubtaskNoteError("");
                  const task = tasks.find(t => t.id === editingSubtaskParentTaskId);
                  if (!task) return;
                  const isInsert = insertSubtaskAfter?.taskId === editingSubtaskParentTaskId;
                  const order_num = isInsert ? insertSubtaskAfter!.afterIndex + 2 : (task.subtasks.length ?? 0) + 1;
                  const res = await fetch('/api/subtasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      task_id: editingSubtaskParentTaskId, title,
                      assignee: editingSubtaskAssignee || "",
                      order_num,
                      description: editingSubtaskDescription.trim() || null,
                      important_note: editingSubtaskImportantNote.trim() || null,
                      due_date: editingSubtaskDueDate || null,
                      start_date: editingSubtaskStartDate || null,
                      status: editingSubtaskStatus,
                    }),
                  });
                  const newSub = await res.json();
                  if (isInsert) {
                    const subs = [...task.subtasks];
                    subs.splice(insertSubtaskAfter!.afterIndex + 1, 0, newSub);
                    setTasks(tasks.map(t => t.id === editingSubtaskParentTaskId ? { ...t, subtasks: subs, showSubtasks: true } : t));
                    setInsertSubtaskAfter(null);
                  } else {
                    setTasks(tasks.map(t => t.id === editingSubtaskParentTaskId ? { ...t, subtasks: [...t.subtasks, newSub], showSubtasks: true } : t));
                  }
                  // パネルをリセットして続けて追加できるようにする
                  setEditingSubtaskTitle("");
                  setEditingSubtaskDescription("");
                  setEditingSubtaskImportantNote("");
                  setEditingSubtaskAssignee("");
                  setEditingSubtaskDueDate("");
                  setEditingSubtaskStartDate("");
                  setEditingSubtaskStatus('未着手');
                  clearSubtaskDraft();
                } else {
                  saveSubtaskEdit(editingSubtaskParentTaskId, editingSubtaskId!);
                  setEditingSubtaskParentTaskId(null);
                }
              }}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm py-2 rounded-lg transition-colors"
            >
              {editingSubtaskId === 'new' ? '追加' : '保存'}
            </button>
            <button
              onClick={() => { setEditingSubtaskId(null); setEditingSubtaskParentTaskId(null); clearSubtaskDraft(); }}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm py-2 rounded-lg transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
      {/* 編集パネルが開いている時、背景をクリックで閉じる */}
      {editingSubtaskId && (
        <div className="fixed inset-0 bg-black/10 z-40" onClick={() => { setEditingSubtaskId(null); setEditingSubtaskParentTaskId(null); clearSubtaskDraft(); }} />
      )}

      {/* サブタスク担当者一括設定モーダル */}
      {bulkAssigneeTaskId && (() => {
        const task = tasks.find((t) => t.id === bulkAssigneeTaskId);
        if (!task) return null;
        const hasChanges = task.subtasks.some((s) => (bulkAssigneePending[s.id] ?? "").trim() !== (s.assignee || "").trim());
        return (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={closeBulkAssigneeModal}
          >
            <div
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ヘッダー */}
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-800">サブタスク担当者の一括設定</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5 truncate">{task.title}</p>
                </div>
                <button
                  onClick={closeBulkAssigneeModal}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                  aria-label="閉じる"
                >
                  ×
                </button>
              </div>

              {/* 全員に〇〇 一括適用 */}
              <div className="px-5 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-gray-500 shrink-0">全サブタスクに一括:</span>
                <button
                  onClick={() => applyBulkAssigneeToAll("")}
                  className="text-[10px] bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full hover:bg-gray-100"
                >
                  空欄
                </button>
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyBulkAssigneeToAll(p.name || "")}
                    className="text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {/* サブタスクごとの担当者選択 */}
              <div className="flex-1 overflow-y-auto px-5 py-3">
                {task.subtasks.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">サブタスクがありません</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {task.subtasks.map((sub) => {
                      const changed = (bulkAssigneePending[sub.id] ?? "").trim() !== (sub.assignee || "").trim();
                      return (
                        <div key={sub.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${changed ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"}`}>
                          <span className={`text-xs flex-1 min-w-0 truncate ${sub.is_completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                            {sub.order_num}. {sub.title}
                          </span>
                          <select
                            value={bulkAssigneePending[sub.id] ?? ""}
                            onChange={(e) => setBulkAssigneePending((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                            className="w-32 border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                          >
                            <option value="">(空欄)</option>
                            {profiles.map((p) => (
                              <option key={p.id} value={p.name || ""}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* フッター */}
              <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                <p className="text-[10px] text-gray-500">
                  {hasChanges ? "黄色の行は変更されています" : "変更はありません"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={closeBulkAssigneeModal}
                    disabled={bulkAssigneeSaving}
                    className="text-xs text-gray-500 hover:text-gray-700 px-4 py-1.5"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={saveBulkAssignees}
                    disabled={bulkAssigneeSaving || !hasChanges}
                    className="text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold px-5 py-1.5 rounded-lg transition-colors"
                  >
                    {bulkAssigneeSaving ? "保存中..." : "一括保存"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      <div className="max-w-7xl mx-auto overflow-x-auto">

        {/* タイトル */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-800">タスク管理</h1>
            {currentUser && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
                <User size={11} className="inline mr-1" />{currentUser.name}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {currentUser?.name?.includes("上野") && (
              <button
                onClick={() => router.push("/voice")}
                className="text-xs text-white bg-blue-500 hover:bg-blue-600 border border-blue-500 px-3 py-1.5 rounded-lg transition-colors font-semibold"
              >
                🎤 音声入力
              </button>
            )}
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
            {/* 他 GW へのリンク */}
            <div className="flex items-center gap-1 border-l border-gray-200 pl-2 ml-1">
              <span className="text-[10px] text-gray-400 mr-1">他のGW:</span>
              <a
                href={process.env.NEXT_PUBLIC_KAIKEI_GW_URL || "http://localhost:3100"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-2 py-1.5 rounded transition-colors"
              >
                KAIKEI GW ↗
              </a>
              <a
                href={process.env.NEXT_PUBLIC_SOUZOKU_GW_URL || "http://localhost:3300"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 px-2 py-1.5 rounded transition-colors"
              >
                SOUZOKU GW ↗
              </a>
              <a
                href={process.env.NEXT_PUBLIC_KABUKA_GW_URL || "http://localhost:3200"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 px-2 py-1.5 rounded transition-colors"
              >
                KABUKA GW ↗
              </a>
            </div>
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
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">新しいタスクを追加</h2>
                {(newTitle || newDescription || newDueDate || newImportantNote) && (
                  <span className="text-[10px] text-green-500 bg-green-50 px-2 py-0.5 rounded-full">💾 下書き自動保存中</span>
                )}
              </div>
              <input
                type="text"
                placeholder="タスク名を入力..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 mb-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <textarea
                placeholder="概要（任意）- マニュアルや手順メモなど自由に記載できます"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 mb-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
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
                <ClientComboBox
                  clients={clients}
                  value={newClientId}
                  onChange={(cid, c) => {
                    setNewClientId(cid);
                    setNewProjectName(c?.name || "");
                    if (c?.client_type) setNewClientType(c.client_type);
                  }}
                  className="flex-1 min-w-[160px]"
                />
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
                  <option value="クライアント共通">クライアント共通</option>
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
              <div className="flex flex-col gap-1 mb-2">
                <input
                  type="text"
                  placeholder="⚠ このタスクで注意すべき点はありますか?（必須)"
                  value={newImportantNote}
                  onChange={(e) => { setNewImportantNote(e.target.value); if (addTaskError.includes("重要事項")) setAddTaskError(""); }}
                  className={`flex-1 border rounded-lg px-4 py-2 text-orange-700 bg-orange-50 focus:outline-none focus:ring-2 placeholder-orange-300 ${addTaskError.includes("重要事項") ? "border-red-400 focus:ring-red-300" : "border-orange-200 focus:ring-orange-300"}`}
                />
                {addTaskError.includes("重要事項") && (
                  <p className="text-xs text-red-500 px-1">⚠ {addTaskError}</p>
                )}
                {canUseAIConcerns && (
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!newTitle.trim()) return;
                        const selectedClient = clients.find((c) => c.id === newClientId);
                        fetchAIConcerns('new-task', {
                          task_title: newTitle,
                          client_id: selectedClient?.id,
                          category: resolveCategory(newCategory, newCategoryOther) || undefined,
                        });
                      }}
                      disabled={!newTitle.trim() || aiConcernsMap['new-task']?.loading}
                      className="text-[11px] bg-amber-100 hover:bg-amber-200 disabled:bg-gray-100 disabled:text-gray-400 text-amber-700 font-semibold px-3 py-1 rounded-full border border-amber-300 disabled:border-gray-200 transition-colors"
                    >
                      {aiConcernsMap['new-task']?.loading
                        ? '🤔 考え中...'
                        : '🤔 こんな論点は想定されませんか?(AIに聞く)'}
                    </button>
                    {aiConcernsMap['new-task'] && !aiConcernsMap['new-task'].loading && (
                      <button
                        type="button"
                        onClick={() => clearAIConcerns('new-task')}
                        className="text-[10px] text-gray-400 hover:text-gray-600"
                      >
                        閉じる
                      </button>
                    )}
                  </div>
                )}
                {aiConcernsMap['new-task']?.error && (
                  <div className="text-[10px] text-red-500 bg-red-50 border border-red-200 rounded p-2 mt-1">
                    {aiConcernsMap['new-task'].error}
                  </div>
                )}
                {aiConcernsMap['new-task']?.questions && aiConcernsMap['new-task'].questions.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-1">
                    <p className="text-[10px] text-amber-700 font-semibold mb-2">
                      🤔 AI からの問いかけ(参考・自分の言葉で書いてください)
                    </p>
                    <ol className="text-xs text-gray-700 space-y-1.5 list-decimal list-inside">
                      {aiConcernsMap['new-task'].questions.map((q, i) => (
                        <li key={i} className="leading-relaxed">{q}</li>
                      ))}
                    </ol>
                    <p className="text-[9px] text-gray-400 mt-2">
                      ※ 上記は思考のヒントです。入力欄には自動挿入されません。自分の言葉で書いてください。
                    </p>
                  </div>
                )}
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
                  disabled={addingTask}
                  className={`font-semibold px-6 py-2 rounded-lg transition-colors ${addingTask ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"} text-white`}
                >
                  {addingTask ? "登録中..." : "追加"}
                </button>
              </div>
              {/* 初期サブタスク入力 */}
              <div className="mt-3 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">サブタスク（任意）</span>
                  <button
                    type="button"
                    onClick={() => setNewInitialSubtasks((prev) => [...prev, { title: "", assignee: "" }])}
                    className="text-xs text-blue-500 hover:text-blue-600"
                  >
                    ＋ 行を追加
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {newInitialSubtasks.map((s, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={s.title}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNewInitialSubtasks((prev) => prev.map((x, i) => (i === idx ? { ...x, title: v } : x)));
                        }}
                        placeholder={`サブタスク ${idx + 1}`}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <select
                        value={s.assignee}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNewInitialSubtasks((prev) => prev.map((x, i) => (i === idx ? { ...x, assignee: v } : x)));
                        }}
                        className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        <option value="">担当者</option>
                        {profiles.map((p) => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                      {newInitialSubtasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setNewInitialSubtasks((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-gray-300 hover:text-red-500 text-lg leading-none px-1"
                          aria-label="サブタスク行を削除"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {addTaskError && <p className="text-red-500 text-sm mt-1">{addTaskError}</p>}
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

              {selectedTemplate && selectedTemplateId && (() => {
                // プレースホルダの検出
                const placeholders = detectPlaceholders(selectedTemplate);
                const needsMonth = placeholders.includes('month');
                const needsClient = placeholders.includes('clientName');
                const selectedClient = clients.find((c) => c.id === templateClientId);
                const canApply =
                  (!needsClient || !!selectedClient) && !!templateDueDate;
                const previewTitle = applyPlaceholders(selectedTemplate, {
                  month: templateMonth,
                  clientName: selectedClient?.name ?? (needsClient ? "(会社を選択)" : null),
                });

                return (
                <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  {/* プレビュー: プレースホルダが置換された後のタイトル */}
                  <div className="mb-2 text-sm">
                    <span className="text-[10px] text-blue-500 mr-2">生成されるタイトル</span>
                    <span className="font-semibold text-blue-800">{previewTitle}</span>
                  </div>

                  {/* プレースホルダ入力欄: 必要なテンプレのときだけ表示 */}
                  {(needsMonth || needsClient) && (
                    <div className="mb-3 flex items-center gap-2 flex-wrap">
                      {needsMonth && (
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-blue-600">月</label>
                          <select
                            value={templateMonth}
                            onChange={(e) => setTemplateMonth(e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                          >
                            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                              <option key={m} value={m}>{m}月</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {needsClient && (
                        <div className="flex flex-col gap-0.5 flex-1 min-w-[180px]">
                          <div className="flex items-center gap-1">
                            <label className="text-[10px] text-blue-600">会社</label>
                            <select
                              value={templateClientId}
                              onChange={(e) => { setTemplateClientId(e.target.value); setTplErrors((p) => ({ ...p, client: undefined })); }}
                              className={`flex-1 border rounded px-2 py-1 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 ${tplErrors.client ? "border-red-400" : "border-gray-200"}`}
                            >
                              <option value="">(選択してください)</option>
                              {clients.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          {tplErrors.client && (
                            <p className="text-[10px] text-red-500 pl-6">⚠ {tplErrors.client}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-1 mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="date"
                        value={templateDueDate}
                        onChange={(e) => { setTemplateDueDate(e.target.value); setTplErrors((p) => ({ ...p, date: undefined })); }}
                        placeholder="締切日"
                        className={`flex-1 border rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 ${tplErrors.date ? "border-red-400" : "border-gray-200"}`}
                      />
                      <button
                        onClick={addFromTemplate}
                        className="text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors shrink-0"
                      >
                        追加
                      </button>
                      <button
                        onClick={() => { setSelectedTemplate(null); setSelectedTemplateId(null); setTemplateClientId(""); setTplErrors({}); }}
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                      >
                        キャンセル
                      </button>
                    </div>
                    {tplErrors.date && (
                      <p className="text-[10px] text-red-500">⚠ {tplErrors.date}</p>
                    )}
                  </div>

                  {/* テンプレートのサブタスク一覧 */}
                  <div className="border-t border-blue-100 pt-2">
                    <p className="text-xs text-blue-600 font-semibold mb-1.5">サブタスクテンプレート</p>
                    {(templateSubtasksMap[selectedTemplateId] || []).map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          checked={!!selectedTplSubtaskIds[sub.id]}
                          onChange={(e) => setSelectedTplSubtaskIds((prev) => ({ ...prev, [sub.id]: e.target.checked }))}
                          className="w-3.5 h-3.5 accent-blue-500 cursor-pointer shrink-0"
                        />
                        <span className={`text-xs flex-1 ${selectedTplSubtaskIds[sub.id] ? "text-gray-700" : "text-gray-300 line-through"}`}>
                          {sub.title}{sub.assignee && <span className="text-blue-400 ml-1">👤{sub.assignee}</span>}
                        </span>
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
                );
              })()}
            </div>

            {/* フィルター */}
            <div className="mb-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex gap-1.5 items-center whitespace-nowrap">
              <span className="text-[10px] text-gray-400 self-center shrink-0">カテゴリー:</span>
              <button onClick={() => setFilterCategory("")} className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${!filterCategory ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>すべて</button>
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setFilterCategory(filterCategory === c ? "" : c)} className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${filterCategory === c ? "bg-purple-500 text-white" : "bg-purple-50 text-purple-600 hover:bg-purple-100"}`}>{c}</button>
              ))}
              </div>
            </div>
            <div className="mb-3 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex gap-1.5 items-center whitespace-nowrap">
              <span className="text-[10px] text-gray-400 self-center shrink-0">顧客区分:</span>
              <button onClick={() => setFilterClientType("")} className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${!filterClientType ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>すべて</button>
              {["企業", "資産家", "クライアント共通"].map((ct) => (
                <button key={ct} onClick={() => setFilterClientType(filterClientType === ct ? "" : ct)} className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${filterClientType === ct ? "bg-blue-500 text-white" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}>{ct}</button>
              ))}
              </div>
            </div>
            <div className="mb-3 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex gap-2 items-center whitespace-nowrap">
              <span className="text-[10px] text-gray-400 shrink-0">月:</span>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="text-xs border border-gray-200 rounded-full px-3 py-1 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              >
                <option value="">すべての月</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>{m.replace("-", "年") + "月"}</option>
                ))}
              </select>
              <span className="text-[10px] text-gray-400 ml-2">ステータス:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs border border-gray-200 rounded-full px-3 py-1 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
              >
                <option value="">すべて</option>
                <option value="進行中">進行中</option>
                <option value="完了（未請求）">完了（未請求）</option>
                <option value="請求済">請求済</option>
                <option value="回収済">回収済</option>
              </select>
              <span className="text-[10px] text-gray-400 ml-2">クライアント:</span>
              <input
                type="text"
                value={filterClientName}
                onChange={(e) => setFilterClientName(e.target.value)}
                placeholder="クライアント名で絞込..."
                className="text-xs border border-gray-200 rounded-full px-3 py-1 w-40 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {(filterMonth || filterClientName || filterCategory || filterClientType || filterStatus) && (
                <button
                  onClick={() => { setFilterMonth(""); setFilterClientName(""); setFilterCategory(""); setFilterClientType(""); setFilterStatus(""); }}
                  className="text-[10px] text-red-400 hover:text-red-600 underline ml-2"
                >
                  フィルタをリセット
                </button>
              )}
              </div>
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
                <Folder size={12} /> クライアント別
              </button>
              <button
                onClick={() => setView("assignee")}
                className={`inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full font-semibold transition-colors ${view === "assignee" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                <User size={12} /> 担当者別
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

            {/* クライアント別ビュー */}
            {!loading && view === "project" && (
              <ProjectView activeTasks={activeTasks} onToggleComplete={toggleCompleteTask} onDelete={deleteTask} onGenerate={generateMonthlyTask} clients={clients} />
            )}

            {/* 担当者別ビュー */}
            {!loading && view === "assignee" && (() => {
              // 担当者ごとにタスクとサブタスクを集約
              const assigneeMap: Record<string, { tasks: typeof activeTasks; subtasks: { task: (typeof activeTasks)[0]; subtask: Subtask }[] }> = {};
              const allActive = tasks.filter(t => t.status === '進行中' || (!t.status && !t.is_completed));
              allActive.forEach(task => {
                const assignee = task.assignee || '未割当';
                if (!assigneeMap[assignee]) assigneeMap[assignee] = { tasks: [], subtasks: [] };
                assigneeMap[assignee].tasks.push(task);
                task.subtasks?.forEach((sub: Subtask) => {
                  if (sub.status === '完了' || sub.is_completed) return;
                  const subAssignee = sub.assignee || task.assignee || '未割当';
                  if (!assigneeMap[subAssignee]) assigneeMap[subAssignee] = { tasks: [], subtasks: [] };
                  assigneeMap[subAssignee].subtasks.push({ task, subtask: sub });
                });
              });
              const myName = currentUser?.name || '';
              const sortedAssignees = Object.keys(assigneeMap).sort((a, b) => {
                if (a === myName) return -1;
                if (b === myName) return 1;
                if (a === '未割当') return 1;
                if (b === '未割当') return -1;
                return a.localeCompare(b);
              });
              return (
                <div className="space-y-6">
                  {sortedAssignees.map(assignee => {
                    const data = assigneeMap[assignee];
                    const inProgressSubs = data.subtasks.filter(s => s.subtask.status === '進行中');
                    const notStartedSubs = data.subtasks.filter(s => s.subtask.status !== '進行中');
                    return (
                      <div key={assignee} className="bg-white border border-gray-200 rounded-xl p-4">
                        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                          <User size={14} className="text-blue-500" />
                          {assignee}
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-normal">
                            タスク {data.tasks.length} / サブタスク {data.subtasks.length}
                          </span>
                        </h3>
                        {/* タスクごとにサブタスクを表示 */}
                        {(() => {
                          // サブタスクをタスクIDでグループ化
                          const taskSubMap: Record<string, { task: (typeof activeTasks)[0]; subs: Subtask[] }> = {};
                          data.subtasks.forEach(({ task, subtask }) => {
                            if (!taskSubMap[task.id]) taskSubMap[task.id] = { task, subs: [] };
                            taskSubMap[task.id].subs.push(subtask);
                          });
                          const taskIds = Object.keys(taskSubMap);
                          if (taskIds.length === 0) return <p className="text-xs text-gray-300 italic">サブタスクなし</p>;
                          return (
                            <div className="space-y-3">
                              {taskIds.map(tid => {
                                const { task, subs } = taskSubMap[tid];
                                const inProgress = subs.filter(s => s.status === '進行中');
                                const notStarted = subs.filter(s => s.status !== '進行中');
                                return (
                                  <div key={tid} className="border border-gray-100 rounded-lg overflow-hidden">
                                    <div
                                      className="bg-gray-50 px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-blue-50 transition-colors"
                                      onClick={() => {
                                        setView("list");
                                        setTimeout(() => {
                                          const el = document.getElementById(`task-${task.id}`);
                                          if (el) {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            el.classList.add('ring-2', 'ring-blue-400');
                                            setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 2000);
                                          }
                                          toggleSubtasks(task.id);
                                        }, 100);
                                      }}
                                      title="クリックでタスクに移動"
                                    >
                                      <Folder size={12} className="text-gray-400 shrink-0" />
                                      <span className="text-xs font-bold text-gray-600 truncate">{task.title}</span>
                                      <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0 font-semibold">
                                        {task.project_name || clients.find(c => c.id === task.client_id)?.name || '—'}
                                      </span>
                                      {task.due_date && <span className="text-[10px] text-gray-400 shrink-0 ml-auto">締切 {task.due_date}</span>}
                                    </div>
                                    <div className="px-3 py-2 space-y-1">
                                      {inProgress.map(subtask => (
                                        <div key={subtask.id} className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
                                          <button
                                            onClick={() => cycleSubtaskStatus(task.id, subtask.id, subtask.status || '進行中')}
                                            className="w-4 h-4 mt-0.5 rounded-full border-2 bg-blue-400 border-blue-400 text-white flex items-center justify-center text-[8px] shrink-0"
                                          >▶</button>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="text-sm text-blue-700 font-semibold truncate">{subtask.title}</span>
                                              <span className="text-[9px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded shrink-0">{task.project_name || clients.find(c => c.id === task.client_id)?.name || '—'}</span>
                                            </div>
                                            {subtask.description && <p className="text-xs text-gray-500 mt-0.5">{subtask.description}</p>}
                                            {subtask.important_note && <p className="text-xs text-orange-500 mt-0.5 flex items-center gap-0.5"><AlertTriangle size={10} /> {subtask.important_note}</p>}
                                            {subtask.due_date && <span className="text-[10px] text-gray-400">締切 {subtask.due_date}</span>}
                                          </div>
                                          <button
                                            onClick={() => openSubtaskEditPanel(task.id, subtask)}
                                            className="text-xs text-blue-400 hover:text-blue-600 shrink-0"
                                          >編集</button>
                                        </div>
                                      ))}
                                      {notStarted.map(subtask => (
                                        <div key={subtask.id} className="flex items-start gap-2 bg-white border border-gray-100 rounded px-2 py-1.5">
                                          <button
                                            onClick={() => cycleSubtaskStatus(task.id, subtask.id, subtask.status || '未着手')}
                                            className="w-4 h-4 mt-0.5 rounded-full border-2 border-gray-300 hover:border-blue-400 shrink-0"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="text-sm text-gray-700 truncate">{subtask.title}</span>
                                              <span className="text-[9px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded shrink-0">{task.project_name || clients.find(c => c.id === task.client_id)?.name || '—'}</span>
                                            </div>
                                            {subtask.description && <p className="text-xs text-gray-500 mt-0.5">{subtask.description}</p>}
                                            {subtask.important_note && <p className="text-xs text-orange-500 mt-0.5 flex items-center gap-0.5"><AlertTriangle size={10} /> {subtask.important_note}</p>}
                                            {subtask.due_date && <span className="text-[10px] text-gray-400">締切 {subtask.due_date}</span>}
                                          </div>
                                          <button
                                            onClick={() => openSubtaskEditPanel(task.id, subtask)}
                                            className="text-xs text-gray-400 hover:text-blue-400 shrink-0"
                                          >編集</button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* 進行中タスク一覧（テーブル＋展開式） */}
            {!loading && view === "list" && activeTasks.length > 0 && (

              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">進行中 ({activeTasks.length})</h2>
                <ScrollableTable>
                  <table className="w-full text-sm min-w-[800px]">
                    <thead>
                      <tr className="text-[11px] text-gray-400 border-b border-gray-100 bg-gray-50">
                        <th className="text-left py-2 px-3 font-semibold w-8">重要度</th>
                        <th className="text-left py-2 px-3 font-semibold">タスク名</th>
                        <th className="text-left py-2 px-3 font-semibold">クライアント</th>
                        <th className="text-left py-2 px-3 font-semibold">カテゴリ</th>
                        <th className="text-left py-2 px-3 font-semibold">責任者</th>
                        <th className="text-left py-2 px-3 font-semibold">締切</th>
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
                        id={`task-${task.id}`}
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
                          <div className="bg-gray-50/50 border-b border-gray-100 px-4 py-3 overflow-hidden" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
                            {/* 編集フォーム */}
                            {editingTaskId === task.id ? (
                              <div className="flex flex-col gap-2 mb-3 bg-white rounded-xl p-3 border border-blue-100">
                                <input
                                  type="text"
                                  value={editingTaskTitle}
                                  onChange={(e) => setEditingTaskTitle(e.target.value)}
                                  placeholder="タスク名"
                                  className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  autoFocus
                                />
                                <textarea
                                  value={editingTaskDescription}
                                  onChange={(e) => setEditingTaskDescription(e.target.value)}
                                  placeholder="概要（任意）- マニュアルや手順メモなど自由に記載できます"
                                  rows={4}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
                                />
                                <div>
                                  <input
                                    type="text"
                                    value={editingTaskImportantNote}
                                    onChange={(e) => setEditingTaskImportantNote(e.target.value)}
                                    placeholder="重要事項（任意）"
                                    className="w-full border border-orange-200 rounded-lg px-3 py-1.5 text-sm text-orange-700 bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-300 placeholder-orange-300"
                                  />
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {NOTE_PRESETS.map((p) => (
                                      <button key={p} type="button" onClick={() => setEditingTaskImportantNote(p)}
                                        className="text-[10px] bg-orange-50 border border-orange-200 text-orange-500 px-1.5 py-0.5 rounded hover:bg-orange-100 transition-colors">
                                        {p}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="pb-1">
                                <div className="flex gap-2 items-center flex-wrap">
                                  <ClientComboBox
                                    clients={clients}
                                    value={editingTaskClientId}
                                    onChange={(cid, c) => {
                                      setEditingTaskClientId(cid);
                                      setEditingTaskProjectName(c?.name || "");
                                      if (c?.client_type) setEditingTaskClientType(c.client_type);
                                    }}
                                    className="flex-1 min-w-[160px]"
                                  />
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
                                </div>
                                <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                                <div className="flex gap-2 items-center whitespace-nowrap">
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
                                </div>
                                <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                                <div className="flex gap-2 items-center whitespace-nowrap">
                                  <span className="text-[10px] text-gray-400 shrink-0">開始:</span>
                                  <input
                                    type="date"
                                    value={editingTaskStartDate}
                                    onChange={(e) => setEditingTaskStartDate(e.target.value)}
                                    className="w-[130px] border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    title="開始日"
                                  />
                                  <span className="text-[10px] text-gray-400 shrink-0">締切:</span>
                                  <input
                                    type="date"
                                    value={editingTaskDueDate}
                                    onChange={(e) => setEditingTaskDueDate(e.target.value)}
                                    className="w-[130px] border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    title="締切日"
                                  />
                                  <input
                                    type="text"
                                    value={editingTaskDataLocation}
                                    onChange={(e) => setEditingTaskDataLocation(e.target.value)}
                                    placeholder="データ保存場所"
                                    className="min-w-[120px] border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  />
                                </div>
                                </div>
                                {saveTaskError && <p className="text-red-500 text-sm">{saveTaskError}</p>}
                                <div className="flex gap-2 items-center pt-2 border-t border-blue-100 mt-2">
                                  <button
                                    onClick={() => saveTaskEdit(task.id)}
                                    disabled={savingTask}
                                    className={`text-sm font-bold px-5 py-1.5 rounded-lg transition-colors shadow-sm text-white ${savingTask ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"}`}
                                  >
                                    {savingTask ? "保存中..." : "保存する"}
                                  </button>
                                  <button
                                    onClick={() => setEditingTaskId(null)}
                                    className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5"
                                  >
                                    キャンセル
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2 mb-3">
                                <button
                                  onClick={() => {
  setEditingTaskId(task.id); setEditingTaskTitle(task.title); setEditingTaskDescription(task.description ?? ""); setEditingTaskDueDate(task.due_date ?? ""); setEditingTaskStartDate(task.start_date ?? ""); setEditingTaskDataLocation(task.data_location ?? ""); setEditingTaskProjectName(task.project_name ?? ""); setEditingTaskImportance(task.importance || "通常"); setEditingTaskClientType(task.client_type ?? ""); setEditingTaskTaskType(task.task_type ?? ""); setEditingTaskAssignee(task.assignee ?? ""); setEditingTaskClientId(task.client_id ?? ""); setEditingTaskImportantNote(task.important_note ?? "");
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
                                <button onClick={() => duplicateTask(task.id)} className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 hover:border-indigo-400 px-2.5 py-1 rounded-lg transition-colors font-semibold"><Copy size={11} /> コピー</button>
                                <button onClick={() => deleteTask(task.id)} className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2.5 py-1 rounded-lg transition-colors font-semibold">削除</button>
                              </div>
                            )}
                            {/* ミニ工程表 */}
                            <MiniGantt task={task} />

                            {/* サブタスク一覧 */}
                            <div>
                              {(() => {
                                const completedCount = task.subtasks.filter((s) => s.is_completed).length;
                                const isExpanded = expandedCompletedSubtasks[task.id] ?? false;
                                return (
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-gray-400">
                                      サブタスク <span className="text-gray-300 font-normal">({task.subtasks.length - completedCount} 件 進行中{completedCount > 0 && ` / ${completedCount} 件 完了`})</span>
                                    </p>
                                    <div className="flex gap-2 items-center">
                                      {task.subtasks.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => openBulkAssigneeModal(task.id)}
                                          className="text-[10px] text-blue-500 hover:text-blue-700 border border-blue-200 hover:border-blue-400 px-2 py-0.5 rounded-full transition-colors"
                                          title="サブタスクの担当者をまとめて設定"
                                        >
                                          👥 担当者を一括設定
                                        </button>
                                      )}
                                      {completedCount > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => setExpandedCompletedSubtasks((p) => ({ ...p, [task.id]: !isExpanded }))}
                                          className="text-[10px] text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 px-2 py-0.5 rounded-full transition-colors"
                                        >
                                          {isExpanded ? `▲ 完了済み ${completedCount} 件を畳む` : `▼ 完了済み ${completedCount} 件を表示`}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                          <DragDropContext onDragEnd={(result) => reorderSubtasks(task.id, result)}>
                            <Droppable droppableId={task.id}>
                              {(provided) => (
                                <div
                                  className="flex flex-col gap-2"
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                >
                                  {task.subtasks.map((sub, index) => {
                                    const isExpanded = expandedCompletedSubtasks[task.id] ?? false;
                                    // 完了済みが折り畳まれているときは非表示にする
                                    // (DOM には残すので index/drag の整合性は保たれる)
                                    const hiddenByCollapse = sub.is_completed && !isExpanded;
                                    return (
                                    <React.Fragment key={sub.id}>
                                    <Draggable draggableId={sub.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          className={`flex items-start gap-2 rounded-lg ${snapshot.isDragging ? "bg-blue-50 shadow-md" : ""} ${hiddenByCollapse ? "hidden" : ""}`}
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
                                            onClick={() => cycleSubtaskStatus(task.id, sub.id, sub.status || (sub.is_completed ? '完了' : '未着手'))}
                                            className={`mt-1 w-5 h-5 rounded-full border-2 shrink-0 transition-colors flex items-center justify-center text-[8px] font-bold ${
                                              (sub.status || (sub.is_completed ? '完了' : '未着手')) === '完了'
                                                ? "bg-green-400 border-green-400 text-white"
                                                : (sub.status === '進行中')
                                                  ? "bg-blue-400 border-blue-400 text-white"
                                                  : "border-gray-300 hover:border-blue-400"
                                            }`}
                                            title={`ステータス: ${sub.status || (sub.is_completed ? '完了' : '未着手')}（クリックで変更）`}
                                          >
                                            {(sub.status === '進行中') && '▶'}
                                          </button>
                                          <div className={`flex-1 ${editingSubtaskId === sub.id ? 'ring-2 ring-blue-300 rounded px-1' : ''}`}>
                                              <span className={`text-sm ${sub.is_completed ? "line-through text-gray-400" : sub.status === '進行中' ? "text-blue-700 font-semibold" : "text-gray-700"}`}>
                                                {sub.title}
                                              </span>
                                              {sub.status === '進行中' && (
                                                <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">進行中</span>
                                              )}
                                              {sub.description && (
                                                <p className="text-xs text-gray-400 mt-0.5">{sub.description}</p>
                                              )}
                                              {sub.important_note && (
                                                <p className="text-xs text-orange-500 mt-0.5 flex items-center gap-0.5"><AlertTriangle size={10} /> {sub.important_note}</p>
                                              )}
                                              {sub.assignee ? (
                                                <p className="text-xs text-blue-400 mt-0.5 flex items-center gap-0.5"><User size={10} /> {sub.assignee}</p>
                                              ) : task.assignee ? (
                                                <p className="text-xs text-blue-300/70 mt-0.5 flex items-center gap-0.5" title="サブタスク担当者が未指定のため、タスク担当者を継承"><User size={10} /> {task.assignee} <span className="text-[9px] text-gray-400 ml-0.5">(継承)</span></p>
                                              ) : null}
                                              {(sub.start_date || sub.due_date) && (
                                                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-0.5">
                                                  <CalendarDays size={10} />
                                                  {sub.start_date && sub.due_date && sub.start_date !== sub.due_date
                                                    ? `${sub.start_date} 〜 ${sub.due_date}`
                                                    : sub.due_date || sub.start_date}
                                                </p>
                                              )}
                                          </div>
                                          {editingSubtaskId === sub.id ? (
                                            <span className="text-[10px] text-blue-500 font-semibold shrink-0">編集中</span>
                                          ) : (
                                            <button
                                              onClick={() => openSubtaskEditPanel(task.id, sub)}
                                              className="text-xs text-gray-400 hover:text-blue-400 transition-colors shrink-0"
                                            >
                                              編集
                                            </button>
                                          )}
                                          <button
                                            onClick={() => duplicateSubtask(task.id, sub.id)}
                                            className="text-xs text-gray-300 hover:text-indigo-400 transition-colors shrink-0"
                                            title="サブタスクをコピー"
                                          >
                                            コピー
                                          </button>
                                          <button
                                            onClick={() => deleteSubtask(task.id, sub.id)}
                                            className="text-xs text-gray-300 hover:text-red-400 transition-colors shrink-0"
                                          >
                                            削除
                                          </button>
                                        </div>
                                      )}
                                    </Draggable>
                                    {/* 途中挿入ボタン */}
                                    <div className="flex justify-center my-0.5 opacity-0 hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => {
                                          setInsertSubtaskAfter({ taskId: task.id, afterIndex: index });
                                          setEditingSubtaskId('new');
                                          setEditingSubtaskParentTaskId(task.id);
                                          setEditingSubtaskTitle("");
                                          setEditingSubtaskDescription("");
                                          setEditingSubtaskImportantNote("");
                                          setEditingSubtaskAssignee("");
                                          setEditingSubtaskDueDate("");
                                          setEditingSubtaskStartDate("");
                                          setEditingSubtaskStatus('未着手');
                                        }}
                                        className="text-[10px] text-blue-400 hover:text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors"
                                      >
                                        ＋ ここに追加
                                      </button>
                                    </div>
                                    </React.Fragment>
                                    );
                                  })}{provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </DragDropContext>
                          <button
                            onClick={() => {
                              setEditingSubtaskId('new');
                              setEditingSubtaskParentTaskId(task.id);
                              setEditingSubtaskTitle("");
                              setEditingSubtaskDescription("");
                              setEditingSubtaskImportantNote("");
                              setEditingSubtaskAssignee("");
                              setEditingSubtaskDueDate("");
                              setEditingSubtaskStartDate("");
                              setEditingSubtaskStatus('未着手');
                            }}
                            className="mt-3 w-full text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 font-semibold py-2 rounded-lg border border-dashed border-blue-300 transition-colors"
                          >
                            ＋ サブタスクを追加
                          </button>

                          {/* 繰越シリーズの過去履歴(直近 1 年) */}
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-gray-500">
                                📜 このシリーズの過去履歴(直近 1 年)
                                {taskHistoryMap[task.id] && taskHistoryMap[task.id].length > 0 && <span className="text-gray-400 font-normal ml-1">({taskHistoryMap[task.id].length} 件)</span>}
                              </p>
                              {taskHistoryLoading[task.id] && (
                                <span className="text-[10px] text-gray-400">読み込み中…</span>
                              )}
                              {taskHistoryMap[task.id] && !taskHistoryLoading[task.id] && (
                                <button
                                  onClick={() => fetchTaskHistory(task.id)}
                                  className="text-[10px] text-gray-400 hover:text-gray-600"
                                  title="再読み込み"
                                >
                                  ↻ 更新
                                </button>
                              )}
                            </div>
                            {taskHistoryMap[task.id] && (
                              (taskHistoryMap[task.id] || []).length === 0 ? (
                                <p className="text-[10px] text-gray-400 text-center py-2">
                                  直近 1 年にシリーズ履歴はありません。次回このテンプレを同じクライアントに適用すると、ここに積み上がっていきます。
                                </p>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {taskHistoryMap[task.id].map((h) => {
                                    const doneCount = h.subtasks.filter((s) => s.is_completed).length;
                                    const total = h.subtasks.length;
                                    const isOpen = !!expandedHistoryItems[h.id];
                                    const isDone = h.is_completed || h.status === '完了（未請求）' || h.status === '請求済' || h.status === '回収済';
                                    return (
                                      <div
                                        key={h.id}
                                        className="bg-gray-50 border border-gray-100 rounded-lg overflow-hidden"
                                      >
                                        {/* サマリ行(クリックで展開・縮小) */}
                                        <div
                                          className="flex items-start gap-2 px-3 py-1.5 hover:bg-gray-100 cursor-pointer transition-colors"
                                          onClick={() => setExpandedHistoryItems((p) => ({ ...p, [h.id]: !isOpen }))}
                                        >
                                          <span className="text-[10px] shrink-0 mt-0.5">
                                            {isDone ? '✅' : '⏳'}
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <p className="text-xs text-gray-700 truncate flex-1">{h.title}</p>
                                              {h.task_number && <span className="text-[9px] text-gray-400 font-mono shrink-0">{h.task_number}</span>}
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {h.due_date && <span className="text-[9px] text-gray-400">締: {h.due_date}</span>}
                                              {h.assignee && <span className="text-[9px] text-blue-400">担当: {h.assignee}</span>}
                                              {total > 0 && <span className="text-[9px] text-gray-400">{doneCount}/{total} 完了</span>}
                                              {h.important_note && !isOpen && <span className="text-[9px] text-orange-500 truncate max-w-[200px]">⚠ {h.important_note}</span>}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-[10px] text-gray-400">{isOpen ? '▲' : '▼'}</span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/?task=${h.id}`);
                                              }}
                                              className="text-[9px] text-blue-400 hover:text-blue-600 border border-blue-200 hover:border-blue-400 px-1.5 py-0.5 rounded"
                                              title="このタスクを開く"
                                            >
                                              開く
                                            </button>
                                          </div>
                                        </div>

                                        {/* 展開エリア: 重要事項 + サブタスク詳細 */}
                                        {isOpen && (
                                          <div className="bg-white border-t border-gray-200 px-3 py-2">
                                            {h.important_note && (
                                              <div className="mb-2">
                                                <p className="text-[9px] text-gray-400 mb-0.5">📋 タスク重要事項</p>
                                                <p className="text-[11px] text-orange-600 bg-orange-50 border border-orange-100 rounded px-2 py-1">
                                                  ⚠ {h.important_note}
                                                </p>
                                              </div>
                                            )}
                                            {h.subtasks.length > 0 ? (
                                              <div>
                                                <p className="text-[9px] text-gray-400 mb-0.5">📝 サブタスク ({doneCount}/{total})</p>
                                                <div className="flex flex-col gap-1">
                                                  {h.subtasks
                                                    .slice()
                                                    .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
                                                    .map((s) => (
                                                      <div key={s.id} className="border border-gray-100 rounded px-2 py-1 bg-gray-50">
                                                        <div className="flex items-center gap-1.5">
                                                          <span className="text-[10px] shrink-0">
                                                            {s.is_completed ? '✓' : '○'}
                                                          </span>
                                                          <span className={`text-[11px] flex-1 ${s.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                                            {s.title}
                                                          </span>
                                                          {s.assignee && <span className="text-[9px] text-blue-400 shrink-0">{s.assignee}</span>}
                                                        </div>
                                                        {s.important_note && (
                                                          <p className="text-[10px] text-orange-500 mt-0.5 pl-4">⚠ {s.important_note}</p>
                                                        )}
                                                        {s.description && (
                                                          <p className="text-[10px] text-gray-500 mt-0.5 pl-4">{s.description}</p>
                                                        )}
                                                      </div>
                                                    ))}
                                                </div>
                                              </div>
                                            ) : (
                                              <p className="text-[10px] text-gray-400">サブタスクなし</p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )
                            )}
                          </div>

                          {/* タスク単位のチャット/メモ */}
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-gray-500">💬 このタスクへのメモ {taskMemosMap[task.id] && taskMemosMap[task.id].length > 0 && <span className="text-gray-400 font-normal">({taskMemosMap[task.id].length})</span>}</p>
                              {!taskMemosMap[task.id] && (
                                <button
                                  onClick={() => fetchTaskMemos(task.id)}
                                  className="text-[10px] text-blue-400 hover:text-blue-600"
                                >
                                  読み込む
                                </button>
                              )}
                            </div>
                            {taskMemosMap[task.id] && (
                              <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={newTaskMemoInput[task.id] ?? ""}
                                    onChange={(e) => setNewTaskMemoInput((p) => ({ ...p, [task.id]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") postTaskMemo(task.id); }}
                                    placeholder="このタスクに関するメモを書く… (Enter で投稿)"
                                    disabled={taskMemoLoading[task.id]}
                                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50"
                                  />
                                  <button
                                    onClick={() => postTaskMemo(task.id)}
                                    disabled={!(newTaskMemoInput[task.id] || "").trim() || taskMemoLoading[task.id]}
                                    className="text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                  >
                                    投稿
                                  </button>
                                </div>
                                {(taskMemosMap[task.id] || []).length === 0 ? (
                                  <p className="text-[10px] text-gray-400 text-center py-2">
                                    まだメモがありません。このタスクの議論・判断過程・引き継ぎをここに残せます。
                                  </p>
                                ) : (
                                  <div className="flex flex-col gap-1.5">
                                    {(taskMemosMap[task.id] || []).map((memo) => {
                                      const isMine = memo.user_name === (currentUser?.name || "");
                                      return (
                                        <div key={memo.id} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                                          <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <span className="text-[10px] font-semibold text-gray-600">
                                              {memo.user_name || '(名無し)'}
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[9px] text-gray-400">
                                                {new Date(memo.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                              </span>
                                              {isMine && (
                                                <button
                                                  onClick={() => { if (confirm('このメモを削除しますか?')) deleteTaskMemo(task.id, memo.id); }}
                                                  className="text-[9px] text-gray-300 hover:text-red-400"
                                                >
                                                  削除
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                                            {memo.content}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
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
                </ScrollableTable>
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
                                onClick={() => changeTaskStatus(task.id, '進行中')}
                                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 border border-blue-200 hover:border-blue-400 px-2.5 py-1 rounded-full transition-colors font-semibold"
                              >
                                進行中に戻す
                              </button>
                              <button
                                onClick={() => registerAsTemplate(task)}
                                className="inline-flex items-center gap-1 text-xs text-green-500 hover:text-green-700 border border-green-200 hover:border-green-400 px-2.5 py-1 rounded-full transition-colors font-semibold"
                              >
                                <ClipboardList size={11} /> テンプレ登録
                              </button>
                              <button
                                onClick={() => duplicateTask(task.id)}
                                className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 hover:border-indigo-400 px-2.5 py-1 rounded-full transition-colors font-semibold"
                              >
                                <Copy size={11} /> コピー
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
            <SidebarByAssignee activeTasks={allActiveTasks} />
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

// クライアント別ビュー
function ProjectView({
  activeTasks,
  onToggleComplete,
  onDelete,
  onGenerate,
  clients,
}: {
  activeTasks: Task[];
  onToggleComplete: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  onGenerate: (task: Task) => void;
  clients: Client[];
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // クライアント名でグループ化（未設定は「その他」）
  const groups: Record<string, Task[]> = {};
  for (const task of activeTasks) {
    const client = clients.find(c => c.id === task.client_id);
    const key = client?.name || task.project_name?.trim() || "その他";
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
                <span className="text-sm font-bold text-gray-700 flex items-center gap-1"><Building2 size={13} /> {project}</span>
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

// クライアント検索コンボボックス
function ClientComboBox({
  clients,
  value,
  onChange,
  className,
}: {
  clients: Client[];
  value: string;
  onChange: (clientId: string, client?: Client) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const selected = clients.find((c) => c.id === value);

  const filtered = query
    ? clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : clients;

  const typeBadge = (t: string) => {
    if (t === "企業") return <span className="text-[9px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded-full">企業</span>;
    if (t === "資産家") return <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded-full">資産家</span>;
    if (t === "一般社団法人") return <span className="text-[9px] bg-green-100 text-green-600 px-1 py-0.5 rounded-full">社団</span>;
    if (t === "クライアント共通") return <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded-full">共通</span>;
    if (t) return <span className="text-[9px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded-full">{t}</span>;
    return null;
  };

  return (
    <div className={`relative ${className || ""}`}>
      <input
        type="text"
        value={isOpen ? query : (selected?.name || "")}
        onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
        onFocus={() => { setIsOpen(true); setQuery(""); }}
        placeholder="クライアント検索..."
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
      />
      {selected && !isOpen && (
        <button
          onClick={() => { onChange(""); setQuery(""); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-sm"
        >
          ×
        </button>
      )}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-3 text-center">該当なし</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange(c.id, c); setQuery(""); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 ${c.id === value ? "bg-blue-50 font-semibold" : ""}`}
              >
                <span className="flex-1 truncate">{c.name}</span>
                {typeBadge(c.client_type)}
              </button>
            ))
          )}
        </div>
      )}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
}

// 横スクロール可能なテーブルラッパー（左右ボタン付き）
function ScrollableTable({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };
  return (
    <div className="relative bg-white rounded-2xl shadow-sm border border-gray-100">
      <button
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-gray-100 border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center shadow-md text-gray-500 hover:text-gray-800 transition-colors -ml-3"
        aria-label="左にスクロール"
      >
        ‹
      </button>
      <button
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-gray-100 border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center shadow-md text-gray-500 hover:text-gray-800 transition-colors -mr-3"
        aria-label="右にスクロール"
      >
        ›
      </button>
      <div ref={ref} className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {children}
      </div>
    </div>
  );
}

// ミニ工程表（タスク展開時に表示）
function MiniGantt({ task }: { task: Task }) {
  // 全日付を収集
  const allDates: string[] = [];
  if (task.start_date) allDates.push(task.start_date);
  if (task.due_date) allDates.push(task.due_date);
  task.subtasks.forEach((s) => {
    if (s.start_date) allDates.push(s.start_date);
    if (s.due_date) allDates.push(s.due_date);
  });

  if (allDates.length === 0) return null;

  // 日付範囲を計算（前後1日余裕）
  const sorted = allDates.sort();
  const minDate = new Date(sorted[0]);
  const maxDate = new Date(sorted[sorted.length - 1]);
  minDate.setDate(minDate.getDate() - 1);
  maxDate.setDate(maxDate.getDate() + 1);

  const totalDays = Math.max(Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)), 3);

  // 日付ヘッダー生成
  const dayHeaders: { label: string; date: Date; isWeekend: boolean }[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(minDate);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    dayHeaders.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      date: d,
      isWeekend: dow === 0 || dow === 6,
    });
  }

  const dayToPos = (dateStr: string) => {
    const d = new Date(dateStr);
    return Math.max(0, (d.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const renderBar = (start: string | null, end: string | null, color: string, completed: boolean) => {
    if (!start && !end) return null;
    const s = start ? dayToPos(start) : end ? dayToPos(end) - 0.5 : 0;
    const e = end ? dayToPos(end) : start ? dayToPos(start) + 0.5 : 0;
    const left = (s / totalDays) * 100;
    const width = Math.max(((e - s) / totalDays) * 100, 1.5);
    return (
      <div
        className={`absolute top-1 h-4 rounded-full ${completed ? "opacity-40" : ""}`}
        style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }}
      />
    );
  };

  // 今日の位置
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayPos = ((today.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
      <p className="text-[10px] font-semibold text-gray-400 mb-2 uppercase tracking-wide">工程表</p>
      <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: Math.max(totalDays * 32, 300) }}>
          {/* 日付ヘッダー */}
          <div className="flex border-b border-gray-100 mb-1">
            <div className="w-28 shrink-0" />
            <div className="flex-1 flex relative">
              {dayHeaders.map((d, i) => (
                <div
                  key={i}
                  className={`text-center text-[9px] flex-1 py-0.5 ${d.isWeekend ? "bg-gray-50 text-gray-300" : "text-gray-400"}`}
                >
                  {d.label}
                </div>
              ))}
            </div>
          </div>

          {/* タスク本体のバー */}
          <div className="flex items-center mb-0.5">
            <div className="w-28 shrink-0 text-xs font-semibold text-gray-700 truncate pr-2">{task.title}</div>
            <div className="flex-1 relative h-6 bg-gray-50 rounded">
              {renderBar(task.start_date, task.due_date, "#3b82f6", false)}
              {todayPos > 0 && todayPos < 100 && (
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10" style={{ left: `${todayPos}%` }} />
              )}
            </div>
          </div>

          {/* サブタスクのバー */}
          {task.subtasks.map((sub) => (
            <div key={sub.id} className="flex items-center mb-0.5">
              <div className={`w-28 shrink-0 text-[11px] truncate pr-2 pl-3 ${sub.is_completed ? "text-gray-300 line-through" : "text-gray-500"}`}>
                {sub.title}
              </div>
              <div className="flex-1 relative h-5 bg-gray-50/50 rounded">
                {renderBar(sub.start_date, sub.due_date, sub.is_completed ? "#9ca3af" : "#60a5fa", sub.is_completed)}
                {todayPos > 0 && todayPos < 100 && (
                  <div className="absolute top-0 bottom-0 w-0.5 bg-red-400/30 z-10" style={{ left: `${todayPos}%` }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">読み込み中...</div>}>
      <HomeContent />
    </Suspense>
  );
}
