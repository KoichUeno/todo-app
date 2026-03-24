"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Building2, Crown, Plus, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";

type Client = {
  id: string;
  name: string;
  client_type: string;
  head_office: string;
  representative: string;
  fiscal_month: string;
  note: string;
};

const CLIENT_TYPES = ["企業", "資産家", "その他"];

export default function ClientsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [clients, setClients] = useState<Client[]>([]);
  const [filterType, setFilterType] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // 新規登録フォーム
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newHeadOffice, setNewHeadOffice] = useState("");
  const [newRepresentative, setNewRepresentative] = useState("");
  const [newFiscalMonth, setNewFiscalMonth] = useState("");
  const [newNote, setNewNote] = useState("");

  // 編集フォーム
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editHeadOffice, setEditHeadOffice] = useState("");
  const [editRepresentative, setEditRepresentative] = useState("");
  const [editFiscalMonth, setEditFiscalMonth] = useState("");
  const [editNote, setEditNote] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/auth"); return; }
      fetchClients();
    });
  }, []);

  const fetchClients = async () => {
    const res = await fetch("/api/clients");
    if (res.ok) setClients(await res.json());
  };

  const addClient = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, client_type: newType, head_office: newHeadOffice, representative: newRepresentative, fiscal_month: newFiscalMonth, note: newNote }),
    });
    if (res.ok) {
      const c = await res.json();
      setClients((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name, "ja")));
      setNewName(""); setNewType(""); setNewHeadOffice(""); setNewRepresentative(""); setNewFiscalMonth(""); setNewNote("");
      setShowAdd(false);
    }
  };

  const saveEdit = async () => {
    if (!editingClient || !editName.trim()) return;
    const res = await fetch("/api/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingClient.id, name: editName, client_type: editType, head_office: editHeadOffice, representative: editRepresentative, fiscal_month: editFiscalMonth, note: editNote }),
    });
    if (res.ok) {
      const updated = await res.json();
      setClients((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      setEditingClient(null);
    }
  };

  const deleteClient = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    const res = await fetch(`/api/clients?id=${id}`, { method: "DELETE" });
    if (res.ok) setClients((prev) => prev.filter((c) => c.id !== id));
  };

  const startEdit = (c: Client) => {
    setEditingClient(c);
    setEditName(c.name); setEditType(c.client_type || ""); setEditHeadOffice(c.head_office || "");
    setEditRepresentative(c.representative || ""); setEditFiscalMonth(c.fiscal_month || ""); setEditNote(c.note || "");
    setExpandedId(c.id);
  };

  const typeBadge = (t: string) => {
    if (t === "企業") return <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full"><Building2 size={9} /> 企業</span>;
    if (t === "資産家") return <span className="inline-flex items-center gap-0.5 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full"><Crown size={9} /> 資産家</span>;
    return t ? <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t}</span> : null;
  };

  const visible = filterType ? clients.filter((c) => c.client_type === filterType) : clients;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18} /></button>
          <h1 className="text-xl font-bold text-gray-800">クライアントマスター</h1>
        </div>

        {/* フィルター */}
        <div className="flex gap-2 flex-wrap mb-4">
          <button onClick={() => setFilterType("")} className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${!filterType ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>すべて</button>
          {CLIENT_TYPES.map((t) => (
            <button key={t} onClick={() => setFilterType(filterType === t ? "" : t)} className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${filterType === t ? "bg-blue-500 text-white" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}>{t}</button>
          ))}
          <button onClick={() => { setShowAdd(true); setEditingClient(null); }} className="ml-auto text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold px-3 py-1 rounded-full flex items-center gap-1 transition-colors"><Plus size={12} /> 新規登録</button>
        </div>

        {/* 新規登録フォーム */}
        {showAdd && (
          <div className="bg-white rounded-xl border border-blue-200 p-4 mb-4 flex flex-col gap-2">
            <p className="text-sm font-semibold text-gray-700">新規クライアント登録</p>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="クライアント名 *" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <div className="flex gap-2 flex-wrap">
              <select value={newType} onChange={(e) => setNewType(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">顧客区分</option>
                {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={newHeadOffice} onChange={(e) => setNewHeadOffice(e.target.value)} placeholder="本店所在地" className="flex-1 min-w-[120px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <input value={newRepresentative} onChange={(e) => setNewRepresentative(e.target.value)} placeholder="代表者" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <input value={newFiscalMonth} onChange={(e) => setNewFiscalMonth(e.target.value)} placeholder="決算月（例：3月）" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="備考" rows={2} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1">キャンセル</button>
              <button onClick={addClient} className="text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors">登録</button>
            </div>
          </div>
        )}

        {/* クライアント一覧 */}
        <div className="flex flex-col gap-2">
          {visible.length === 0 && <p className="text-sm text-gray-400 text-center py-8">クライアントがありません</p>}
          {visible.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                  {typeBadge(c.client_type)}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={(e) => { e.stopPropagation(); startEdit(c); }} className="text-xs text-gray-400 hover:text-blue-500 transition-colors">編集</button>
                  <button onClick={(e) => { e.stopPropagation(); deleteClient(c.id, c.name); }} className="text-xs text-gray-300 hover:text-red-500 transition-colors">削除</button>
                  {expandedId === c.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </div>

              {expandedId === c.id && (
                <div className="border-t border-gray-50 px-4 py-3">
                  {editingClient?.id === c.id ? (
                    <div className="flex flex-col gap-2">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="クライアント名 *" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      <div className="flex gap-2 flex-wrap">
                        <select value={editType} onChange={(e) => setEditType(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                          <option value="">顧客区分</option>
                          {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input value={editHeadOffice} onChange={(e) => setEditHeadOffice(e.target.value)} placeholder="本店所在地" className="flex-1 min-w-[120px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <input value={editRepresentative} onChange={(e) => setEditRepresentative(e.target.value)} placeholder="代表者" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        <input value={editFiscalMonth} onChange={(e) => setEditFiscalMonth(e.target.value)} placeholder="決算月（例：3月）" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="備考" rows={2} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingClient(null)} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1">キャンセル</button>
                        <button onClick={saveEdit} className="text-xs bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors">保存</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                      {c.head_office && <div><span className="text-gray-400">本店所在地：</span>{c.head_office}</div>}
                      {c.representative && <div><span className="text-gray-400">代表者：</span>{c.representative}</div>}
                      {c.fiscal_month && <div><span className="text-gray-400">決算月：</span>{c.fiscal_month}</div>}
                      {c.note && <div className="col-span-2"><span className="text-gray-400">備考：</span>{c.note}</div>}
                      {!c.head_office && !c.representative && !c.fiscal_month && !c.note && (
                        <p className="col-span-2 text-gray-300">詳細情報なし</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
